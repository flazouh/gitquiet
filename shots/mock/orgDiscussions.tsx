import { Option } from "effect"
import type { DiscussionList } from "../../src/domain/discussions"
import { categoriesOnPage, discussionsOnPage } from "../../src/github/discussionsList"
import { DiscussionsScreen, type Shown } from "../../src/ui/DiscussionsScreen"
import listHtml from "../../tests/fixtures/orgDiscussionsList.html?raw"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"

/**
 * An organisation's discussions, which is where GitHub runs its own product feedback.
 *
 * `orgs/community` as GitHub served it on 2026-09-04, read by the same parser and drawn by the
 * same screen as a repository's. That is the whole argument of this picture: the two pages differ
 * in the path in front of the word `discussions` and in the layout around the rows, and in
 * nothing a reader is here for.
 *
 * Twenty-three categories, twenty-five rows, and the same three headings. On a forum this size
 * the stale ones are what the page is made of.
 */

const LIST: DiscussionList = {
  home: { kind: "organisation", org: "community" },
  category: Option.none(),
  query: "",
  page: 1
}

const SHOWN: Shown = {
  rows: discussionsOnPage(listHtml),
  categories: categoriesOnPage(listHtml),
  more: true
}

export const ORG_DISCUSSIONS_VIEW: View = {
  name: "org-discussions",
  caption:
    "An organisation's discussions, filed by the same rule as a repository's — GitHub's own feedback forum, which this extension used to hand back",
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
