import { parse } from 'yaml';
import { PLATFORMS, type MarketplaceInfo, type Platform } from './types';

/** Only the first N screenshots (sorted by file name) are shown. */
export const MAX_SCREENSHOTS = 5;
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

const str = (v: unknown): string | undefined => {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s === '' ? undefined : s;
};

function stringList(v: unknown): string[] {
  if (v === null || v === undefined) return [];
  const raw = Array.isArray(v) ? v : String(v).split(',');
  return raw.map((e) => String(e).trim()).filter(Boolean);
}

const asPlatform = (v: string): Platform | undefined =>
  PLATFORMS.find((p) => p === v.toLowerCase());

/** The raw, normalised `app-info.yaml` content (unknown keys kept as-is). */
export type RawInfo = Record<string, unknown>;

/**
 * Parses `app-info.yaml`. Returns null when the YAML is invalid or empty.
 * `supported_os` is lower-cased and filtered to valid OS names, `tags`
 * becomes a list.
 */
export function parseAppInfo(source: string): RawInfo | null {
  try {
    const doc: unknown = parse(source);
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
    const info = { ...(doc as RawInfo) };
    if (Object.keys(info).length === 0) return null;
    info.supported_os = stringList(info.supported_os)
      .map((o) => o.toLowerCase())
      .filter((o) => asPlatform(o));
    info.tags = stringList(info.tags);
    return info;
  } catch {
    return null;
  }
}

function natural(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const x = a.toLowerCase().match(re) ?? [];
  const y = b.toLowerCase().match(re) ?? [];
  for (let i = 0; i < x.length && i < y.length; i++) {
    const nx = /^\d+$/.test(x[i]) ? Number(x[i]) : null;
    const ny = /^\d+$/.test(y[i]) ? Number(y[i]) : null;
    const c = nx !== null && ny !== null ? nx - ny : x[i] < y[i] ? -1 : x[i] > y[i] ? 1 : 0;
    if (c !== 0) return c;
  }
  return x.length - y.length;
}

export interface ShotFile {
  type: string;
  name: string;
  download_url: string | null;
}

/**
 * From a listing of `.marketplace/screenshots`, returns the URLs of the first
 * MAX_SCREENSHOTS images in natural name order (`2.png` before `10.png`).
 */
export function pickScreenshots(listing: ShotFile[]): string[] {
  return listing
    .filter(
      (f) =>
        f.type === 'file' &&
        f.download_url &&
        IMAGE_EXT.some((e) => f.name.toLowerCase().endsWith(e)),
    )
    .sort((a, b) => natural(a.name, b.name))
    .slice(0, MAX_SCREENSHOTS)
    .map((f) => f.download_url as string);
}

/** Builds MarketplaceInfo from a repo's `{info, icon, screenshots}` object. */
export function toMarketplaceInfo(j: {
  info?: RawInfo | null;
  icon?: string | null;
  screenshots?: string[];
}): MarketplaceInfo {
  const info = j.info ?? {};
  const minOs: MarketplaceInfo['minOs'] = {};
  if (info.min_os && typeof info.min_os === 'object') {
    for (const [k, v] of Object.entries(info.min_os as Record<string, unknown>)) {
      const os = asPlatform(k);
      if (os && str(v)) minOs[os] = str(v);
    }
  }
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    name: str(info.name),
    tagline: str(info.tagline),
    description: str(info.description),
    category: str(info.category),
    supportedOs: list(info.supported_os)
      .map((o) => asPlatform(String(o)))
      .filter((o): o is Platform => !!o),
    developer: str(info.developer),
    website: str(info.website),
    supportUrl: str(info.support_url),
    privacyPolicy: str(info.privacy_policy),
    license: str(info.license),
    tags: list(info.tags).map(String),
    minOs,
    iconUrl: str(j.icon),
    screenshots: (j.screenshots ?? []).slice(0, MAX_SCREENSHOTS),
  };
}
