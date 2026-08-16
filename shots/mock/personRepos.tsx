import { Option } from "effect"
import type { ListedRepository } from "../../src/domain/life"
import type { Person } from "../../src/domain/person"
import { personIn } from "../../src/github/person"
import { repositoriesIn } from "../../src/github/personRepos"
import { PersonReposScreen, type Shown } from "../../src/ui/PersonReposScreen"
import pageHtml from "../../tests/fixtures/personRepos.html?raw"
import { settled, STORE, type View } from "../view"
import { faceOf } from "./faces"

/**
 * Somebody's repositories tab, in four groups, beside who they are.
 *
 * Read off the saved page rather than typed, for the reason the Releases view gives:
 * hand-written rows would photograph what the parser is meant to do rather than what it
 * does. This is `/flazouh?tab=repositories` as GitHub served it on 2026-08-14 — thirty
 * rows, twelve of them forks, twenty-four carrying a language, and every star count in
 * single figures. Both halves of the screen come out of that one document, which is the
 * argument the picture has to make: the column, the tab row, the figures and the groups
 * are all drawn from the page the reader already paid for.
 *
 * This account rather than a famous one. The page shows a person's face, their name,
 * their words and everywhere they asked to be reached, and none of that belongs in a
 * public marketing image without the person having said so. This is the author's own
 * account, and the face is still drawn locally — see `faceOf` — because a remote avatar
 * races the shutter.
 *
 * The walk is finished and the list is capped, which is what the saved page is: thirty rows
 * of the fifty-five their tab row counts. So the line under the field says so, rather than
 * claiming thirty is the whole of it beside a tab that says fifty-five.
 */

const page: Document = new DOMParser().parseFromString(pageHtml, "text/html")

const ROWS: ReadonlyArray<ListedRepository> = repositoriesIn(page)

/**
 * Them, as their own page has them, with the face swapped for a local drawing.
 *
 * Everything else is theirs unedited: the name, the bio's own newlines, the follower
 * counts in GitHub's own shortened form, and the four ways they listed to be reached.
 */
const WHO: Person = Option.match(personIn(page), {
  onNone: () => {
    throw new Error("tests/fixtures/personRepos.html no longer carries an .h-card")
  },
  onSome: (found) => ({ ...found, faceUrl: faceOf(found.login) })
})

const SHOWN: Shown = { rows: ROWS, reading: false, capped: true }

export const PERSON_REPOS_VIEW: View = {
  name: "person-repos",
  caption:
    "Somebody's repositories in four groups they never had to tag, with what they write and what still moves said above the list",
  ...STORE,
  draw: () => (
    <PersonReposScreen
      login={WHO.login}
      load={settled(SHOWN)}
      who={WHO}
      signedIn={() => true}
      onStepAside={() => {}}
      /* The day the page was saved, so the four groups fall the way they fell that day. */
      now={new Date("2026-08-14T12:00:00Z")}
    />
  )
}
