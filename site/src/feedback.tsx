import "@fontsource-variable/inter"
import { useCallback, useEffect, useRef, useState } from "react"
import { mount } from "./mount"
import { QuoteCard } from "./QuoteCard"
import {
  Above,
  Footer,
  HELD,
  Nav,
  Press,
  Quietly,
  SkipTo,
  SOURCE_AT,
  Source
} from "./Shell"
import "./index.css"

/**
 * Public `/feedback` board: GitHub Issues as a quiet kanban.
 *
 * Read-only in the browser (no token). Create deep-links to GitHub's new-issue
 * form with a label prefilled. Issues stay the source of truth; this page is
 * the quieter entry, not a second tracker.
 */

const ISSUES_AT =
  "https://api.github.com/repos/flazouh/gitquiet/issues?state=all&per_page=100"

const ASKING = { Accept: "application/vnd.github+json" } as const

const NEW_BUG = `${SOURCE_AT}/issues/new?labels=bug`
const NEW_FEATURE = `${SOURCE_AT}/issues/new?labels=enhancement`

type LabelName = "bug" | "enhancement"

type Issue = {
  readonly number: number
  readonly title: string
  readonly html_url: string
  readonly state: "open" | "closed"
  readonly labels: ReadonlyArray<LabelName>
}

type Board = {
  readonly bugs: ReadonlyArray<Issue>
  readonly features: ReadonlyArray<Issue>
  readonly done: ReadonlyArray<Issue>
  readonly other: ReadonlyArray<Issue>
}

type Load =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly board: Board }
  | { readonly kind: "error"; readonly says: string }

const PRESS =
  "inline-flex items-center justify-center whitespace-nowrap rounded-md bg-ink px-4 py-2 text-[14px] font-semibold text-paper transition-[transform,background-color] duration-[var(--duration-press)] ease-out hover:bg-ink/85 active:scale-[var(--scale-press)] sm:px-5 sm:py-2.5 sm:text-[15px]"

const WORD =
  "inline-flex items-center rounded-md px-3 py-2 text-[14px] font-semibold text-ink/70 transition-[transform,color] duration-[var(--duration-press)] ease-out hover:text-ink active:scale-[var(--scale-press)] sm:px-3.5 sm:py-2.5 sm:text-[15px]"

const hasLabel = (issue: Issue, name: LabelName): boolean => issue.labels.includes(name)

const labelNames = (raw: unknown): ReadonlyArray<LabelName> => {
  if (!Array.isArray(raw)) return []
  const held: LabelName[] = []
  for (const entry of raw) {
    const name =
      typeof entry === "string"
        ? entry
        : typeof entry === "object" && entry !== null && "name" in entry
          ? String((entry as { readonly name: unknown }).name)
          : ""
    if (name === "bug" || name === "enhancement") held.push(name)
  }
  return held
}

const asIssue = (body: unknown): Issue | undefined => {
  if (typeof body !== "object" || body === null) return
  const row = body as Record<string, unknown>
  // GitHub's issues list includes pull requests; those carry this field.
  if ("pull_request" in row) return
  const number = row.number
  const title = row.title
  const html_url = row.html_url
  const state = row.state
  if (typeof number !== "number" || !Number.isInteger(number) || number < 1) return
  if (typeof title !== "string" || title.length === 0) return
  if (typeof html_url !== "string" || html_url.length === 0) return
  if (state !== "open" && state !== "closed") return
  return {
    number,
    title,
    html_url,
    state,
    labels: labelNames(row.labels)
  }
}

const intoBoard = (body: unknown): Board | undefined => {
  if (!Array.isArray(body)) return
  const bugs: Issue[] = []
  const features: Issue[] = []
  const done: Issue[] = []
  const other: Issue[] = []

  for (const row of body) {
    const issue = asIssue(row)
    if (issue === undefined) continue
    const bug = hasLabel(issue, "bug")
    const enhancement = hasLabel(issue, "enhancement")

    if (issue.state === "closed") {
      if (bug || enhancement) done.push(issue)
      continue
    }

    if (bug) bugs.push(issue)
    if (enhancement) features.push(issue)
    if (!bug && !enhancement) other.push(issue)
  }

  return { bugs, features, done, other }
}

const useBoard = (tick: number): Load => {
  const [load, setLoad] = useState<Load>({ kind: "loading" })

  useEffect(() => {
    let gone = false
    setLoad({ kind: "loading" })

    fetch(ISSUES_AT, { headers: ASKING })
      .then(async (response) => {
        if (response.status === 403 || response.status === 429) {
          return { kind: "error" as const, says: "GitHub asked us to wait. Try again in a minute." }
        }
        if (!response.ok) {
          return { kind: "error" as const, says: "Could not read issues. Try again." }
        }
        const body: unknown = await response.json()
        const board = intoBoard(body)
        if (board === undefined) {
          return { kind: "error" as const, says: "Could not read issues. Try again." }
        }
        return { kind: "ready" as const, board }
      })
      .then((next) => {
        if (!gone) setLoad(next)
      })
      .catch(() => {
        if (!gone) setLoad({ kind: "error", says: "Could not read issues. Try again." })
      })

    return () => {
      gone = true
    }
  }, [tick])

  return load
}

const Chip = ({ name }: { readonly name: LabelName }) => (
  <span className="rounded-md bg-ink/6 px-1.5 py-0.5 text-[11px] font-medium text-ink/60">
    {name}
  </span>
)

const Card = ({ issue }: { readonly issue: Issue }) => (
  <QuoteCard className="gap-3 !p-4">
    <a
      href={issue.html_url}
      target="_blank"
      rel="noreferrer"
      className="m-0 text-[15px] font-semibold leading-snug text-ink transition-opacity duration-[var(--duration-press)] ease-out hover:opacity-80"
    >
      {issue.title}
    </a>
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] tabular text-muted">#{issue.number}</span>
      {issue.labels.map((name) => (
        <Chip key={name} name={name} />
      ))}
    </div>
  </QuoteCard>
)

const Column = ({
  name,
  issues,
  muted = false
}: {
  readonly name: string
  readonly issues: ReadonlyArray<Issue>
  readonly muted?: boolean
}) => (
  <section className="flex min-w-0 flex-col gap-3">
    <header className="flex items-baseline justify-between gap-2">
      <h2
        className={`m-0 text-[15px] font-semibold tracking-[-0.01em] ${
          muted ? "text-muted" : "text-ink"
        }`}
      >
        {name}
      </h2>
      <span className={`text-[13px] tabular ${muted ? "text-muted/70" : "text-muted"}`}>
        {issues.length}
      </span>
    </header>
    {issues.length === 0 ? (
      <p className="m-0 text-[13px] leading-relaxed text-muted">Nothing here.</p>
    ) : (
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {issues.map((issue) => (
          <li key={issue.number}>
            <Card issue={issue} />
          </li>
        ))}
      </ul>
    )}
  </section>
)

const NewModal = ({
  open,
  onClose
}: {
  readonly open: boolean
  readonly onClose: () => void
}) => {
  const frame = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const box = frame.current
    if (box === null) return
    if (open) {
      if (!box.open) box.showModal()
    } else if (box.open) {
      box.close()
    }
  }, [open])

  return (
    <dialog
      ref={frame}
      onClose={onClose}
      className="m-auto w-[min(100%,22rem)] rounded-md border-0 bg-paper p-0 text-ink shadow-[0_1px_2px_rgba(27,23,37,0.04),0_14px_36px_-18px_rgba(27,23,37,0.14)] backdrop:bg-ink/30"
    >
      <QuoteCard className="gap-5 !shadow-none">
        <div>
          <h2 className="m-0 text-[18px] font-semibold tracking-[-0.02em]">New</h2>
          <p className="m-0 mt-2 text-[14px] leading-relaxed text-muted">Opens on GitHub</p>
        </div>
        <div className="flex flex-col gap-3">
          <Press at={NEW_BUG}>Report a bug</Press>
          <Press at={NEW_FEATURE}>Request a feature</Press>
        </div>
        <button type="button" className={WORD} onClick={onClose}>
          Dismiss
        </button>
      </QuoteCard>
    </dialog>
  )
}

const BoardView = ({ board }: { readonly board: Board }) => (
  <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-4">
    <Column name="Bugs" issues={board.bugs} />
    <Column name="Features" issues={board.features} />
    <Column name="Done" issues={board.done} />
    <Column name="Other" issues={board.other} muted />
  </div>
)

const Feedback = () => {
  const [tick, setTick] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const load = useBoard(tick)
  const retry = useCallback(() => setTick((n) => n + 1), [])

  return (
    <>
      <SkipTo id="board" says="Skip to the board" />

      <Above>
        <Nav>
          <Source />
          <button type="button" className={PRESS} onClick={() => setNewOpen(true)}>
            New
          </button>
        </Nav>

        <div className="flex items-end justify-between gap-6 pb-16 pt-10 sm:pt-16">
          <div>
            <h1 className="m-0 max-w-3xl text-balance text-[clamp(2.1rem,5.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
              Feedback
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">
              Bugs and features for GitQuiet.
            </p>
          </div>
        </div>
      </Above>

      {/*
        A `div`, not `<main>`: `feedback.html` clips `#page > main` for the crawler
        first paint, and that rule still matches a React `<main>` after mount — which
        hid the board and the rate-limit error while Nav/Footer stayed visible.
      */}
      <div id="board" role="main" className={`${HELD} pb-16`}>
        {load.kind === "loading" ? (
          <p className="m-0 text-[15px] text-muted">Reading issues…</p>
        ) : null}

        {load.kind === "error" ? (
          <p
            className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[15px] text-ink/70"
            role="alert"
          >
            <span>{load.says}</span>
            <button type="button" className={WORD} onClick={retry}>
              Retry
            </button>
          </p>
        ) : null}

        {load.kind === "ready" ? <BoardView board={load.board} /> : null}

        <section className="mt-16 border-t border-rule pt-10">
          <p className="m-0 max-w-2xl text-pretty text-[15px] leading-relaxed text-muted">
            Issues stay on{" "}
            <Quietly at={`${SOURCE_AT}/issues`}>GitHub</Quietly>
            . This board is a quieter read.
          </p>
        </section>
      </div>

      <div className={HELD}>
        <Footer />
      </div>

      <NewModal open={newOpen} onClose={() => setNewOpen(false)} />
    </>
  )
}

mount("page", <Feedback />)
