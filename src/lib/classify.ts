import type { Platform } from './types';

export interface Classified {
  platform: Platform;
  packageType: string;
}

const IGNORED = [
  '.sha256', '.sha512', '.sha1', '.md5', '.sig', '.asc', '.minisig',
  '.blockmap', '.yml', '.yaml', '.txt', '.json', '.pem', '.sbom',
];

const c = (platform: Platform, packageType: string): Classified => ({
  platform,
  packageType,
});

/**
 * Maps a release asset file name to a platform + package type.
 * Returns null for checksums, signatures and other non-installers.
 */
export function classifyAsset(fileName: string): Classified | null {
  const n = fileName.toLowerCase();
  if (IGNORED.some((e) => n.endsWith(e))) return null;
  const has = (ext: string) => n.endsWith(ext);

  if (has('.apk')) return c('android', 'APK');
  if (has('.aab')) return c('android', 'AAB');

  if (has('.dmg')) return c('macos', 'DMG');
  if (has('.pkg')) return c('macos', 'PKG');
  if (has('.app.zip') || has('.app.tar.gz')) return c('macos', 'APP');

  if (has('.msi')) return c('windows', 'MSI');
  if (has('.msix') || has('.msixbundle')) return c('windows', 'MSIX');
  if (has('.appx')) return c('windows', 'APPX');
  if (has('.exe')) return c('windows', 'EXE');

  if (has('.deb')) return c('linux', 'DEB');
  if (has('.rpm')) return c('linux', 'RPM');
  if (has('.appimage')) return c('linux', 'AppImage');
  if (has('.flatpak')) return c('linux', 'Flatpak');
  if (has('.snap')) return c('linux', 'Snap');

  // Archives: decide by OS keyword in the file name.
  if (has('.zip') || has('.tar.gz') || has('.tgz') || has('.7z')) {
    if (/macos|darwin|osx|mac/.test(n)) return c('macos', 'ARCHIVE');
    if (/windows|win32|win64|win-|-win/.test(n)) return c('windows', 'ARCHIVE');
    if (/linux/.test(n)) return c('linux', 'ARCHIVE');
  }
  return null;
}
