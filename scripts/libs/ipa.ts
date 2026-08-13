import { unzipSync } from "fflate";
import { parse } from "plist";
import { type Permissions } from "./schema.ts";

function dictionary(data: Uint8Array): Record<string, unknown> {
  const bytes = Buffer.from(data);
  const value = parse(
    bytes.subarray(0, 8).toString() === "bplist00"
      ? data
      : bytes.toString("utf8").replace(/\0+$/, ""),
  );
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected a plist dictionary");
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`IPA has no valid ${field}`);
  return value;
}

function slice(data: Buffer, offset: number, length: number): Buffer {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > data.length
  ) {
    throw new Error("Malformed Mach-O bounds");
  }
  return data.subarray(offset, offset + length);
}

// Read entitlement keys from LC_CODE_SIGNATURE without invoking or re-signing the executable.
export function readEntitlements(data: Buffer, depth = 0): string[] {
  if (depth > 1) throw new Error("Nested universal Mach-O is unsupported");
  slice(data, 0, 8);
  const magic = data.readUInt32BE(0);
  if (magic === 0xcafebabe || magic === 0xcafebabf) {
    const count = data.readUInt32BE(4);
    const stride = magic === 0xcafebabf ? 32 : 20;
    if (count < 1 || count > 32) throw new Error("Invalid Mach-O architecture count");
    slice(data, 8, count * stride);
    const keys: string[] = [];
    for (let i = 0; i < count; i++) {
      const pos = 8 + i * stride + 8;
      const offset = stride === 32 ? Number(data.readBigUInt64BE(pos)) : data.readUInt32BE(pos);
      const length =
        stride === 32 ? Number(data.readBigUInt64BE(pos + 8)) : data.readUInt32BE(pos + 4);
      keys.push(...readEntitlements(slice(data, offset, length), depth + 1));
    }
    return [...new Set(keys)].sort();
  }
  const little = magic === 0xcffaedfe || magic === 0xcefaedfe;
  if (!little && magic !== 0xfeedfacf && magic !== 0xfeedface)
    throw new Error("Unsupported Mach-O executable");
  const u32 = (offset: number) => {
    slice(data, offset, 4);
    return little ? data.readUInt32LE(offset) : data.readUInt32BE(offset);
  };
  const header = magic === 0xcffaedfe || magic === 0xfeedfacf ? 32 : 28;
  const count = u32(16);
  const commandsEnd = header + u32(20);
  slice(data, header, commandsEnd - header);
  if (count > 65536) throw new Error("Invalid Mach-O command count");
  let pos = header;
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    if (pos + 8 > commandsEnd) throw new Error("Truncated Mach-O command");
    const command = u32(pos);
    const size = u32(pos + 4);
    if (size < 8 || pos + size > commandsEnd) throw new Error("Invalid Mach-O command size");
    if (command === 0x1d) {
      if (size < 16) throw new Error("Invalid code signature command");
      const blob = slice(data, u32(pos + 8), u32(pos + 12));
      slice(blob, 0, 12);
      if (blob.readUInt32BE(0) !== 0xfade0cc0) throw new Error("Unsupported code signature");
      const signature = slice(blob, 0, blob.readUInt32BE(4));
      const slots = signature.readUInt32BE(8);
      slice(signature, 12, slots * 8);
      let hasDER = false;
      let hasXML = false;
      for (let index = 0; index < slots; index++) {
        const offset = signature.readUInt32BE(16 + index * 8);
        slice(signature, offset, 8);
        const child = slice(signature, offset, signature.readUInt32BE(offset + 4));
        const kind = child.readUInt32BE(0);
        if (kind === 0xfade7171) {
          hasXML = true;
          keys.push(...Object.keys(dictionary(child.subarray(8))));
        }
        if (kind === 0xfade7172) hasDER = true;
      }
      if (hasDER && !hasXML)
        throw new Error("DER-only entitlements need explicit parser support before publishing");
    }
    pos += size;
  }
  if (pos !== commandsEnd) throw new Error("Mach-O load command size mismatch");
  return [...new Set(keys)].sort();
}

export function inspectIPA(data: Buffer) {
  let total = 0;
  const infos = unzipSync(data, {
    filter(entry) {
      const match =
        /^Payload\/[^/]+\.app\/(?:.*\/)?Info\.plist$/.test(entry.name) &&
        /\.(?:app|appex)\/Info\.plist$/.test(entry.name);
      if (
        match &&
        (entry.originalSize > 4 * 1024 * 1024 || (total += entry.originalSize) > 16 * 1024 * 1024)
      ) {
        throw new Error("IPA plist size limit exceeded");
      }
      return match;
    },
  });
  const roots = Object.keys(infos).filter((name) =>
    /^Payload\/[^/]+\.app\/Info\.plist$/.test(name),
  );
  if (roots.length !== 1) throw new Error("Expected exactly one main application in IPA");
  const main = dictionary(infos[roots[0]!]!);
  const appPermissions: Permissions = { entitlements: [], privacy: {} };
  const binaries = new Set<string>();
  for (const [name, bytes] of Object.entries(infos).sort(([a], [b]) => a.localeCompare(b))) {
    if (name.split("/").some((part) => part === ".." || part === "."))
      throw new Error("Unsafe IPA bundle path");
    const info = dictionary(bytes);
    const executable = string(info.CFBundleExecutable, "CFBundleExecutable");
    if (executable.includes("/") || executable.includes("\\") || executable === "..")
      throw new Error("Invalid IPA executable name");
    binaries.add(name.slice(0, -"Info.plist".length) + executable);
    for (const key of Object.keys(info).sort()) {
      if (/^NS.*UsageDescription$/.test(key)) {
        appPermissions.privacy[key] ??= string(info[key], key);
      }
    }
  }
  total = 0;
  const executables = unzipSync(data, {
    filter(entry) {
      if (!binaries.has(entry.name)) return false;
      if (
        entry.originalSize > 256 * 1024 * 1024 ||
        (total += entry.originalSize) > 512 * 1024 * 1024
      ) {
        throw new Error("IPA executable size limit exceeded");
      }
      return true;
    },
  });
  for (const name of binaries) {
    const bytes = executables[name];
    if (!bytes) throw new Error("IPA is missing a bundle executable");
    appPermissions.entitlements.push(...readEntitlements(Buffer.from(bytes)));
  }
  appPermissions.entitlements = [...new Set(appPermissions.entitlements)].sort();
  appPermissions.privacy = Object.fromEntries(
    Object.entries(appPermissions.privacy).sort(([a], [b]) => a.localeCompare(b)),
  );
  return {
    bundleIdentifier: string(main.CFBundleIdentifier, "CFBundleIdentifier"),
    version: string(main.CFBundleShortVersionString, "CFBundleShortVersionString"),
    buildVersion: string(main.CFBundleVersion, "CFBundleVersion"),
    minOSVersion: string(main.MinimumOSVersion, "MinimumOSVersion"),
    appPermissions,
  };
}
