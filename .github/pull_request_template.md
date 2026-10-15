## What this changes

<!-- One subject per pull request. Say what a developer debugging a Symfony API will be able to
     do, or stop having to do. -->

Closes #

## Type

- [ ] Bug fix — **patch**
- [ ] New feature, nothing changes for existing users — **minor**
- [ ] Removed or changed behaviour, or a new permission — **major**
- [ ] Documentation or tooling only

<!-- A permission that comes with an install warning — any new host, for one — makes Chrome
     disable the extension after the update until each user accepts it. -->

## Quality gate

- [ ] `scripts/check.sh` — clean
- [ ] `scripts/e2e.sh` — green
- [ ] `scripts/render.sh dark` and `light` — screenshots opened and checked *(interface changes)*
- [ ] `scripts/store-assets.sh` — icons and store images regenerated and committed *(interface,
      icon or promo tile changes)*

<details>
<summary>Output of <code>scripts/e2e.sh</code></summary>

```
```

</details>

## Tests

- [ ] A bug fix ships the end-to-end check that fails without it
- [ ] A new interface case has its request in `tests/mock-store.js` and its check in
      `tests/e2e/run.mjs`

## Documentation

- [ ] The README is updated *(changed behaviour)*
- [ ] `PRIVACY.md` is still true *(new network request, storage or data handling)*
- [ ] `store/listing.md` is updated *(store description, permission justification)*
- [ ] The house rules in [CONTRIBUTING.md](CONTRIBUTING.md) still hold for what I added

## Notes for the reviewer

<!-- Trade-offs, anything left out on purpose, follow-up work, and which project you were
     debugging when you needed this. -->
