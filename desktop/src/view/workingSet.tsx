import { Effect, Option } from "effect"
import { ROW_WRITES } from "../../../src/app/rowWrites"
import { loadWorkingSet, rememberedWorkingSet } from "../../../src/app/workingSet"
import type { RowDoing } from "../../../src/domain/doable"
import type { PullRequestRef } from "../../../src/domain/PullRequestRef"
import { THE_DASHBOARD } from "../../../src/domain/pages"
import type { Sitting } from "../../../src/domain/sittings"
import { WorkingSetScreen } from "../../../src/ui/WorkingSetScreen"
import { THEIRS } from "./where"
import { askForRows, gatewayFrom } from "./gateway"
import { keepRows, keptRows } from "./kept"
import { openOutside } from "./outside"
import { openCard } from "./showing"
import { Supplied } from "./supplied"

/**
 * The Working Set, in a window.
 *
 * Nearly nothing, and that is the point worth taking from it. The extension's
 * version of this file is a hundred and sixty lines, and none of what it does is
 * about pull requests: it hides GitHub's own dashboard, waits for their React to
 * render a region to stand in, survives a soft navigation, and keeps a failsafe
 * timer in case any of that goes wrong on a page it does not own. This window
 * owns everything, so all of that is simply absent.
 *
 * What is left is the same screen, reading through the same port, arranged by the
 * same rules.
 */

/**
 * One read, and a gateway that already has its answer.
 *
 * `loadWorkingSet` asks for six shelves, the standings, the branches and the
 * sizes — a dozen requests against GitHub's dashboard. Here the one request is
 * made first and the layer is built around what came back, so every one of those
 * asks is answered from memory. Per read rather than once, so a refresh cannot be
 * served yesterday's rows by a cache nobody remembered was there.
 *
 * Kept on the way past, which is what makes the next launch instant. Written
 * before the shelves are worked out rather than after: what is worth remembering
 * is what GitHub said, and the arranging is this build's business and free.
 */
const read = () =>
  askForRows().pipe(
    Effect.tap((rows) => Effect.sync(() => keepRows(rows))),
    Effect.flatMap((rows) => loadWorkingSet().pipe(Effect.provide(gatewayFrom(rows))))
  )

/**
 * The list as it was when the window last had one, drawn while GitHub is asked.
 *
 * This is the whole answer to a read that takes four to seven seconds and cannot
 * be made to take less: the reader is handed the list they were working in, in
 * about the time a `localStorage` read takes, and `useLive` replaces it the
 * moment the live answer lands. A failure shows the failure rather than the
 * memory, which is the one rule that keeps this honest — a list of what to work
 * on next is worse than useless when it is quietly half an hour old, because it
 * looks exactly like one that is right.
 *
 * Nothing on a first run, and the bones draw instead.
 */
const remembered = () => {
  const rows = keptRows()
  if (rows === null) return Effect.succeed(Option.none<ReadonlyArray<Sitting>>())

  return rememberedWorkingSet().pipe(Effect.provide(gatewayFrom(rows)))
}



/**
 * One verb, against one row, through a gateway with no rows in it.
 *
 * The reads on this screen are served from the rows the window already fetched;
 * a write has nothing to serve from and goes to GitHub, so it is built the way
 * the card builds its own — empty, and answered over the wire.
 *
 * The verbs themselves are the extension's, and were a copy of them until the
 * copy drifted: merging from a row learnt to ask a repository how it merges on
 * one surface and went on posting `SQUASH` on this one. See `ROW_WRITES`.
 */
const askFor = (doing: RowDoing, reference: PullRequestRef) =>
  Effect.provide(ROW_WRITES[doing](reference), gatewayFrom([]))

export const WorkingSet = () => (
  <Supplied>
    {/*
     * No handler of its own for a press on a row.
     *
     * There was one, and it was half of a rule that lives in `where.ts` now: a row is
     * an anchor to github.com, following one in a window means becoming that card, and
     * deciding that twice in two places is what left the card's own way out pressing
     * into nothing. The rule stops every anchor in the window and opens the card itself.
     *
     * `onOpen` is still handed over, for the one way into a card that is not a press on
     * a link: Enter on the selected row, which the screen binds itself. Enter on an
     * issue row is not that — the screen presses the row's own anchor for those, which
     * is the rule's business again and goes to the browser, an issue being a page this
     * window does not draw.
     */}
    <WorkingSetScreen
      load={read}
      preload={remembered}
      onOpen={openCard}
      /*
       * Always signed in, because this screen is only drawn once the keychain has
       * answered and GitHub has named the reader. The default asks the page
       * whether GitHub has a session, which is a question about a document that
       * does not exist here — it answered no, so every failure for any reason was
       * drawn as "you are signed out of GitHub", sending the reader to fix the one
       * thing that was not broken.
       */
      signedIn={() => true}
      /*
       * Stepping aside is GitHub's list in the reader's browser, because there is
       * no page behind this one to give back.
       *
       * It was `() => {}` on that reasoning, which left two controls pressing into
       * nothing: the failure screen's own way out, and the mark for it in the bar
       * above — a button in the corner of every window that did nothing at all.
       * The offer a window can keep is the browser, so that is the offer.
       */
      onStepAside={() => openOutside(`${THEIRS}${THE_DASHBOARD}`)}
      ask={askFor}
    />
  </Supplied>
)
