export const PLATFORMS = ['android', 'macos', 'windows', 'linux'] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  android: 'Android',
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
};

export interface AssetInfo {
  name: string;
  url: string;
  size: number;
  downloadCount: number;
  platform: Platform;
  packageType: string; // APK, DMG, MSI, DEB …
}

export interface ReleaseInfo {
  tag: string;
  version: string | null; // normalised semver-ish "1.2.3", or null
  name: string;
  notes: string;
  publishedAt: Date | null;
  prerelease: boolean;
  assets: AssetInfo[];
}

/** Metadata an app author ships in `.marketplace/` of their repo. */
export interface MarketplaceInfo {
  name?: string;
  tagline?: string;
  description?: string;
  category?: string;
  supportedOs: Platform[];
  developer?: string;
  website?: string;
  supportUrl?: string;
  privacyPolicy?: string;
  license?: string;
  tags: string[];
  minOs: Partial<Record<Platform, string>>;
  iconUrl?: string;
  screenshots: string[];
}

export interface AppEntry {
  name: string;
  description: string;
  avatarUrl: string;
  repoUrl: string;
  topics: string[];
  /** Primary language of the repo, if GitHub detected one. */
  language?: string;
  info: MarketplaceInfo | null;
  /** Newest version first. */
  releases: ReleaseInfo[];
}

export interface SocialAccount {
  provider: string;
  url: string;
}

export interface TopLanguage {
  name: string;
  color?: string;
  /** Share of the owner's code, 0-100. */
  percent: number;
}

export interface OwnerProfile {
  login: string;
  htmlUrl: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  company?: string;
  location?: string;
  blog?: string;
  twitter?: string;
  /** From GitHub's social_accounts (LinkedIn, YouTube, Mastodon, ...). */
  socials: SocialAccount[];
  /** From the synced profile's top_languages (largest first). */
  topLanguages: TopLanguage[];
  followers: number;
  following: number;
  publicRepos: number;
  createdAt: Date | null;
}
