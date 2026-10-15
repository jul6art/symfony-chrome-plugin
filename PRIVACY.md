# Privacy policy

**API Profiler Links for Symfony** — the Chrome extension published from this repository.

Last updated: 2026-10-15.

## In short

The extension collects nothing, sends nothing to its authors or to anyone else, and contains no
analytics, tracking or remote code.

## What the extension reads

While Chrome DevTools is open, the extension reads the network requests of the page you are
inspecting, through Chrome's `chrome.devtools.network` API: their URL, method, status, headers,
and request and response bodies. It needs them to list the calls and show their responses in its
**Symfony** tab.

These requests stay in the memory of your DevTools window. The list is emptied when the page
navigates (unless you check **Preserve log**) and disappears when DevTools closes. The extension
never writes them to disk and never sends them anywhere. It keeps at most the last 500.

## The one request the extension makes

To link the right **Performance** panel, the extension loads the Symfony profiler page of the API
you are inspecting, once per API. That request only goes to `localhost` and `*.localhost` addresses
— your own development application — as declared in the extension's host permissions.

## What the extension stores

Three display preferences — **XHR/fetch only**, **Follow latest** and **Decode URLs** — in the
extension's local storage, on your computer. Nothing else.

## Contact

Questions about this policy: open an issue at
<https://github.com/jul6art/symfony-chrome-plugin/issues>.
