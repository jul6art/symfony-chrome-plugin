# Chrome Web Store listing

Everything the Developer Dashboard asks for, ready to paste. The images in this folder come from
`scripts/store-assets.sh`.

## Package

Upload the zip of the latest [GitHub release](https://github.com/jul6art/symfony-chrome-plugin/releases/latest),
`symfony-chrome-plugin-<version>.zip`. The store reads the name, summary, version and icons from its
`manifest.json`. It refuses a package whose version is not higher than the one already published.

## Store listing tab

**Name** (from the manifest): API Profiler Links for Symfony

**Summary** (from the manifest): Lists your app's XHR and fetch calls in a DevTools tab and opens the
Symfony profiler for each one in one click.

**Description**:

```text
Debugging a Symfony API from a single-page app? This extension adds a "Symfony" tab to Chrome DevTools that lists every XHR and fetch call of the page, newest first, and puts the Symfony profiler one click away from each of them.

What you get
• Every API call of your Angular, React or Vue app — or any front end — newest first, with status, method, path and time.
• The JSON response as a collapsible tree, or raw, with a Copy button.
• The request payload (query string and body) and all headers, with the X-Debug-Token headers highlighted.
• One click to the profiler of each call, straight to the Exception panel on a 4xx or 5xx error.
• Buttons to the Exception, Doctrine, Logs, Performance and Request panels of the profiler.
• Your own performance panel when the profiler has one (a data collector named "performance" or "<prefix>.performance"), Symfony's Time panel otherwise. Nothing to configure.
• A filter that takes several words ("post 500 orders"), keyboard navigation, Preserve log, and a light and dark theme that follow DevTools.

Requests are captured as soon as DevTools opens, even before you open the Symfony tab.

Requirements
• A Symfony application in debug mode with the profiler enabled: it sends the X-Debug-Token-Link header the extension relies on.
• Chrome DevTools open while you use the app: Chrome only records requests while DevTools is open.

Privacy
The extension collects nothing and sends nothing anywhere. It reads the network requests of the inspected page only to display them, keeps them in memory, and forgets them when DevTools closes. Full policy: https://github.com/jul6art/symfony-chrome-plugin/blob/master/PRIVACY.md

Open source
MIT licensed, designed and written by Luis Rosas: https://github.com/jul6art/symfony-chrome-plugin

Symfony is a trademark of Symfony SAS. This extension is not affiliated with or endorsed by Symfony SAS or Google.
```

**Category**: Developer Tools

**Language**: English

**Graphic assets**:

| Field | File |
|---|---|
| Store icon (128×128) | `icons/icon-128.png` |
| Screenshots (1280×800) | `store/screenshot-dark-1280x800.png`, `store/screenshot-light-1280x800.png` |
| Small promo tile (440×280) | `store/promo-440x280.png` |
| Marquee promo tile (1400×560) | optional, none |

**Official URL**: none.

**Homepage URL**: https://github.com/jul6art/symfony-chrome-plugin

**Support URL**: https://github.com/jul6art/symfony-chrome-plugin/issues

## Privacy practices tab

**Single purpose description**:

```text
Lists the XHR and fetch calls of the inspected page in a DevTools tab and links each one to its Symfony profiler, so developers can debug a Symfony API from a single-page application.
```

**Permission justification — host permissions** (`*://localhost/*`, `*://*.localhost/*`):

```text
The extension loads the Symfony profiler page of the developer's own local application, once per API, to find a custom performance panel in its menu and link the Performance button to it. Access is limited to localhost and *.localhost, where development applications run; elsewhere the extension falls back to Symfony's built-in Time panel.
```

The extension declares no other permission: `devtools_page` needs none.

**Remote code**: No, I am not using remote code.

**Data usage**: leave every data type unchecked. The extension reads request data only to display it
locally and transmits nothing off the device. Then check the three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL**: https://github.com/jul6art/symfony-chrome-plugin/blob/master/PRIVACY.md

## Distribution tab

**Payments**: free.

**Visibility**: Public to list it in the store, or Unlisted to share it by link only. Both install
without developer mode and update automatically.

**Regions**: all regions.

## Automated releases

Once the item exists in the store — the first upload is manual — the CI can submit each version tag
to the store, after the GitHub release. Set it up once:

1. In the [Google Cloud console](https://console.cloud.google.com/), create a project (or pick one)
   and enable the **Chrome Web Store API**.
2. Create a service account in that project, without any role, then a **JSON key** for it.
3. In the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), add the service
   account's email under **Account**. A publisher can link only one service account.
4. Note the **publisher ID** (Dashboard, **Publisher > Settings**) and the **item ID** (the 32-letter
   ID of the extension in the Dashboard).
5. In the GitHub repository, **Settings > Secrets and variables > Actions**:
   - secret `CWS_SERVICE_ACCOUNT_KEY`: the whole content of the JSON key;
   - variables `CWS_PUBLISHER_ID` and `CWS_EXTENSION_ID`.

From then on, each `v<version>` tag uploads the zip and submits it for review with
`scripts/publish-store.mjs`. The step is skipped while any of the three values is missing. Publishing
keeps the visibility chosen in the Dashboard: after changing it there, publish once by hand.
