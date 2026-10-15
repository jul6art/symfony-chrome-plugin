# Contributing to `jul6art/symfony-chrome-plugin`

This repository ships **API Profiler Links for Symfony**, a Chrome DevTools extension designed and
written by Luis Rosas: a **Symfony** tab that lists the XHR and fetch calls of the inspected page and
opens the Symfony profiler for each one.

It is small on purpose: no dependency, no build step, three files of interface. A pull request that
keeps it that way is an easy read; one that adds a toolchain, a permission or a feature nobody has
needed yet is a harder sell — say what you were debugging when you missed it.

Read [README.md](../README.md) first; it documents the behaviour and the limits. Coding agents also
follow [AGENTS.md](../AGENTS.md). This file covers the workflow.

## Before you open anything

* **Bug** → open an [issue](https://github.com/jul6art/symfony-chrome-plugin/issues/new/choose) with
  the extension and Chrome versions, the request that misbehaves (method, status, the
  `X-Debug-Token*` headers) and what the **Symfony** tab shows.
* **New feature, new permission** → open an issue first. A permission that comes with an install
  warning — any new host, for one — makes Chrome disable the extension after the update until each
  user accepts it, so it is discussed before the code.
* **Security problem** → do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Setting up

```bash
git clone https://github.com/jul6art/symfony-chrome-plugin.git
```

Then load the folder in `chrome://extensions` (**Developer mode** → **Load unpacked**). After each
change, click the extension's reload icon, then close and reopen DevTools: `devtools.js` only runs
when DevTools opens.

The checks need Node.js **22+**, Google Chrome, and Chrome for Testing for the end-to-end test:

```bash
npx @puppeteer/browsers@3.2.3 install chrome@stable --path ~/.cache/puppeteer
```

## The quality gate

| Step | What it is | When |
| --- | --- | --- |
| `scripts/check.sh` | JavaScript syntax, manifest, store limits, no inline script in HTML | always |
| `scripts/render.sh dark` and `light` | the panel rendered with `tests/mock-store.js`; open the screenshots | interface changes |
| `scripts/e2e.sh` | the extension in a real DevTools against a fake Symfony API | always |
| `scripts/store-assets.sh` | regenerates the icons and the store images; commit the result | interface, `icons/icon.svg` or `store/promo.html` changes |

`scripts/e2e.sh` green is the minimum for a pull request, not the goal: it only checks what it has a
check for.

## What the CI checks that your machine does not

[`.github/workflows/ci.yml`](workflows/ci.yml) runs the end-to-end test on the **packaged zip**, on
Linux, with the current stable Chrome for Testing. A file the extension needs but
`scripts/package.sh` leaves out passes locally and fails there. On a tag, the CI also refuses a tag
that does not match the manifest version.

## Versioning

The version in `manifest.json` is what Chrome and the Chrome Web Store compare, and the store refuses
a version that is not higher than the published one:

* **patch** — a fix, nothing new to learn;
* **minor** — something added that changes nothing for existing users;
* **major** — something removed or changed in behaviour, or a new permission.

Bump `manifest.json` and the version badge of the README together, then tag `v<version>`.

## House rules

1. **Nothing leaves the browser.** Captured requests stay in DevTools memory. Any new network
   request, storage or telemetry is a discussion, and [PRIVACY.md](../PRIVACY.md) has to stay true.
2. **No new permission without an issue.** The extension holds `localhost` and `*.localhost` only,
   for the profiler lookup. Every permission is justified on the store listing.
3. **Request data is text, never markup.** Build the DOM with `h()` from `panel.js`, which goes
   through `textContent`. No `innerHTML` with anything that came from the network.
4. **No script in HTML.** Manifest V3 pages refuse inline scripts: every script has a `src`.
5. **No `chrome.tabs`, no `navigator.clipboard`.** DevTools pages have no `chrome.tabs`; open tabs with
   a `target="_blank"` link or `window.open`. Copy with `copyText()`.
6. **No dependency and no build step.** Chrome loads the folder as it is. Test tooling needs Node.js
   and Chrome for Testing, nothing from npm.
7. **No Chrome or Symfony trademark in the extension's name or icon.** The store rejects them. The
   name keeps the "… for Symfony" form.
8. **Generated files are regenerated, not edited.** The icons and the store images come from
   `scripts/store-assets.sh`.
9. **Everything in English**: code, comments, interface, documentation and commit messages.

## Tests

A new case in the interface comes with a matching request in `tests/mock-store.js` and a check in
`tests/e2e/run.mjs`. A bug fix comes with the end-to-end check that fails without it: that is how the
fix survives the next change.

## Pull requests

* One subject per pull request.
* Fill in the [template](pull_request_template.md), including the `scripts/e2e.sh` result.
* Commit messages in English, in the imperative: "Add …", "Fix …", "Keep …".
* Update the README in the same pull request when behaviour changes, `PRIVACY.md` when data handling
  changes, and `store/listing.md` when the store description or a permission changes.
* Rebase on `master` rather than merging it back in.

## Code of conduct

Participation is covered by our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Contributions are accepted under the [MIT license](../LICENSE) that covers this repository.
