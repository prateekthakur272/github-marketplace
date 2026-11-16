// Public, build-time settings (NEXT_PUBLIC_* values are baked into the site).
export const config = {
  githubOwner: process.env.NEXT_PUBLIC_GITHUB_OWNER || 'prateekthakur272',
  githubToken: (process.env.NEXT_PUBLIC_GITHUB_TOKEN || '').trim(),
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim(),
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || 'dev',
  excludeRepos: new Set<string>(),
  /** REST responses are cached this long to stay under the anonymous limit. */
  cacheTtlMs: 60_000,
  get hasToken() {
    return this.githubToken !== '';
  },
  get hasSupabase() {
    return this.supabaseUrl !== '' && this.supabaseAnonKey !== '';
  },
};
