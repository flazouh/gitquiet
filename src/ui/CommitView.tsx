import { Effect, Option } from "effect"
import { useEffect, useState } from "react"
import type { DiffFetcher } from "../domain/library"
import type { CommitDetail } from "../domain/PullRequest"
import type { Profile } from "../keys/commands"
import type { DiffChoices, TreeChoices } from "../domain/choices"
import { useArt } from "./art"
import { FileBrowser } from "./FileBrowser"
import { GitHubHtml } from "./GitHubHtml"
import { useFreshening } from "./useFreshening"
import { ageOf, momentOf } from "./when"
import { Who } from "./Who"

export type CommitViewProps = {
  readonly sha: string
  readonly load: (sha: string) => Effect.Effect<CommitDetail, unknown>
  /** What has already been read, so a second look does not flash a spinner. */
  readonly held?: (sha: string) => CommitDetail | undefined
  /**
   * The commit as the store has it, painted while the live read is in the air.
   *
   * Beside `held` and not instead of it: `held` is this document's own memory and answers at
   * once, this is the last visit's and answers a storage read later. What comes back has the
   * message, the author and every file name without the diffs behind them, so the header and
   * the tree are on the screen while the file being looked at is read.
   */
  readonly preload?: (sha: string) => Effect.Effect<Option.Option<CommitDetail>>
  /**
   * The way back to the whole branch, on the pull request where there is one.
   *
   * Absent on GitHub's own page for a commit, which is about this commit and
   * nothing else: there is no file browser behind it to return to, and a button
   * offering one would lead somewhere the reader has never been.
   */
  readonly onClose?: () => void
  /**
   * Content for a file this commit arrived without, fetched when it is opened.
   *
   * GitHub embeds diffs until it has spent a byte budget and sends every file
   * after that as a name, so a commit of any size arrives part-read: this is the
   * ordinary case rather than an edge of it. Absent where there is nothing to go
   * back for, which is a test and a commit small enough to have come whole.
   */
  readonly fetchDiffs?: DiffFetcher
  readonly diff: DiffChoices
  readonly tree: TreeChoices
  /**
   * Drawn as two panels rather than one: what the commit is, then what it
   * changed, with the gap between them every other pair on this interface has.
   *
   * For the page that is only about this commit. Inside a pull request the
   * commit stands where the branch's file browser was and has to be the same
   * single panel, or opening one makes the page jump.
   */
  readonly apart?: boolean
  readonly proseAsDocument?: boolean
  /** Whose keys move between the files of this commit. */
  readonly keys?: Profile
}

/**
 * The sentence over a commit that came out of the store.
 *
 * A landed commit does not change, so this is the most honest of these sentences and the
 * shortest-lived: what the read behind it adds is the diffs, not a different commit.
 */
const CHECKING = "Checking this commit…"

type Reading =
  | { readonly step: "loading" }
  | { readonly step: "ready"; readonly commit: CommitDetail }
  | { readonly step: "failed"; readonly said: string }

/**
 * One commit, read the way the whole branch is read.
 *
 * Not a page of its own and not a dialog: it takes the same half of the screen
 * the branch's files were in, so the pull request — its description, its CI,
 * its conversation — is still beside it. Everything below the header is the
 * same file browser, which means the tree, the diff and every setting over them
 * behave here exactly as they do there, because they are the same code.
 */
export const CommitView = ({
  sha,
  load,
  held,
  preload,
  onClose,
  fetchDiffs = NOTHING_HELD_BACK,
  apart = false,
  diff,
  tree,
  proseAsDocument,
  keys
}: CommitViewProps) => {
  const art = useArt()
  const Back = art.back

  // Straight to the commit when it is already in hand. Going through loading
  // first would put a spinner between a click and a thing that was sitting in
  // memory, which reads as slower than not having cached it at all.
  const already = held?.(sha)
  const [reading, setReading] = useState<Reading>(
    already === undefined ? { step: "loading" } : { step: "ready", commit: already }
  )

  /*
   * Whether what is on the screen is a memory with a live read still running behind it.
   *
   * The same bit `useLive` hands the lists, arrived at the long way round because this
   * component has been following a sha of its own since before that hook existed. What says
   * it out loud is `useFreshening` below.
   */
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    const inHand = held?.(sha)
    if (inHand !== undefined) {
      setReading({ step: "ready", commit: inHand })
      setChecking(false)
      return
    }

    setReading({ step: "loading" })

    let landed = false

    /*
     * The store, asked in parallel with GitHub rather than before it.
     *
     * Painted only while the live read has nothing to show, and never over it: a memory
     * landing on top of the answer is a page going backwards, and the memory here is a
     * commit without its diffs.
     */
    const recalling =
      preload === undefined
        ? null
        : Effect.runFork(
            preload(sha).pipe(
              Effect.match({
                onSuccess: (was) => {
                  if (landed || Option.isNone(was)) return
                  setReading({ step: "ready", commit: was.value })
                  setChecking(true)
                },
                onFailure: () => {}
              })
            )
          )

    const asking = Effect.runFork(
      load(sha).pipe(
        Effect.match({
          onSuccess: (commit) => {
            landed = true
            setReading({ step: "ready", commit })
            setChecking(false)
          },
          onFailure: (cause) => {
            landed = true
            setChecking(false)
            setReading({ step: "failed", said: saidBy(cause) })
          }
        })
      )
    )

    // The reader can open another commit before this one arrives, and the
    // answer to a commit nobody is looking at any more must not land on screen.
    return () => {
      recalling?.interruptUnsafe()
      asking.interruptUnsafe()
    }
  }, [held, load, preload, sha])

  useFreshening(checking, CHECKING)

  const meta = (
    <div className="flex items-center gap-2 bg-surface px-3 py-2">
      {onClose === undefined ? null : (
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink"
        >
          <Back size={12} />
          All changes
        </button>
      )}
      {reading.step === "ready" ? (
        <>
          <Who
            login={reading.commit.author}
            src={Option.getOrUndefined(reading.commit.avatarUrl)}
          />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            {reading.commit.headline}
          </span>
          <span
            title={momentOf(reading.commit.createdAt)}
            className="shrink-0 text-xs text-ink-muted tabular-nums"
          >
            {ageOf(reading.commit.createdAt)}
          </span>
          <code className="shrink-0 font-mono text-xs text-ink-muted">
            {reading.commit.abbreviatedSha}
          </code>
        </>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
          {reading.step === "loading" ? "Reading the commit…" : reading.said}
        </span>
      )}
    </div>
  )

  // The rest of the message, when the author wrote one. Kept short: a commit
  // body is context for the diff below it, not the thing itself.
  const body =
    reading.step === "ready" && Option.isSome(reading.commit.bodyHtml) ? (
      <div className="max-h-32 overflow-y-auto px-3 py-2">
        <GitHubHtml html={reading.commit.bodyHtml.value} />
      </div>
    ) : null

  const files =
    reading.step === "ready" ? (
      <FileBrowser
        // A different commit is a different set of files, and the browser
        // holds which one is open and which have been seen. Those belong to
        // the commit being read, not to the panel.
        key={reading.commit.sha}
        files={reading.commit.files}
        fetchDiffs={fetchDiffs}
        diff={diff}
        tree={tree}
        proseAsDocument={proseAsDocument}
        keys={keys}
      />
    ) : (
      <div className="flex flex-1 items-center justify-center text-xs text-ink-muted">
        {reading.step === "loading" ? "Reading the commit…" : "That commit could not be read."}
      </div>
    )

  // Two panels on the page of its own, one panel inside a pull request.
  //
  // Beside a pull request this is standing in for the branch's file browser and
  // has to be the same object as the thing it replaced — one panel, filling the
  // same half of the screen. On its own page there is nothing to match, and what
  // the commit is sits above what it changed exactly as the pull request's own
  // header sits above its files: a card, a gap, the work.
  if (!apart) {
    return (
      <section
        aria-label="Commit"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-canvas"
      >
        {/* What the commit is, what it says, then what it touched. Held apart by a
            gap and a padded fill rather than by two rules across the panel: three
            things stacked with air between them read as three things. */}
        <div className="flex flex-col gap-1.5 p-1.5">
          <div className="rounded-md bg-surface">{meta}</div>
          {body === null ? null : <div className="rounded-md bg-surface">{body}</div>}
        </div>
        {files}
      </section>
    )
  }

  return (
    <section aria-label="Commit" className="flex min-h-0 flex-1 flex-col">
      <header className="mb-1.5 shrink-0 rounded-md bg-surface p-1">
        {meta}
        {body === null ? null : <div className="rounded-md bg-inset">{body}</div>}
      </header>
      {reading.step === "ready" ? (
        files
      ) : (
        // The browser draws its own panel; what stands in for it while the
        // commit is being read has to be given one, or the page is a card and
        // then a sentence lying on the background.
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md bg-canvas">
          {files}
        </div>
      )}
    </section>
  )
}

/**
 * What went wrong, out of whatever the failure arrived wrapped in.
 *
 * The gateway's error carries the route and the reason it gave up on it, and
 * both of those are the difference between a reader knowing GitHub refused and
 * a reader looking at the word "GatewayError".
 */
const saidBy = (cause: unknown): string => {
  const failure = cause as { route?: unknown; reason?: unknown; detail?: unknown }
  const detail = typeof failure?.detail === "string" ? failure.detail : undefined
  const reason = typeof failure?.reason === "string" ? failure.reason : undefined
  if (detail === undefined && reason === undefined) return String(cause)

  return [reason, detail].filter((part) => part !== undefined).join(": ")
}

/** For a commit whose files all arrived, and for anything not wired to GitHub. */
const NOTHING_HELD_BACK = () => Effect.succeed([])
