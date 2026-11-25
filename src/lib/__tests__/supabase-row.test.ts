import { describe, expect, it } from 'vitest';
import { appFromRow } from '../github';

// Shape written by the sync-github edge function.
const row = {
  name: 'devspace',
  repo: {
    name: 'devspace',
    description: 'A desktop workspace',
    html_url: 'https://github.com/o/devspace',
    topics: ['flutter'],
    language: 'Dart',
    owner: { avatar_url: 'https://avatars.example/o.png' },
    default_branch: 'main',
  },
  releases: [
    {
      tag_name: 'v1.2.0',
      name: 'v1.2.0',
      body: 'notes',
      draft: false,
      prerelease: false,
      published_at: '2026-11-18T10:00:00Z',
      assets: [
        { name: 'DevSpace-macos.dmg', browser_download_url: 'https://x/DevSpace-macos.dmg', size: 10, download_count: 3 },
      ],
    },
  ],
  marketplace: {
    info: {
      name: 'DevSpace',
      tagline: 'Fast workspace',
      category: 'Developer Tools',
      supported_os: ['macos', 'windows', 'beos'],
      tags: 'workspace, git',
    },
    icon_url: 'https://raw.example/app-icon.png',
    screenshots: [
      { name: '10.png', download_url: 'https://raw.example/10.png' },
      { name: '2.png', download_url: 'https://raw.example/2.png' },
    ],
  },
};

describe('appFromRow', () => {
  it('reads the parsed marketplace.info object', () => {
    const app = appFromRow(row)!;
    expect(app.language).toBe('Dart');
    expect(app.info?.name).toBe('DevSpace');
    expect(app.info?.tagline).toBe('Fast workspace');
    expect(app.info?.category).toBe('Developer Tools');
    expect(app.info?.tags).toEqual(['workspace', 'git']);
  });

  it('keeps the icon and orders screenshots naturally', () => {
    const app = appFromRow(row)!;
    expect(app.info?.iconUrl ?? null).toBeDefined();
    expect(app.info?.screenshots).toEqual(['https://raw.example/2.png', 'https://raw.example/10.png']);
  });

  it('handles a row with info: null or no marketplace', () => {
    expect(appFromRow({ ...row, marketplace: { ...row.marketplace, info: null } })).not.toBeNull();
    expect(appFromRow({ ...row, marketplace: null })!.info).toBeNull();
  });
});
