-- apps.marketplace now stores the parsed app-info.yaml as `info` (object) instead of the raw `info_text`.
-- Existing rows keep working (the site falls back to info_text); run the sync-github function to rewrite them.
comment on column public.apps.marketplace is
  '{info: {name, tagline, description, category, supported_os[], tags[], ...}, icon_url, screenshots:[{name, download_url}]}';
