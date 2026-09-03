import { Option } from "effect"
import type { DiscussionList } from "../../src/domain/discussions"
import { categoriesOnPage, discussionsOnPage } from "../../src/github/discussionsList"
import { DiscussionsScreen, type Shown } from "../../src/ui/DiscussionsScreen"
import listHtml from "../../tests/fixtures/discussionsList.html?raw"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"

/**
 * A repository's discussions, filed by who owes the next move.
 *
 * Read off the saved page rather than typed, which is the argument the Actions and Releases
 * views both make: hand-written rows would photograph what the parser is meant to do rather than
 * what it does. This is `vercel/next.js` as it stood on 2026-09-03 — twenty-five rows, sixteen
 * of them questions, one of those answered, and fifteen with somebody's reply in them and
 * nothing marked.
 *
 * That last number is what the picture has to show. GitHub draws those fifteen with the same
 * grey outlined check it draws on a question nobody has replied to, in the slot beside the
 * comment count, and it is the only thing on their row that says which is which. Here the
 * fourteen still open sit under Needs You and wear the word Stale.
 */

const LIST: DiscussionList = {
  repo: { owner: "vercel", repo: "next.js" },
  category: Option.none(),
  query: "",
  page: 1
}

const SHOWN: Shown = {
  rows: discussionsOnPage(listHtml),
  categories: categoriesOnPage(listHtml),
  more: true
}

export const DISCUSSIONS_VIEW: View = {
  name: "discussions",
  caption:
    "A repository's discussions with the stuck questions gathered under Needs You, rather than one grey check per row",
  ...STORE,
  draw: () => (
    <DiscussionsScreen
      list={LIST}
      load={settled(SHOWN)}
      preload={alreadyKnown(SHOWN)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )
}
