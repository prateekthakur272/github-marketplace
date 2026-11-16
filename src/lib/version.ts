/** A parsed version: numeric core plus an optional pre-release suffix. */
export interface Ver {
  major: number;
  minor: number;
  patch: number;
  pre: string; // '' for a stable release
}

/**
 * Parses tags like `v1.2.3`, `1.2`, `release-2.0.1`. Returns null if no
 * version-like number is found.
 */
export function parseVersion(tag: string): Ver | null {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+]([0-9A-Za-z.+-]+))?/.exec(tag);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2] ?? 0),
    patch: Number(m[3] ?? 0),
    pre: m[4] ?? '',
  };
}

export const versionString = (v: Ver) =>
  `${v.major}.${v.minor}.${v.patch}${v.pre ? `-${v.pre}` : ''}`;

function comparePre(a: string, b: string): number {
  if (a === b) return 0;
  if (a === '') return 1; // stable > pre-release
  if (b === '') return -1;
  const x = a.split('.'), y = b.split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[i] === undefined) return -1;
    if (y[i] === undefined) return 1;
    const nx = /^\d+$/.test(x[i]) ? Number(x[i]) : null;
    const ny = /^\d+$/.test(y[i]) ? Number(y[i]) : null;
    if (nx !== null && ny !== null) {
      if (nx !== ny) return nx < ny ? -1 : 1;
    } else if (nx !== null) return -1;
    else if (ny !== null) return 1;
    else if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
}

export function compareVer(a: Ver, b: Ver): number {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    comparePre(a.pre, b.pre)
  );
}

/** Sort comparator: newest first; unparseable versions fall back to date. */
export function compareReleases(
  a: { v: Ver | null; date: Date | null },
  b: { v: Ver | null; date: Date | null },
): number {
  if (a.v && b.v) {
    const c = compareVer(b.v, a.v);
    if (c !== 0) return c;
  }
  return (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0);
}
