# AGENTS.md

Instructions for coding agents working on this repository.

## The project

A Manifest V3 Chrome extension, with no dependency and no build step. It adds a **Symfony** tab to
DevTools. The tab lists the XHR and fetch calls of an Angular application, newest first. It shows
the JSON response and opens the Symfony profiler through the `X-Debug-Token-Link` header.

## Files

| File | Role |
|---|---|
| `manifest.json` | Declares the extension and its DevTools page. |
| `devtools.js` | Captures requests as soon as DevTools opens and keeps them in a shared object, the `store`. |
| `panel.html`, `panel.js`, `panel.css` | The **Symfony** tab's interface. |
| `tests/mock-store.js` | Fake `store` that injects requests to test the interface outside DevTools. |
| `tests/e2e/` | End-to-end test: the extension in a real DevTools, against a fake Symfony API (`server.mjs`). |
| `scripts/` | Checks, rendering, end-to-end test and packaging, run locally and in CI. |

`devtools.js` hands the `store` to `panel.js` through `panel.onShown`, which calls
`window.attach(store)`. The panel only exists once it is shown. That is why capture lives in
`devtools.js`: requests that arrive before the tab is shown are not lost.

## Constraints

- **No script in HTML.** Manifest V3 extension pages refuse JavaScript written directly inside a
  `<script>` tag. Every script goes through a `src` attribute.
- **No `innerHTML` with request data.** URLs and responses come from the network. Build the DOM
  with the `h()` function of `panel.js`, which goes through `textContent`.
- **No `chrome.tabs`.** DevTools pages have no access to it. Open a tab with a `target="_blank"`
  link or `window.open`.
- **No `navigator.clipboard`.** Chrome often blocks it in DevTools. Use `copyText()`.
- **No npm dependency and no build step.** Chrome loads the folder as it is. The end-to-end test
  only needs Node.js and Chrome for Testing, installed outside the repository.
- **Everything in English**: code, comments, interface, documentation, commit messages.

## Checking a change

1. Run `scripts/check.sh`. It checks the JavaScript syntax, the manifest and that the HTML has no
   inline script.
2. If you touch the interface, run `scripts/render.sh dark`, then `scripts/render.sh light`. Each
   command saves a screenshot to `dist/` and prints a JSON summary: number of rows, selected row and
   number of profiler links. Open the screenshots to check the layout.
3. Run `scripts/e2e.sh`. It loads the extension into Chrome for Testing with DevTools open, and
   checks `devtools.js`, the `chrome.devtools` API, the **Symfony** tab and the profiler links
   against `tests/e2e/server.mjs`. It saves a screenshot to `dist/e2e.png`.
4. If you add a case to the interface, add a matching request to `tests/mock-store.js` and a check
   to `tests/e2e/run.mjs`.

`scripts/render.sh` needs Google Chrome. On a system other than macOS, set its path in the
`CHROME` variable.

`scripts/e2e.sh` needs Node.js 22+ and Chrome for Testing, because Google Chrome ignores
`--load-extension` since version 137. If it is missing, install it with
`npx @puppeteer/browsers@3.2.3 install chrome@stable --path ~/.cache/puppeteer`, or set its binary
in `E2E_CHROME`.

Neither test replaces the user's own Chrome. After a change to `devtools.js`, tell the user to
reload the extension in `chrome://extensions`, then close and reopen DevTools.

## Releasing a version

1. Bump `version` in `manifest.json` and in the version badge of `README.md`.
2. Create a `v<version>` tag, for example `v1.1.0`, and push it.

The CI, defined in `.github/workflows/ci.yml`, runs the checks, builds the zip and runs the
end-to-end test on that zip, on every push to `master` and every pull request. On a tag, it also
checks that the tag matches the manifest version, then creates a GitHub release with the zip. The
installation steps at the top of the release come from `.github/release-notes.md`.
