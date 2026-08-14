import type { RepoRef } from "@/domain/PullRequestRef"
import type { Attached, Platform, Version } from "@/domain/release"
import { buildsOnPage, versionsOnPage } from "@/github/releasesList"
import { ReleasesScreen, type Shown } from "@/ui/ReleasesScreen"
import { Option } from "effect"
import assetsHtml from "../../tests/fixtures/releaseAssets.html?raw"
import listHtml from "../../tests/fixtures/releasesList.html?raw"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"

/**
 * A repository's releases, with the file this reader wants at the top and one row per Change.
 *
 * Read off the saved page rather than typed, which is the same argument the Actions view makes
 * about the fold: hand-written Versions would photograph what the parser is meant to do. This is
 * `zeronsh/comet` as it stood on 2026-08-14 — ten Versions carrying eight Changes, three of them
 * saying nothing at all, and six files on the newest one of which two are GitHub's own archives.
 *
 * There are two things the picture has to show at once. The download row, because their page has
 * no such row and the loudest complaint about it is a reader at 3,293 upvotes asking where the
 * button is. And the joined line of Versions that said nothing, because that is thirty of the
 * sixty-seven on the real repository and their page gives each of them a card.
 *
 * Photographed as a reader on Apple silicon, so one of the six files is named and the other five
 * are folded. Every platform is a different picture here and this is the one where the row is
 * doing its whole job.
 */

const REPO: RepoRef = { owner: "zeronsh", repo: "comet" }

const VERSIONS: ReadonlyArray<Version> = versionsOnPage(listHtml)

const ATTACHED: Attached = buildsOnPage(assetsHtml)

const MACHINE: Platform = { machine: "macos", chip: "arm64" }

const SHOWN: Shown = {
  versions: VERSIONS,
  attached: Option.some(ATTACHED),
  machine: MACHINE
}

export const RELEASES_VIEW: View = {
  name: "releases",
  caption:
    "A repository's releases as the one file this machine should take, and one row per change rather than one card per tag",
  ...STORE,
  draw: () => (
    <ReleasesScreen
      repo={REPO}
      load={settled(SHOWN)}
      preload={alreadyKnown(SHOWN)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )
}
