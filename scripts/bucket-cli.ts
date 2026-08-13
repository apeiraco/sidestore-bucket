#!/usr/bin/env node
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { Builtins, Cli, Command, Option } from "clipanion";
import packageMeta from "../package.json" with { type: "json" };
import { ROOT, readLock, readWorkspace } from "./libs/workspace.ts";
import { verifyLock } from "./libs/schema.ts";
import { build, checkVersions, update } from "./libs/update.ts";

class CheckVersions extends Command {
  static paths = [["checkver"]];
  static usage = Command.Usage({
    description: "Check stable upstream releases without writing files",
  });
  app = Option.String("--app", { description: "One bucket filename, without .json" });
  async execute() {
    this.context.stdout.write(`${JSON.stringify(await checkVersions(ROOT, this.app), null, 2)}\n`);
  }
}
class Update extends Command {
  static paths = [["update"]];
  static usage = Command.Usage({
    description: "Verify IPAs and update the lock, source, and catalog",
  });
  app = Option.String("--app");
  force = Option.Boolean("--force", false, {
    description: "Reinspect unchanged releases using verified download cache",
  });
  async execute() {
    this.context.stdout.write(
      `${JSON.stringify(await update(ROOT, { app: this.app, force: this.force }))}\n`,
    );
  }
}
class Build extends Command {
  static paths = [["build"]];
  static usage = Command.Usage({ description: "Generate source and docs offline from the lock" });
  check = Option.Boolean("--check", false, { description: "Fail if generated files differ" });
  async execute() {
    await build(ROOT, this.check);
    this.context.stdout.write("Source and catalog are valid.\n");
  }
}
class Validate extends Command {
  static paths = [["validate"]];
  static usage = Command.Usage({
    description: "Validate manifests and locked artifact metadata offline",
  });
  async execute() {
    const { apps } = await readWorkspace();
    verifyLock(apps, await readLock());
    this.context.stdout.write(`Validated ${apps.length} apps.\n`);
  }
}
class Docs extends Command {
  static paths = [["docs"]];
  static usage = Command.Usage({ description: "Prepare the catalog and source for VitePress" });
  async execute() {
    await build();
    await mkdir(join(ROOT, "docs/public"), { recursive: true });
    await copyFile(join(ROOT, "apps.json"), join(ROOT, "docs/public/apps.json"));
  }
}
class Clean extends Command {
  static paths = [["clean"]];
  static usage = Command.Usage({ description: "Remove cached IPA downloads" });
  async execute() {
    await rm(join(ROOT, "temp/downloads"), { recursive: true, force: true });
  }
}

const cli = new Cli({
  binaryName: "bucket-cli",
  binaryLabel: packageMeta.description,
  binaryVersion: packageMeta.version,
});
for (const command of [
  CheckVersions,
  Update,
  Build,
  Validate,
  Docs,
  Clean,
  Builtins.HelpCommand,
  Builtins.VersionCommand,
])
  cli.register(command);
void cli.runExit(process.argv.slice(2));
