/**
 * The issue rows the list on the page has on the screen, so that pressing one of
 * them draws its header at once instead of after GitHub has answered.
 *
 * Measured on 14 August 2026: the first read of an issue nobody has opened
 * before puts the interface on the screen between two and four and a half
 * seconds after the press, and until then the page says "Reading this issue…"
 * and shows nothing. The same issue opened again is eight to twenty-nine
 * milliseconds, because the store has it. So the whole of that wait is the first
 * open of any given issue, and it is one request carrying the issue and every
 * remark on it together: nothing is drawn until the remarks land, including the
 * title the reader was looking at the moment before they pressed.
 *
 * A row is a header and no more. {@link ListedIssue} holds the title, the state,
 * who raised it, when, and its labels; it holds no description and no remarks,
 * and nothing here invents either. What the issue screen still waits for is
 * exactly what a row never carried.
 *
 * Written to the window every script this extension runs in the page shares, for
 * the reason `intent.ts` is written there. A list and an issue are separate
 * screens, each imported by its own extension URL: see `screens.ts`. So neither
 * can see the other's modules, and a value held in one of them is not a value in
 * the other. GitHub's own page cannot see this, which a `data-` attribute could
 * not promise.
 *
 * Said for as long as the list is drawing rather than at the moment of a press.
 * The shell watches presses from the top of the document and has the next screen
 * on its way before any handler inside a screen's own tree is reached, so a
 * hand-over made on the press would arrive after the thing that has to read it.
 * `drawingOurOwnRows` in `src/ui/going.ts` is declared while a list stands for
 * the same reason.
 *
 * Not forgotten when the list goes, which is where this parts company with an
 * intent. An intention names one press, so a stale one sends the next arrival to
 * the wrong pull request. A row here is only ever read for the one issue whose
 * address it matches, so the worst a stale one can do is put a title on the
 * screen that was true when the list was read, for the second before the issue
 * itself lands over it. That is the bargain everything this extension remembers
 * already makes.
 */

import { type IssueRef, type ListedIssue, nameOf } from "../domain/issues"

type World = Window & { gitquietRows?: ReadonlyArray<ListedIssue> }

/**
 * What a list has on the screen now, in place of whatever the last one had.
 *
 * Replaced rather than added to. The question this answers is about the list the
 * reader is pressing a row of, and a collection that grew with every screen this
 * document ever drew would answer with whichever page happened to hold an issue
 * first. That is a title from a search the reader ran twenty minutes ago.
 */
export const drawingIssues = (target: Window, rows: ReadonlyArray<ListedIssue>): void => {
  ;(target as World).gitquietRows = rows
}

/**
 * The row for one issue, where the list that is up drew one for it.
 *
 * Matched on the whole address rather than on the number, because every
 * repository has a 146 and a row matched on the number alone would put another
 * project's title over this one's page.
 *
 * Nothing rather than a guess where no list drew it: a reader who pasted the
 * address, opened it in a tab of its own or came from GitHub's own page has no
 * row behind them, and the screen waits as it always did.
 */
export const issueDrawn = (target: Window, reference: IssueRef): ListedIssue | undefined => {
  const wanted = nameOf(reference)

  return (target as World).gitquietRows?.find((one) => nameOf(one.reference) === wanted)
}
