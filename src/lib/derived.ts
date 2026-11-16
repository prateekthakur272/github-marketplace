import type { AppEntry, OwnerProfile, Platform, ReleaseInfo } from './types';

export const displayVersion = (r: ReleaseInfo) => r.version ?? r.tag;
export const releaseDownloads = (r: ReleaseInfo) =>
  r.assets.reduce((s, a) => s + a.downloadCount, 0);
export const releasePlatforms = (r: ReleaseInfo): Platform[] => [
  ...new Set(r.assets.map((a) => a.platform)),
];

export const latest = (a: AppEntry): ReleaseInfo =>
  a.releases.find((r) => !r.prerelease) ?? a.releases[0];
export const displayName = (a: AppEntry) => a.info?.name ?? a.name;
export const iconUrl = (a: AppEntry) => a.info?.iconUrl ?? a.avatarUrl;
export const summary = (a: AppEntry) => a.info?.tagline ?? a.description;
export const about = (a: AppEntry) =>
  a.info?.description ?? a.info?.tagline ?? a.description;
export const category = (a: AppEntry) => a.info?.category;
export const allTags = (a: AppEntry) => [
  ...new Set([...(a.info?.tags ?? []), ...a.topics]),
];
export const screenshots = (a: AppEntry) => a.info?.screenshots ?? [];
export const platformsOf = (a: AppEntry): Platform[] => [
  ...new Set(a.releases.flatMap(releasePlatforms)),
];
export const totalDownloads = (a: AppEntry) =>
  a.releases.reduce((s, r) => s + releaseDownloads(r), 0);
export const publishedMs = (a: AppEntry) => latest(a).publishedAt?.getTime() ?? 0;

export const downloadsFor = (apps: AppEntry[], p: Platform) =>
  apps.reduce(
    (s, a) =>
      s +
      a.releases.reduce(
        (t, r) =>
          t +
          r.assets
            .filter((x) => x.platform === p)
            .reduce((u, x) => u + x.downloadCount, 0),
        0,
      ),
    0,
  );

export const profileName = (u: OwnerProfile) => u.name || u.login;
