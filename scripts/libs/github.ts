import { Octokit } from "octokit";
import { type Manifest } from "./schema.ts";

export type Release = {
  id: number;
  tag_name: string;
  published_at: string | null;
  body?: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: {
    id: number;
    name: string;
    size: number;
    updated_at: string;
    browser_download_url: string;
    state: string;
    digest?: string | null;
  }[];
};
export type Candidate = { release: Release; asset: Release["assets"][number] };

export function selectAsset(manifest: Manifest, release: Release): Candidate {
  if (release.draft || release.prerelease || !release.published_at)
    throw new Error("Expected a published stable release");
  const matches = release.assets.filter((asset) =>
    new RegExp(manifest.autoupdate.assetRegex).test(asset.name),
  );
  if (matches.length !== 1)
    throw new Error(`${manifest.name}: expected exactly one IPA, found ${matches.length}`);
  const asset = matches[0]!;
  const url = new URL(asset.browser_download_url);
  if (
    asset.state !== "uploaded" ||
    asset.size <= 0 ||
    asset.size > 512 * 1024 * 1024 ||
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.pathname !==
      `/${manifest.checkver.github}/releases/download/${encodeURIComponent(release.tag_name)}/${encodeURIComponent(asset.name)}`
  ) {
    throw new Error(`${manifest.name}: invalid or incomplete release asset`);
  }
  return { release, asset };
}

export class GitHub {
  readonly client: Octokit;
  constructor(token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN) {
    this.client = new Octokit({
      auth: token,
      userAgent: "apeiraco-sidestore-bucket/0.1.0",
      request: { timeout: 30_000 },
    });
  }
  async latest(manifest: Manifest): Promise<Candidate> {
    const [owner, repo] = manifest.checkver.github.split("/") as [string, string];
    let release: Release;
    try {
      ({ data: release } = await this.client.rest.repos.getLatestRelease({ owner, repo }));
    } catch (error) {
      // SDK errors may carry authenticated request details; expose only the status and repository.
      const status = (error as { status?: number }).status;
      throw new Error(
        `${owner}/${repo}: GitHub release lookup failed (HTTP ${status ?? "network error"})`,
      );
    }
    return selectAsset(manifest, release);
  }
}
