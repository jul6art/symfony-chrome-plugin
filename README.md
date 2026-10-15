<p align="center">
    <a href="https://devinthehood.com"><img src="docs/logo.png" alt="Symfony Chrome plugin logo" width="400"></a>
</p>

Symfony Chrome plugin
=====================

<p align="left">
    <a href="https://opensource.org/licenses/MIT" target="_blank"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License"></a>
    <a href="https://github.com/jul6art/symfony-chrome-plugin/actions/workflows/ci.yml"><img src="https://github.com/jul6art/symfony-chrome-plugin/actions/workflows/ci.yml/badge.svg?branch=master" alt="CI"></a>
    <a href="https://github.com/jul6art/symfony-chrome-plugin/releases/latest"><img src="https://img.shields.io/static/v1?label=stable&message=v1.1.0&color=0ea5e9" alt="Version"></a>
    <img src="https://img.shields.io/static/v1?label=Chrome&message=Manifest%20V3&color=4285f4" alt="Manifest V3">
    <img src="https://img.shields.io/static/v1?label=dependencies&message=none&color=22c55e" alt="No dependencies">
</p>

A **Symfony** tab in Chrome DevTools. It lists the XHR and fetch calls of your Angular application —
or of any front end that talks to a Symfony API — newest first. Each call shows its JSON response as
a tree and opens the Symfony profiler in one click.

In Chrome, the extension is called **API Profiler Links for Symfony**: the Chrome Web Store does not
accept Google's or Symfony's trademarks as a product name.

> 🙏 **This plugin is the work of Luis Rosas**, who designed and wrote it; this repository only
> publishes it. Thank you, Luis, for a tool that puts the Symfony profiler one click away from every
> API call.

Requirements
------------

- Google Chrome, or any Chromium browser that accepts Manifest V3 extensions.
- A Symfony API with the profiler enabled, which sends the `X-Debug-Token-Link` or `X-Debug-Token`
  header.

Installation
------------

1. Download `symfony-chrome-plugin-<version>.zip` from the
   [latest release](https://github.com/jul6art/symfony-chrome-plugin/releases/latest) and unzip it
   into a folder you keep: Chrome loads the extension from that folder.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**, top right.
4. Click **Load unpacked** and pick the unzipped folder.
5. Open DevTools on your application, then the **Symfony** tab.

The extension is not on the Chrome Web Store, so developer mode is the only way to install it. To
update, replace the folder's contents with the new release, then click the extension's reload icon
in `chrome://extensions`.

To work on the code, clone the repository and load its folder the same way:

```shell
git clone https://github.com/jul6art/symfony-chrome-plugin.git
```

After a code change, click the extension's reload icon in `chrome://extensions`, then close and
reopen DevTools.

Usage
-----

- The latest request is selected automatically (**Follow latest** checkbox).
- A row's ⏱ icon opens the profiler. On a 4xx or 5xx error, it opens the **Exception** panel.
- The detail buttons open the profiler on **Exception**, **Doctrine**, **Logs**, **Performance** or **Request**.
- **Performance** opens your own performance panel when the profiler has one, and Symfony's `time` panel otherwise.
  The panel looks in the profiler menu for a data collector named `performance` or `<prefix>.performance`,
  such as `core.performance` from [jul6art/core-bundle](https://github.com/jul6art/core-bundle). Nothing to configure.
- A call's detail has three tabs: **Response** (JSON tree or raw text, **Copy** button),
  **Payload** (query string and request body) and **Headers**.
- **Latest profiler ↗** opens the profiler of the latest listed call that has one.
- **Preserve log** keeps requests when the page navigates. **Decode URLs** shows `%5B` as `[`.
- Keyboard shortcuts: up and down arrows to change request, `p` to open the profiler.
- The filter takes several words: `post 500 orders`.

### Limitations

- Chrome only records requests while DevTools is open.
- Detecting a custom performance panel only works on `localhost` and `*.localhost`, the hosts declared in `host_permissions`. Elsewhere, **Performance** opens the `time` panel.
- The link comes from the `X-Debug-Token-Link` header. Without it, the panel builds `/_profiler/{X-Debug-Token}` on the request's host.
- The panel keeps the last 500 requests.

Development
-----------

The extension has no dependency and no build step: Chrome loads the folder as it is.

| File | Role |
|---|---|
| `manifest.json` | Declares the extension and its DevTools page. |
| `devtools.js` | Captures requests as soon as DevTools opens, before the tab is even shown. |
| `panel.html`, `panel.js`, `panel.css` | The **Symfony** tab's interface. |
| `icons/` | Extension icons, 16 to 128 px, drawn from `icons/icon.svg`. `docs/logo.png` is the project logo above. |
| `store/` | Chrome Web Store listing: texts to paste (`listing.md`), promo tile source and generated images. |
| `PRIVACY.md` | Privacy policy, linked from the store listing. |
| `tests/mock-store.js` | Fake requests to test the interface outside DevTools. |
| `tests/e2e/` | End-to-end test in a real DevTools, against a fake Symfony API. |
| `scripts/` | Checks, rendering, end-to-end test, packaging, store images and store publishing. |

```shell
scripts/check.sh          # JavaScript syntax, manifest, no inline script in HTML (Node.js)
scripts/render.sh dark    # screenshot of the interface in dist/, dark theme (Google Chrome)
scripts/render.sh light   # same, light theme
scripts/e2e.sh            # end-to-end test in a real DevTools (Chrome for Testing)
scripts/package.sh        # dist/symfony-chrome-plugin-<version>.zip
scripts/store-assets.sh   # icons and Chrome Web Store images, from their sources (Google Chrome)
```

`scripts/render.sh` and `scripts/store-assets.sh` look for Chrome at its macOS location. On another
system, set its path in the `CHROME` variable.

The extension icons and the store images are generated files: change `icons/icon.svg`,
`store/promo.html` or `tests/mock-store.js`, then run `scripts/store-assets.sh` and commit the
result. The store icon cannot use the Chrome or Symfony logos, which are trademarks.

### End-to-end test

`scripts/render.sh` only renders the panel with fake data. `scripts/e2e.sh` covers the rest: it
loads the extension into Chrome with DevTools open, sends requests from a page served by a fake
Symfony API, and checks the capture in `devtools.js`, the **Symfony** tab and its profiler links. It
saves a screenshot to `dist/e2e.png`.

Google Chrome ignores `--load-extension` since version 137, so the test needs Chrome for Testing.
Install it once:

```shell
npx @puppeteer/browsers@3.2.3 install chrome@stable --path ~/.cache/puppeteer
```

The script picks the newest version found there, or the binary given in `E2E_CHROME`. It needs
Node.js 22 or later.

```shell
scripts/e2e.sh                                   # this folder
scripts/e2e.sh dist/symfony-chrome-plugin-1.1.0.zip  # a packaged build, as the CI does
scripts/e2e.sh . headed                          # with a visible window
```

Contributions follow [CONTRIBUTING.md](.github/CONTRIBUTING.md), security reports
[SECURITY.md](.github/SECURITY.md). Instructions for coding agents are in [AGENTS.md](AGENTS.md).

### Releasing a version

1. Bump `version` in `manifest.json` and in the version badge at the top of this README.
2. Create a `v<version>` tag, for example `v1.1.0`, and push it.

On every push to `master` and every pull request, the CI runs the checks, builds the zip and runs
the end-to-end test on that zip. On a tag, it also checks that the tag matches the manifest
version, then publishes a GitHub release with the zip and the installation steps from
`.github/release-notes.md`.

Once the extension is on the Chrome Web Store and the CI holds its credentials, a tag also submits
the zip to the store for review. [store/listing.md](store/listing.md) has the listing texts and the
one-time setup.

License
-------

This plugin is open-sourced software licensed under the [MIT license](LICENSE).

Designed and written by **Luis Rosas**. Published by [jul6art](https://devinthehood.com).

Symfony is a trademark of Symfony SAS, and Chrome a trademark of Google LLC. This project is not
affiliated with or endorsed by either.
