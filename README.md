# Marketplace

A simple app store for your GitHub releases.

Marketplace turns the release builds you already publish on GitHub into a clean, browsable store. Visitors can discover your apps, read about them, and download the right version for their device, whether that's Android, macOS, Windows or Linux.

## What you get

- **A home page** with an overview of your apps, popular downloads and the latest releases.
- **A searchable catalog** you can filter by platform and category.
- **App pages** with a description, screenshots and the full version history.
- **Developer profile** showing all your work in one place.
- **Works on any screen**, from phones to large desktops.

## How it works

Each app describes itself with a small `.marketplace` folder in its repository, containing a name, short description, icon and screenshots. Marketplace reads this information along with your GitHub releases, so the store stays up to date whenever you publish something new.

See the `sample` folder for an example of what an app needs to include.

## Hosting

Marketplace is a static website, so it can be hosted for free on GitHub Pages.
