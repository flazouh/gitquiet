import { Option } from "effect"
import type { DiscussionSnapshot } from "../../src/domain/discussions"
import type { DiscussionRef } from "../../src/domain/discussionRoutes"
import { discussionOnPage } from "../../src/github/discussionView"
import { DiscussionScreen } from "../../src/ui/DiscussionScreen"
import pageHtml from "../../tests/fixtures/discussionView.html?raw"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"

/**
 * One discussion nobody has answered, which is the state four of five real questions are in.
 *
 * Read off the saved page rather than typed, as every other view here is. This is
 * `vercel/next.js` #70178 as GitHub served it on 2026-09-03: six comments, three replies under
 * the first of them, 138 upvotes on the question, and nothing marked in two years.
 *
 * The picture has to show the card their page has no equivalent of. GitHub draws these nine
 * comments in the order they arrived and says "Unanswered" in a grey pill above them. Here the
 * most upvoted reply is lifted out under a heading that says plainly that nobody marked one,
 * which is the nearest thing the page itself has to an answer.
 */

const REFERENCE: DiscussionRef = {
  home: { kind: "repository", owner: "vercel", repo: "next.js" },
  number: 70178
}

const SHOWN: DiscussionSnapshot = Option.getOrThrow(discussionOnPage(REFERENCE, pageHtml))

export const DISCUSSION_VIEW: View = {
  name: "discussion",
  caption:
    "One discussion with the marked answer lifted to the top, or, where nobody marked one, the reply people upvoted most",
  ...STORE,
  draw: () => (
    <DiscussionScreen
      reference={REFERENCE}
      load={settled(SHOWN)}
      preload={alreadyKnown(SHOWN)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )
}
