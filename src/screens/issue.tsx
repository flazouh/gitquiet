import { Effect, Fiber, Option } from "effect"
import { loadIssue, rememberedIssue, reopenIssue, sayOnIssue, settleIssue } from "@/app/issue"
import { uploadFile } from "@/app/attaching"
import { loadSuggesting } from "@/app/suggesting"
import { rememberedRepositories } from "@/app/destinations"
import { forgetIntent, intendedPath } from "@/app/intent"
import { issueDrawn } from "@/app/rows"
import { fromPathname, type IssueRef } from "@/domain/issues"
import type { GitHubGateway } from "@/ports/GitHubGateway"
import { initialiseErrorReporting, reportError } from "@/observability/sentry"
import type { View } from "@/domain/Settings"
import { chosenView, rememberView } from "@/app/settings"
import { standAScreen } from "@/shell/screen"
import { settings, throughGitHub } from "@/shell/supplied"
import { IssueScreen } from "@/ui/IssueScreen"
import { issueNamed } from "@/ui/lastDrawn"
import { handBack, markPage, reveal, ungate } from "@/ui/mount"
import { ISSUE } from "@/ui/place"
import { whenLocationChanges } from "@/ui/navigation"
import { offerOurPage } from "@/ui/theirTabs"
import "@/ui/styles.css"

/**
 * Every repository the reader has, as the store already knows them, for the
 * palette in the bar. Cache only, for the reason a pull request's screen reads
 * it that way: an issue page asking GitHub for a hundred and fifty repositories
 * on the chance somebody presses ⌘K is a request nobody asked for.
 */
const recallRepositories = () => rememberedRepositories().pipe(throughGitHub)

/**
 * Puts the interface on the page for one issue, and hands back the way to take
 * it off again.
 *
 * The closing half is not tidiness. GitHub navigates without loading a page, so
 * the interface for the issue being left is still standing when the next one
 * arrives.
 */
const open = (reference: IssueRef, onUseGitHub?: () => void): (() => void) => {
  /**
   * A read, reported here and still failed for the caller to see.
   *
   * The pull request screen's `writing`, under the name that fits a page with
   * one read on it: a refusal is worth having in the log whether or not the
   * screen finds something to say about it.
   */
  const reading = <A, E>(work: Effect.Effect<A, E, GitHubGateway>) =>
    work.pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error)))
    )

  // Started before anything is waited on, exactly as a pull request's is: the
  // read and the takeover have nothing to say to each other, and running them
  // one after the other spends the whole of GitHub's page load doing nothing.
  const live = Effect.runFork(reading(loadIssue(reference)))

  // Started in the same breath and normally finished long before: one storage
  // read against one request to GitHub.
  const remembered = Effect.runFork(rememberedIssue(reference).pipe(throughGitHub))

  /**
   * The row for this issue, where the list the reader came from drew one.
   *
   * Read rather than waited for, because it is already there: a list says what it
   * has on the screen while it draws, and this screen is stood up afterwards.
   * Nothing for a pasted address, a tab of its own or a link off GitHub's own
   * page, and the screen then waits as it always did. See `rows.ts`.
   */
  const row = issueDrawn(window, reference)

  /*
   * The read above was started before there was anything to render into, so the
   * first ask is given what is already in flight. Every ask after it is somebody
   * saying the issue has changed, and joining that same finished fiber would
   * answer with the page they are trying to leave.
   */
  let started = false
  const read = () =>
    Effect.suspend(() => {
      if (!started) {
        started = true
        return Fiber.join(live)
      }

      return Fiber.join(Effect.runFork(reading(loadIssue(reference))))
    })

  return standAScreen({
    place: ISSUE,
    draw: (standing) => (
      <IssueScreen
        reference={reference}
        load={read}
        preload={() => Fiber.join(remembered)}
        where={issueNamed(reference)}
        row={row}
        recallRepositories={recallRepositories}
        /*
         * The box to write in, which took their own mutation to make possible.
         *
         * A pull request's remark goes through GitHub's own comment form, read off the page
         * and posted with what it carries — see `saying.ts`. Their issue page is React and
         * renders no such form, so this goes the way closing one does: `addCommentMutation`
         * on `/_graphql`, recorded off their own box. The comment comes back rendered and
         * goes straight into the conversation.
         */
        postRemark={(id, body) => reading(sayOnIssue(reference, id, body))}
        /*
         * Who can be mentioned and what can be referred to, read once when a box opens.
         * Their own suggester, which their own box asks the moment an at sign is typed.
         */
        suggest={() => reading(loadSuggesting(reference))}
        /*
         * A screenshot pasted into the box, put where GitHub keeps them. Three requests of
         * theirs, recorded off their own box: see `attaching.md`.
         */
        onUpload={(file) => reading(uploadFile(reference, file))}
        /*
         * Closing an issue, which is a write and the first one this screen makes.
         *
         * Their own page does it through `/_graphql`, and so does this: the reason is
         * carried, because "closed as not planned" is an answer to whoever raised it and
         * "closed" alone is not. Reported here and still failed for the screen, which puts
         * the header back and repeats GitHub's own words.
         */
        settle={(id, settling) => reading(settleIssue(reference, id, settling))}
        reopen={(id) => reading(reopenIssue(reference, id))}
        onStepAside={standing.stepAside}
        onUseGitHub={onUseGitHub}
      />
    )
  }).close
}

/**
 * Puts the issue in charge of the document, once.
 *
 * Called by the shell, which is on every GitHub page and knows from the address
 * that an issue is what is wanted. Between issues this follows the address
 * itself, which is why it is started once and not per issue.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's own issue are
  // written per page and hang on this.
  markPage(document, ISSUE)

  initialiseErrorReporting("content-script")

  const store = settings()

  let close = (): void => {}
  /** Takes the way back off GitHub's tab row, when one is on it. */
  let unoffer = (): void => {}
  let view: View = "ours"

  // Declared rather than assigned, because the three call each other in a ring.

  /**
   * Leaves GitHub to it, putting one control on their own tab row so this is a
   * choice rather than a trapdoor. Not a reload: their issue was only hidden.
   */
  function handOver(): void {
    close()
    close = () => {}
    reveal(document)
    ungate(document)
    unoffer()
    unoffer = offerOurPage(document, takeBack)
  }

  /** Pressed on GitHub's page: ours from here on, starting with this one. */
  function takeBack(): void {
    view = "ours"
    void rememberView(store, "ours")
    show(window.location.pathname)
  }

  /** Pressed in our header: theirs from here on, starting with this one. */
  function useGitHub(): void {
    view = "github"
    void rememberView(store, "github")
    handOver()
  }

  function show(path: string): void {
    close()
    close = () => {}
    unoffer()
    unoffer = () => {}

    const reference = fromPathname(path)
    if (Option.isNone(reference)) {
      handBack(document)
      return
    }

    // Their page, because that is what was asked for last time. Nothing is
    // read, nothing is drawn, and the gate comes off at once.
    if (view === "github") {
      handOver()
      return
    }

    close = open(reference.value, useGitHub)
  }

  whenLocationChanges(window, (path) => show(path))

  // Nothing is drawn until the choice is known, so that a reader who wants
  // GitHub's page is not charged a request for an interface they turned off.
  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen

        const here = window.location.pathname
        const promise = intendedPath(window)
        forgetIntent(window)

        if (Option.isSome(fromPathname(here))) show(here)
        else if (promise !== null && Option.isSome(fromPathname(promise))) show(promise)
        else reveal(document)
      })
    )
  )
}
