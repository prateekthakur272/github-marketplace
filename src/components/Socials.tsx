'use client';

import { Facebook, Github, Globe, Instagram, Link2, Linkedin, Twitch, Twitter, Youtube, type LucideIcon } from 'lucide-react';
import { blogUrl } from '@/lib/github';
import type { OwnerProfile } from '@/lib/types';

const ICONS: Record<string, LucideIcon> = {
  linkedin: Linkedin,
  twitter: Twitter,
  youtube: Youtube,
  instagram: Instagram,
  facebook: Facebook,
  twitch: Twitch,
};
const LABELS: Record<string, string> = {
  linkedin: 'LinkedIn', twitter: 'X / Twitter', youtube: 'YouTube', instagram: 'Instagram', facebook: 'Facebook',
  twitch: 'Twitch', mastodon: 'Mastodon', reddit: 'Reddit', npm: 'npm', hometown: 'Hometown', bluesky: 'Bluesky',
};
const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

function SocialLink({ href, provider, label, Icon }: { href: string; provider: string; label: string; Icon: LucideIcon }) {
  return (
    <a className="social" data-p={provider} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}>
      <Icon size={17} />
      <span>{label}</span>
    </a>
  );
}

/** Website, X and every entry of GitHub's social_accounts, as brand-tinted chips. */
export function Socials({ profile: u, align = 'center', withGithub = false }: { profile: OwnerProfile; align?: 'center' | 'start'; withGithub?: boolean }) {
  const site = blogUrl(u);
  const hasX = u.socials.some((x) => /twitter|x\.com/i.test(x.provider + x.url));
  if (!withGithub && !site && !u.twitter && u.socials.length === 0) return null;
  return (
    <div className="socials" style={{ justifyContent: align === 'start' ? 'flex-start' : 'center' }}>
      {withGithub && <SocialLink href={u.htmlUrl} provider="github" label="GitHub" Icon={Github} />}
      {site && <SocialLink href={site} provider="website" label="Website" Icon={Globe} />}
      {u.twitter && !hasX && <SocialLink href={`https://x.com/${u.twitter}`} provider="twitter" label="X" Icon={Twitter} />}
      {u.socials.map((x) => (
        <SocialLink
          key={x.url}
          href={x.url}
          provider={x.provider}
          label={LABELS[x.provider] ?? (x.provider === 'generic' ? hostOf(x.url) : x.provider)}
          Icon={ICONS[x.provider] ?? Link2}
        />
      ))}
    </div>
  );
}
