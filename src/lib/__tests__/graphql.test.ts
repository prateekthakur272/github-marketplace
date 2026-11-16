import { describe, expect, it } from 'vitest';
import { parseGraphql, RateLimitError } from '../github';

const user = {
  login: 'me', name: 'Me', avatarUrl: 'av', url: 'https://github.com/me', bio: ' hi ',
  company: null, location: 'Indore', websiteUrl: 'me.dev', twitterUsername: null, createdAt: '2020-05-01T00:00:00Z',
  followers: { totalCount: 17 }, following: { totalCount: 11 },
  repositories: {
    totalCount: 3,
    nodes: [
      {
        name: 'Orbit', description: 'd', url: 'https://github.com/me/Orbit', isArchived: false, isPrivate: false,
        owner: { avatarUrl: 'av' }, defaultBranchRef: { name: 'main' },
        repositoryTopics: { nodes: [{ topic: { name: 'flutter' } }] },
        releases: { nodes: [
          { tagName: 'v1.0.0', name: '', description: 'notes', isDraft: false, isPrerelease: false, publishedAt: '2026-01-01T00:00:00Z',
            releaseAssets: { nodes: [
              { name: 'orbit.dmg', size: 2048, downloadCount: 7, downloadUrl: 'https://x/orbit.dmg' },
              { name: 'orbit.dmg.sha256', size: 1, downloadCount: 0, downloadUrl: 'https://x/sha' },
            ] } },
        ] },
        mpInfo: { text: 'name: Orbit Pro\ncategory: Tools\nsupported_os: [macos]\nmin_os:\n  macos: 12' },
        mpInfoYml: null, mpIcon: { __typename: 'Blob' },
        mpShots: { entries: [{ name: '2.png', type: 'blob' }, { name: '1.png', type: 'blob' }, { name: 'notes.txt', type: 'blob' }] },
      },
      { name: 'old', isArchived: true, isPrivate: false, owner: { avatarUrl: '' }, repositoryTopics: { nodes: [] }, releases: { nodes: [] } },
      { name: 'norel', description: '', url: 'u', isArchived: false, isPrivate: false, owner: { avatarUrl: '' },
        repositoryTopics: { nodes: [] }, releases: { nodes: [] } },
    ],
  },
};

describe('parseGraphql', () => {
  it('builds apps and profile from one response', () => {
    const { apps, profile } = parseGraphql({ data: { user } });
    expect(profile.followers).toBe(17);
    expect(profile.bio).toBe('hi');
    expect(profile.createdAt?.getFullYear()).toBe(2020);
    expect(apps).toHaveLength(1); // archived + no-release repos are skipped
    const a = apps[0];
    expect(a.info?.name).toBe('Orbit Pro');
    expect(a.info?.minOs).toEqual({ macos: '12' });
    expect(a.info?.iconUrl).toContain('/Orbit/main/.marketplace/app-icon.png');
    expect(a.info?.screenshots.map((u) => u.split('/').pop())).toEqual(['1.png', '2.png']);
    expect(a.releases[0].name).toBe('v1.0.0'); // empty name falls back to tag
    expect(a.releases[0].assets).toHaveLength(1); // checksum dropped
    expect(a.topics).toEqual(['flutter']);
  });
  it('reports rate limiting', () => {
    expect(() => parseGraphql({ errors: [{ type: 'RATE_LIMITED' }] })).toThrow(RateLimitError);
  });
  it('fails clearly when the user is missing', () => {
    expect(() => parseGraphql({ data: { user: null } })).toThrow(/user not found/);
  });
});
