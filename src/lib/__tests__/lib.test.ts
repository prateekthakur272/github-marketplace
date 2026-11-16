import { describe, expect, it } from 'vitest';
import { classifyAsset } from '../classify';
import { parseAppInfo, pickScreenshots, toMarketplaceInfo } from '../info';
import { compareReleases, parseVersion, versionString } from '../version';
import { buildApp } from '../github';
import { formatCount, formatSize, timeAgo } from '../format';

describe('classifyAsset', () => {
  it.each([
    ['app.apk', 'android', 'APK'],
    ['App.dmg', 'macos', 'DMG'],
    ['setup.EXE', 'windows', 'EXE'],
    ['app.AppImage', 'linux', 'AppImage'],
    ['app-macos-arm64.zip', 'macos', 'ARCHIVE'],
    ['app-win64.zip', 'windows', 'ARCHIVE'],
    ['app-linux.tar.gz', 'linux', 'ARCHIVE'],
  ])('%s -> %s %s', (name, platform, type) => {
    expect(classifyAsset(name)).toEqual({ platform, packageType: type });
  });
  it('ignores checksums and unknown archives', () => {
    expect(classifyAsset('app.dmg.sha256')).toBeNull();
    expect(classifyAsset('source.zip')).toBeNull();
    expect(classifyAsset('latest.yml')).toBeNull();
  });
});

describe('versions', () => {
  it('parses tags', () => {
    expect(versionString(parseVersion('v1.2.3')!)).toBe('1.2.3');
    expect(versionString(parseVersion('1.2')!)).toBe('1.2.0');
    expect(versionString(parseVersion('release-2.0.1-beta.1')!)).toBe('2.0.1-beta.1');
    expect(parseVersion('latest')).toBeNull();
  });
  it('sorts newest first, stable above pre-release', () => {
    const tags = ['v1.0.0', 'v1.10.0', 'v1.2.0', 'v1.10.0-rc.1'];
    const sorted = [...tags].sort((a, b) =>
      compareReleases({ v: parseVersion(a), date: null }, { v: parseVersion(b), date: null }),
    );
    expect(sorted).toEqual(['v1.10.0', 'v1.10.0-rc.1', 'v1.2.0', 'v1.0.0']);
  });
  it('falls back to date when versions are missing', () => {
    expect(
      compareReleases(
        { v: null, date: new Date('2024-01-01') },
        { v: null, date: new Date('2025-01-01') },
      ),
    ).toBeGreaterThan(0);
  });
});

describe('app info', () => {
  it('normalises yaml', () => {
    const info = parseAppInfo('name: X\nsupported_os: [macOS, BeOS, linux]\ntags: a, b')!;
    expect(info.supported_os).toEqual(['macos', 'linux']);
    expect(info.tags).toEqual(['a', 'b']);
  });
  it('returns null for invalid or empty yaml', () => {
    expect(parseAppInfo('')).toBeNull();
    expect(parseAppInfo(': : :')).toBeNull();
    expect(parseAppInfo('- a\n- b')).toBeNull();
  });
  it('picks the first 5 screenshots in natural order', () => {
    const files = ['10.png', '2.png', '1.png', '3.png', '4.png', '5.png', 'x.txt'].map((n) => ({
      type: 'file',
      name: n,
      download_url: `u/${n}`,
    }));
    expect(pickScreenshots(files)).toEqual(['u/1.png', 'u/2.png', 'u/3.png', 'u/4.png', 'u/5.png']);
  });
  it('builds marketplace info', () => {
    const m = toMarketplaceInfo({
      info: { name: 'N', min_os: { macos: 12, bogus: 1 }, supported_os: ['linux'] },
      icon: 'i.png',
    });
    expect(m.name).toBe('N');
    expect(m.minOs).toEqual({ macos: '12' });
    expect(m.supportedOs).toEqual(['linux']);
    expect(m.iconUrl).toBe('i.png');
  });
});

describe('buildApp', () => {
  const repo = { name: 'a', html_url: 'u', owner: { avatar_url: 'av' } };
  const rel = (tag: string, assets: string[], extra = {}) => ({
    tag_name: tag,
    published_at: '2025-01-01T00:00:00Z',
    assets: assets.map((n) => ({ name: n, browser_download_url: `d/${n}`, download_count: 3 })),
    ...extra,
  });
  it('skips drafts and releases without installers; null when none', () => {
    expect(buildApp(repo, [rel('v1', ['a.sha256'])])).toBeNull();
    expect(buildApp(repo, [rel('v1', ['a.dmg'], { draft: true })])).toBeNull();
  });
  it('sorts releases and keeps only installers', () => {
    const app = buildApp(repo, [rel('v1.0.0', ['a.dmg', 'a.dmg.sha256']), rel('v2.0.0', ['a.apk'])])!;
    expect(app.releases.map((r) => r.tag)).toEqual(['v2.0.0', 'v1.0.0']);
    expect(app.releases[1].assets).toHaveLength(1);
  });
});

describe('format', () => {
  it('formats counts, sizes and time', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(1500)).toBe('1.5k');
    expect(formatCount(2_500_000)).toBe('2.5M');
    expect(formatSize(512 * 1024)).toBe('512 KB');
    expect(formatSize(5 * 1024 * 1024)).toBe('5.0 MB');
    const now = Date.parse('2026-01-10T00:00:00Z');
    expect(timeAgo(new Date('2026-01-07T00:00:00Z'), now)).toBe('3d ago');
    expect(timeAgo(new Date('2025-01-01T00:00:00Z'), now)).toBe('1y ago');
  });
});
