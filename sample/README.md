# Sample `.marketplace/` folder

A reference for what each app repository should ship so it looks right in the
marketplace. Copy `sample/.marketplace/` to the **root of your app's repo**,
edit it, and push it with your code.

```
.marketplace/
├── app-info.yaml      name, tagline, description, category, supported_os, …
├── app-icon.png       store icon (square PNG, 512×512 recommended)
└── screenshots/       PNG/JPG/WEBP/GIF — only the first 5 (by file name) are shown
```

## Rules

| What | Rule |
| --- | --- |
| Folder name | exactly `.marketplace` (with the leading dot), at the repo root |
| `app-info.yaml` | all fields optional; see the commented template |
| `app-icon.png` | falls back to the owner's GitHub avatar if missing |
| `screenshots/` | sorted by file name (natural order: `2.png` before `10.png`); extra files beyond 5 are ignored. Prefix with `01-`, `02-` to control order |
| `supported_os` | `android`, `macos`, `windows`, `linux` (anything else is ignored) |

The folder is read from the repo's **default branch**, so it must be pushed
before it shows up. The sample here has 6 screenshots on purpose: the 6th
(`06-extra-not-shown.png`) will not be displayed.

## Try it

1. Copy this folder into one of your app repos (as `.marketplace/`) and push.
2. Reload the marketplace. It reads your repos live from GitHub on every
   open, so the app shows its icon, screenshots, category and supported OS
   right away. There is nothing to rebuild.

> Live data needs the marketplace to be built with a read-only GitHub token
> (`NEXT_PUBLIC_GITHUB_TOKEN=…`). Without one it falls back to anonymous
> GitHub calls, which are limited to 60 requests per hour per visitor.
