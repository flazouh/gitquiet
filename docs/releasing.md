# Releasing

A release is one command:

```sh
gh workflow run tag.yml -f bump=minor
```

That writes the next tag, opens the GitHub release, and publishes every target
that has credentials. Nothing is committed. `package.json` stays at `0.0.0` and
every manifest reads `RELEASE_VERSION` at build time, so the tag is the only
record of a version and a release never touches the tree.

`bump` is `patch`, `minor` or `major`, counted from the highest `v*` tag by
`scripts/next-version.ts`. Two things are checked before the tag is written: the
run is on `main`, and CI already went green on that exact commit. A store listing
is public and a submitted version cannot be withdrawn, only replaced by a higher
one.

## One release at a time

Wait for Chrome to finish reviewing a version before cutting the next one. The
Chrome Web Store refuses to accept an upload while the item is in review, and the
job fails with:

```
ITEM_NOT_UPDATABLE: The item cannot be updated now because it is in
pending review, ready to publish, or deleted status.
```

Review is usually hours and can be days. There is nothing to fix when this
happens and nothing to re-run: the tag and the GitHub release are already
written, and the other three targets have already taken it. Once the review
finishes, send that same tag to the one store that missed it:

```sh
gh workflow run release.yml -f tag=v0.2.3 -f targets=chrome
```

Name the target. `targets=all` is the default and is wrong here: a store refuses
a version it already holds, so the run would go red on a release that worked, and
both mac jobs would notarise for an hour to attach a DMG that is already
attached. A dispatch also leaves the release page alone, so the bytes a store is
reviewing stay the bytes the page offers. Add `-f attach=true` to replace them
anyway.

Any target whose credentials are absent is skipped rather than failed, so this is
also how a store is added later: set its secrets, then send it the last tag.

## What Mozilla does with the one before

Mozilla reviews the newest version of a listing and only that one. Cutting a
release while an earlier version is still in the queue takes the earlier one out
of it, and the developer hub then shows that version as **Disabled by Mozilla**
with no reviewer note against it. Nothing was rejected. Read the version at the
top of
[the versions page](https://addons.mozilla.org/developers/addon/gitquiet/versions)
as the one being looked at.

Until the first review finishes, `addons.mozilla.org` answers 404 for the public
listing, which is why gitquiet.com does not link it yet.

## What gets built

```
tag.yml                     release.yml
  count from last tag  -->    gate      which targets have credentials
  write the tag               package   chrome zip, firefox zip, sources zip
  open the release            chrome    Chrome Web Store
                              firefox   Firefox Add-ons, listed
                              desktop   signed, notarised .dmg
                              safari    Xcode wrapper -> .dmg, and the App Store
```

Each target is a job of its own, so a store that rejects a package is a job to
re-run rather than a release to redo. A target with no credentials is skipped,
not failed, which is what lets a release work before all of them are set up.

Every zip and disk image is attached to the GitHub release, so what a store
reviews is what the release page offers to download.

## Credentials

Each group is independent. Set one and that target starts publishing; leave one
and that target stays skipped.

### Chrome Web Store

Already set. `CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`,
`CHROME_REFRESH_TOKEN`, from a Google Cloud OAuth client with the Chrome Web
Store API enabled.

### Firefox Add-ons

The first version has to be uploaded by hand, because the API can update an
add-on but cannot create one. Upload `.output/*-firefox.zip` at
[addons.mozilla.org](https://addons.mozilla.org/developers/addon/submit/upload-listed),
with `.output/*-sources.zip` when it asks for sources.

Then three secrets:

| Secret                 | Where it comes from                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `FIREFOX_EXTENSION_ID` | `gitquiet@gitquiet.dev`, the id in `wxt.config.ts`                                  |
| `FIREFOX_JWT_ISSUER`   | [Manage API keys](https://addons.mozilla.org/developers/addon/api/key/), JWT issuer |
| `FIREFOX_JWT_SECRET`   | The same page, JWT secret. Shown once                                               |

### macOS and Safari

Both Apple jobs share one certificate, so these six turn on both at once. They
need a paid Apple Developer Program membership.

| Secret                       | Where it comes from                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `MACOS_CERTIFICATE`          | A **Developer ID Application** certificate, exported from Keychain Access as `.p12`, then `base64 -i cert.p12 \| pbcopy` |
| `MACOS_CERTIFICATE_PASSWORD` | The password used for that export                                                                                        |
| `APPLE_DEVELOPER_ID`         | The identity in full, as `security find-identity -v -p codesigning` prints it                                            |
| `APPLE_ID`                   | The Apple ID that owns the membership                                                                                    |
| `APPLE_ID_PASSWORD`          | An app-specific password from [account.apple.com](https://account.apple.com), not the account password                   |
| `APPLE_TEAM_ID`              | The ten characters in brackets after the identity name                                                                   |

The disk image is notarised and stapled, so it opens on a machine that has never
seen it. Safari then offers the extension once its app has been moved to
Applications and opened once.

#### The Mac App Store, for Safari

Three more secrets, and the Safari job sends the same build to the App Store as
well as attaching the image. Leave them and only the image is made.

| Secret                           | Where it comes from                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `APPLE_DISTRIBUTION_CERTIFICATE` | An **Apple Distribution** certificate as `.p12`, base64 encoded. Signs the app                 |
| `APPLE_INSTALLER_CERTIFICATE`    | A **Mac Installer Distribution** certificate the same way. Signs the installer around it       |
| `APPLE_DISTRIBUTION_PASSWORD`    | The password both were exported with                                                           |
| `APPLE_ASC_KEY`                  | An App Store Connect API key, the `.p8` base64 encoded. Downloadable once, at Users and Access |
| `APPLE_ASC_KEY_ID`               | The key's ten characters, on the same page                                                     |
| `APPLE_ASC_ISSUER_ID`            | The issuer id above the key list, one per account                                              |

The key needs **App Manager** access, not Developer: a Developer key can neither
upload a build nor make a provisioning profile. Profiles are made on each release
by `scripts/apple-profiles.ts` rather than kept as secrets, because a profile
expires after a year and a secret does not say so.

Both go out from one archive, exported twice, so the bytes Apple reviews are the
bytes the disk image holds. The upload is validated first, which is where a
manifest description over 112 characters is caught: Chrome allows 132 and the App
Store 112, and `manifest.test.ts` holds every target to the smaller number.

An uploaded build is not a released one. App Store Connect has to be told to
submit it, and a first submission also wants a product page, screenshots, the
privacy answers, and the trader status the EU asks for.

## Adding another store

Edge takes the Chrome zip unchanged. It needs a Partner Center product, three
secrets, and a job in `release.yml` shaped like the Chrome one, with
`--edge-zip`, `--edge-product-id`, `--edge-client-id` and `--edge-api-key`.

An Intel Mac build is `targets` in `desktop/electrobun.config.ts`, set to
`macos-arm64,macos-x64`.
