# Security Policy

## Supported versions

Only the latest release gets fixes. An installation from the Chrome Web Store updates on its own; an
installation from a release zip has to be replaced by hand.

| Version | Supported |
| --- | --- |
| latest release | ✅ |
| any older release, zip or fork | ❌ |

Update to the latest release before reporting, in case the problem is already gone.

## What is in scope

The extension sits in DevTools, reads every request of the inspected page — headers, cookies,
bodies, tokens included — and renders it in a privileged extension page. What matters most:

* **Request data leaving the browser** — any path that stores captured requests on disk or sends
  them anywhere. The only request the extension makes on its own is the profiler page lookup on
  `localhost` and `*.localhost`, described in [PRIVACY.md](../PRIVACY.md).
* **Response data reaching the extension page as markup** — a URL, header or body rendered as
  HTML instead of text, or anything else that lets the inspected site run code in the panel.
* **A link the extension should not open or fetch** — an `X-Debug-Token-Link` header crafted by the
  inspected site that makes the panel open, or fetch with its host permissions, something other
  than a Symfony profiler page.
* **Permission creep** — a permission or host permission beyond what the extension needs, or code
  loaded from outside the package.

Out of scope: vulnerabilities in Chrome, DevTools or Symfony — report those to the project that owns
the code. A Symfony profiler reachable in production is the application's problem, not the
extension's: the profiler must never be enabled there.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use [GitHub's private vulnerability reporting](https://github.com/jul6art/symfony-chrome-plugin/security/advisories/new)
(the **Security** tab → *Report a vulnerability*). It opens a draft advisory only you and the
maintainers can read, and it is the channel this project prefers — no email address needs to be
published for it to work.

Please include:

* the extension version (`chrome://extensions`) and where it was installed from — Chrome Web
  Store, release zip or clone,
* the Chrome version (`chrome://version`),
* the shortest reproduction you have — ideally the response, or just its headers, that triggers
  the problem,
* what an attacker gains: what runs, what is read or sent, and what the victim has to do.

## What to expect

* An acknowledgement within **7 days**.
* An assessment — accepted, out of scope, or needing more detail — within **14 days**.
* For an accepted report: a fixed release, a
  [security advisory](https://github.com/jul6art/symfony-chrome-plugin/security/advisories)
  describing the impact and the version to update to, and credit in it unless you ask otherwise.

Please give the maintainers a reasonable window to ship a release before disclosing publicly. This
project runs no bug-bounty programme and offers no payment.
