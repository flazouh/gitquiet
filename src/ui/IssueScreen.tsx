import { Effect, Option } from "effect"
import { useMemo, useState } from "react"
import { closingOf, type Closing, type IssueSnapshot, type Remark, type Settled } from "../domain/Issue"
import { type IssueRef, type ListedIssue, nameOf } from "../domain/issues"
import type { Repository } from "../domain/repositories"
import type { Uploaded } from "../domain/attaching"
import type { Suggesting } from "../domain/suggesting"
import { Conversation } from "./Conversation"
import { Description } from "./Description"
import { IssueHeader, ListedHeader } from "./IssueHeader"
import { reasonFor } from "./refusal"
import { SETTLED } from "./Settle"
import { done, refused } from "./Toasts"
import { TheBar } from "./TheBar"
import { useUpdated } from "./useUpdated"
import { useLive } from "./useLive"
import { useWaiting } from "./useWaiting"
import { Waiting } from "./Waiting"

export type LoadedIssue = {
  readonly snapshot: IssueSnapshot
}

export type IssueScreenProps = {
  readonly reference: IssueRef
  readonly load: () => Effect.Effect<LoadedIssue, unknown>
  /**
   * The issue as it was last time, shown while {@link load} finds out what it is
   * now. The same bargain the pull request screen makes with what it remembers:
   * worth the half second, never rested on.
   */
  readonly preload?: () => Effect.Effect<Option.Option<LoadedIssue>>
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string
  /**
   * The row the list drew for this issue, where the reader pressed one.
   *
   * A header and nothing else, which is the whole of what makes it honest: a row
   * carries the title, the state, who raised it, when, and its labels, and
   * carries no description and no remarks. So this shortens the wait for the part
   * a row answered and leaves the wait over the part it never did. See
   * `src/app/rows.ts` for how it crosses from one screen to the other.
   *
   * Absent where nobody pressed a row of ours: a pasted address, a tab of its
   * own, a link from GitHub's own page. The screen then waits as it always did.
   */
  readonly row?: ListedIssue
  /** Restores GitHub's own issue, which is still on the page behind this. */
  readonly onStepAside: () => void
  /**
   * The same, but meant: hands the page back and remembers that GitHub's is the
   * page to open from now on.
   */
  readonly onUseGitHub?: () => void
  /**
   * Says something on the issue, under GitHub's own name for it.
   *
   * The id is passed the way the close passes it, and for the same reason: their write
   * routes are addressed to a node id, and this screen is the only thing holding one.
   * Absent where nothing is wired up to it, which is how a test of the read stays one.
   */
  readonly postRemark?: (id: string, body: string) => Effect.Effect<Remark, unknown>
  /** Who can be mentioned and what can be referred to, for the box. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
  /**
   * Closes the issue, saying why, and opens a closed one again.
   *
   * Two rather than one because GitHub wrote them that way, and because the reason is the
   * thing the word "Closed" hides. Absent where nothing is wired up to them, which is how
   * every test of this screen that is not about closing stays about what it is about.
   */
  readonly settle?: (id: string, settling: Settled) => Effect.Effect<void, unknown>
  readonly reopen?: (id: string) => Effect.Effect<void, unknown>
  /** The repository list as the last visit to Home left it, for the palette behind ⌘K. */
  readonly recallRepositories?: () => Effect.Effect<Option.Option<ReadonlyArray<Repository>>>
  readonly signedIn?: () => boolean
}

/**
 * Who GitHub thinks is here, read off the page rather than asked for. The same
 * answer the pull request screen uses, and for the same reason: it is only ever
 * asked once everything else has already failed.
 */
const viewerOnPage = (): boolean =>
  (document.querySelector('meta[name="user-login"]')?.getAttribute("content") ?? "") !== ""

/** The two fields a press moves, which is the whole of what is held over the read. */
type Shown = {
  readonly state: IssueSnapshot["state"]
  readonly closing: Option.Option<Closing>
}

const shownOf = (snapshot: IssueSnapshot | undefined): Shown | undefined =>
  snapshot === undefined ? undefined : { state: snapshot.state, closing: snapshot.closing }

/**
 * What a close says once it happened, which is where the duplicate earns its extra words.
 *
 * "closed as a duplicate" answers less than half the question. The issue it duplicates is the
 * thing the reader will want to open next, and it is the one fact GitHub's own confirmation
 * leaves out of the sentence entirely.
 */
const sentenceFor = (settling: Settled): string =>
  settling.as === "duplicate"
    ? `This issue is closed as a duplicate of ${nameOf(settling.of)}`
    : `This issue is ${SETTLED[settling.as]}`

const READING = "Reading this issue…"

const UPDATED = "Issue updated"

/**
 * One issue, in one column.
 *
 * One rather than the pull request's two, because the second column there is
 * the code and an issue has none. What is left is the order anybody asks in:
 * what this is, what was written, what everyone said about it.
 */
export const IssueScreen = ({
  reference,
  load,
  preload,
  where,
  row,
  onStepAside,
  onUseGitHub,
  postRemark,
  suggest,
  onUpload,
  settle,
  reopen,
  recallRepositories,
  signedIn = viewerOnPage
}: IssueScreenProps) => {
  const live = useLive(load, preload, where)
  const { read } = live
  const waiting = useWaiting(read.status)
  useUpdated(live.catchingUp, read.status === "ready" ? read.value : undefined, UPDATED)

  /*
   * What the reader just said, held here until the next read carries it.
   *
   * The same trick the pull request's conversation plays, and it earns its
   * place the same way: an issue arrives in one request, so a comment posted a
   * moment ago is only on the screen because it was put there — and putting it
   * there beats reading the whole issue again to find one paragraph the reader
   * is already holding.
   */
  const [said, setSaid] = useState<ReadonlyArray<Remark>>([])

  /*
   * The state the reader just asked for, held over the one GitHub last said.
   *
   * The press moves the page and the request follows it, as a star does next door: closing
   * an issue is a decision the reader has already made, and a header that waits four hundred
   * milliseconds to agree reads as a header that did not hear. Put back where GitHub refuses,
   * which is the only honest thing an optimistic page can do with a no.
   */
  const [asked, setAsked] = useState<Shown | undefined>(undefined)

  const onSettle = useMemo(
    () =>
      settle === undefined
        ? undefined
        : (settling: Settled) => {
            const on = read.status === "ready" ? read.value.snapshot : undefined
            // Unreachable while the control is on the screen, which is only ever drawn over
            // an issue that has been read. Answered rather than asserted: this is a press.
            if (on === undefined) return Effect.void

            const was = shownOf(on)
            setAsked({ state: "closed", closing: Option.some(closingOf(settling)) })

            return settle(on.id, settling).pipe(
              Effect.map(() => {
                done(
                  sentenceFor(settling),
                  reopen === undefined
                    ? undefined
                    : {
                        said: "Undo",
                        go: () => {
                          setAsked({ state: "open", closing: Option.none() })
                          Effect.runFork(
                            reopen(on.id).pipe(
                              Effect.catch((cause) =>
                                Effect.sync(() => {
                                  setAsked(was)
                                  refused(reasonFor(cause))
                                })
                              )
                            )
                          )
                        }
                      }
                )
              }),
              Effect.catch((cause) =>
                Effect.sync(() => {
                  setAsked(was)
                  refused(reasonFor(cause))
                })
              )
            )
          },
    [read, reopen, settle]
  )

  const onReopen = useMemo(
    () =>
      reopen === undefined
        ? undefined
        : () => {
            const on = read.status === "ready" ? read.value.snapshot : undefined
            if (on === undefined) return Effect.void

            const was = shownOf(on)
            setAsked({ state: "open", closing: Option.none() })

            return reopen(on.id).pipe(
              Effect.map(() => done("This issue is open again")),
              Effect.catch((cause) =>
                Effect.sync(() => {
                  setAsked(was)
                  refused(reasonFor(cause))
                })
              )
            )
          },
    [read, reopen]
  )

  const onSay = useMemo(
    () =>
      postRemark === undefined
        ? undefined
        : (body: string) => {
            const on = read.status === "ready" ? read.value.snapshot : undefined
            // Unreachable while the box is on the screen, which is only drawn over an issue
            // that has been read. Answered rather than asserted: this is a press.
            if (on === undefined) return Effect.void

            return Effect.map(postRemark(on.id, body), (remark) =>
              setSaid((held) => [...held, remark])
            )
          },
    [postRemark, read]
  )

  if (read.status === "failed") {
    // Every route answers as though the page does not exist to a signed-out
    // reader on a private repository, which looks exactly like a payload that
    // changed shape. Blaming GitHub for an expired session sends the reader
    // looking for a bug where the fix is one link away.
    const out = !signedIn()

    return (
      // Its own padding as a card, and nothing more: the frame either side of it
      // is the shell's, the same one the panels stand in when the read works.
      <div className="Box my-2 p-4">
        <h2 className="mb-1 text-base font-semibold">
          {out ? "You are signed out of GitHub" : "This issue could not be read"}
        </h2>
        <p className="mb-3 max-w-prose text-sm text-ink-muted">
          {out
            ? "GitHub answers as if this issue does not exist while nobody is signed in. Sign in and open it again."
            : "Nothing is shown rather than part of it. GitHub's own issue is still here."}
        </p>
        {out ? (
          <a
            className="btn btn-sm btn-primary mr-2"
            href={`https://github.com/login?return_to=${encodeURIComponent(location.href)}`}
          >
            Sign in to GitHub
          </a>
        ) : null}
        <button type="button" className="btn btn-sm" onClick={onStepAside}>
          Show GitHub's issue
        </button>
      </div>
    )
  }

  const snapshot = read.status === "ready" ? read.value.snapshot : undefined

  return (
    <div className="relative">
      <TheBar
        where={{ kind: "repository", owner: reference.owner, repo: reference.repo }}
        recall={recallRepositories}
        onStepAside={onUseGitHub}
      />
      {/* The row's header, while nothing has been read and nothing was
          remembered. It goes the moment either lands, and it is the same panel
          in the same slot either way so that the title does not move. */}
      {snapshot === undefined && row !== undefined ? (
        <div className="t-panels flex flex-col pt-2">
          <ListedHeader one={row} />
        </div>
      ) : null}
      {snapshot === undefined ? null : (
        // No gutter of its own. This screen chose its own four for a while,
        // because their container runs the full width of the window and a card
        // flush to that edge reads as part of the browser — and so did five
        // other screens, each choosing again, none of them agreeing with the
        // bar above. `#gitquiet-root` insets every screen now.
        <div className="t-panels flex flex-col pt-2">
          <IssueHeader
            snapshot={asked === undefined ? snapshot : { ...snapshot, ...asked }}
            onSettle={onSettle}
            onReopen={onReopen}
          />
          <div className="flex flex-col gap-1.5 pb-2">
            <Description
              markdown={snapshot.description.markdown}
              owner={snapshot.reference.owner}
              repo={snapshot.reference.repo}
              foldable={false}
            />
            {/* No threads, ever: a thread hangs off a line of a diff and an
                issue has no lines. Every comment on one is a Remark, which is
                why this panel draws either page without knowing which it is on.

                The box to write in is offered only where GitHub says the reader
                may write. A locked issue, an archived repository and a
                signed-out reader all refuse the same way, and a box that throws
                when it is used is worse than no box. */}
            <Conversation
              threads={[]}
              subject="issue"
              remarks={[...snapshot.remarks, ...said]}
              viewer={Option.getOrUndefined(
                Option.map(snapshot.viewer, (person) => ({
                  login: person.login,
                  faceUrl: Option.getOrUndefined(person.faceUrl)
                }))
              )}
              keep={`issue:${nameOf(snapshot.reference)}`}
              suggest={suggest}
              onUpload={onUpload}
              onSay={snapshot.allowed.comment ? onSay : undefined}
            />
          </div>
        </div>
      )}
      {waiting ? (
        <Waiting
          what={READING}
          detail={`${reference.owner}/${reference.repo} #${reference.number}`}
          leaving={read.status === "ready"}
          /*
           * Under the header rather than over the window, where a row gave this
           * screen a header to draw. What is being read then is the description
           * and the conversation, and they land underneath: a wait centred on the
           * window would be centred on a title that has already arrived.
           *
           * Decided from the prop and not from what is drawn, so that the moment
           * the issue lands the wait dissolves where it stood instead of jumping
           * out of the flow first.
           */
          room={row === undefined ? "card" : "list"}
        />
      ) : null}
    </div>
  )
}
