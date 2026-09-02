import { useEffect, useMemo, useRef, useState } from "react"
import type { GistRow, Kind, Order } from "../domain/gistList"
import { sifted } from "../domain/gistList"
import { exported } from "../domain/gistExport"
import { everyLabelKnown, type KeptGists, labelsOf, nameOf } from "../domain/gistLabels"
import { GistRowView } from "./GistRowView"
import { TheBar } from "./TheBar"

/**
 * A reader's own gists — `gist.github.com/{owner}`.
 *
 * The one screen here that re-files nothing. Every other list in this interface earns its
 * place by answering a question GitHub's own page answers badly: a pull request filed by
 * what is owed rather than by object type, an inbox filed by Court. Nobody owes anything
 * on a gist, so there is no Court and this plan does not invent one — see
 * `plans/007-give-the-gists-a-screen.md`, which says so at length precisely so that
 * nobody later goes looking for the organizing idea this is missing.
 *
 * What it does instead is the four things `research/gist-pain-points.md` in the notes
 * repository found people building tools for, over a decade, because GitHub never did:
 * organize them, search them properly, read past page one, and say what Secret means.
 */

export type GistListScreenProps = {
  readonly rows: ReadonlyArray<GistRow>
  /**
   * Whose gists these are, which changes only the words.
   *
   * The starred list is somebody else's gists and this reader's Labels, and every
   * control on the screen means the same thing on both. What it must not do is call
   * them "your gists", which is the one sentence that would be wrong.
   */
  readonly whose: "own" | "starred"
  /** Whether every page of their list was read, or the walk stopped short. */
  readonly whole: boolean
  readonly kept: KeptGists
  readonly onChange: (id: string, labels: ReadonlyArray<string>, name: string | null) => void
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void
}

const KINDS: ReadonlyArray<readonly [Kind, string]> = [
  ["all", "All"],
  ["public", "Public"],
  ["secret", "Secret"]
]

/**
 * Their two orders are one order here, and four more they never had.
 *
 * "Recently created" is missing on purpose: their row prints one date and which date it
 * is depends on the sort their page was already serving, so honouring it would be a list
 * that silently reorders itself into a lie. See `Order` in `domain/gistList.ts`.
 */
const ORDERS: ReadonlyArray<readonly [Order, string]> = [
  ["updated", "Recently updated"],
  ["title", "Name"],
  ["stars", "Most starred"],
  ["forks", "Most forked"],
  ["comments", "Most discussed"]
]

export const GistListScreen = ({
  rows,
  whose,
  whole,
  kept,
  onChange,
  onStepAside
}: GistListScreenProps) => {
  const [query, setQuery] = useState("")
  const [kind, setKind] = useState<Kind>("all")
  const [order, setOrder] = useState<Order>("updated")
  const [picked, setPicked] = useState<ReadonlyArray<string>>([])
  const search = useRef<HTMLInputElement | null>(null)

  /*
   * `/` puts the caret in the search box, which is the shortcut GitHub had here and
   * removed in 2024 — "this change was in fact intentional... it wasn't being used very
   * much", GitHub Community #131464, against a reader in #140427 saying "it's such a
   * pain compared to how simple it was before". It costs one listener to give back.
   *
   * Not while the reader is already typing somewhere. A `/` meant for a filename, a
   * Label, or GitHub's own box is a `/`, and stealing it is worse than never having the
   * shortcut at all.
   */
  useEffect(() => {
    const heard = (event: KeyboardEvent): void => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return
      const on = event.target
      const typing =
        on instanceof HTMLElement &&
        (on.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(on.tagName))
      if (typing) return

      event.preventDefault()
      search.current?.focus()
      search.current?.select()
    }

    document.addEventListener("keydown", heard)
    return () => document.removeEventListener("keydown", heard)
  }, [])

  const known = useMemo(() => everyLabelKnown(kept), [kept])

  const shown = useMemo(
    () =>
      sifted(
        rows,
        { kind, order, query, labels: picked },
        (row) => [...labelsOf(kept, row.id), nameOf(kept, row.id) ?? ""].join(" "),
        (row) => labelsOf(kept, row.id)
      ),
    [rows, kind, order, query, picked, kept]
  )

  /**
   * Their list, written out as a file the reader keeps.
   *
   * GitHub's own account export does not include gist data, which is why "archive my
   * gists" is itself a genre of published script. This screen has already read every
   * page to search it, so the export is what it is holding, written down — plus the two
   * fields GitHub could never export because GitHub does not have them.
   *
   * Built and revoked here rather than held: an object URL that outlives the press is a
   * copy of the reader's whole list kept alive in the page for no reason.
   */
  const takeACopy = (): void => {
    const file = new Blob([JSON.stringify(exported(rows, kept, whole), null, 2)], {
      type: "application/json"
    })
    const at = URL.createObjectURL(file)
    const link = document.createElement("a")
    link.href = at
    link.download = `gists-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(at)
  }

  const toggle = (label: string): void =>
    setPicked((held) =>
      held.includes(label) ? held.filter((one) => one !== label) : [...held, label]
    )

  return (
    <>
      {/*
        `home`, because a gist list is nowhere in particular. The bar's other kind is
        `repository`, which wants an owner and a repo to draw tabs for, and a gist
        belongs to neither.
      */}
      <TheBar where={{ kind: "home" }} />
      {/*
        No frame of its own. The shell puts one inset on `#gitquiet-root` for every
        screen at once — see `widths.test.ts`, which measured two insets on five screens
        before that rule existed and now refuses a screen that grows a third.
      */}
      <div className="t-panels flex flex-col gap-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={whose === "own" ? "Search your gists" : "Search your starred gists"}
            placeholder={`Search ${
              whose === "own" ? "your gists" : "the gists you have starred"
            } — titles, descriptions, and the file content GitHub's own search does not read.  /`}
            className="h-8 min-w-64 grow rounded-md bg-raised px-3 text-sm"
          />
          <label className="sr-only" htmlFor="gist-kind">
            Type
          </label>
          <select
            id="gist-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value as Kind)}
            className="h-8 rounded-md bg-raised px-2 text-xs"
          >
            {KINDS.map(([value, words]) => (
              <option key={value} value={value}>
                {words}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="gist-order">
            Sort
          </label>
          <select
            id="gist-order"
            value={order}
            onChange={(event) => setOrder(event.target.value as Order)}
            className="h-8 rounded-md bg-raised px-2 text-xs"
          >
            {ORDERS.map(([value, words]) => (
              <option key={value} value={value}>
                {words}
              </option>
            ))}
          </select>
          {/* Parity: their header carries this and a reader arriving here still wants it. */}
          <a
            href="https://gist.github.com/"
            className="h-8 rounded-md bg-accent-emphasis px-3 text-xs leading-8 text-ink-on-emphasis"
          >
            New gist
          </a>
          <button
            type="button"
            onClick={takeACopy}
            disabled={rows.length === 0}
            className="h-8 rounded-md bg-surface px-3 text-xs disabled:opacity-50"
          >
            Export
          </button>
          <button
            type="button"
            onClick={onStepAside}
            className="h-8 rounded-md px-2 text-xs text-ink-muted hover:bg-hover"
          >
            Show GitHub&rsquo;s list
          </button>
        </div>

        {/*
          The folder GitHub never built, done without pretending a gist moved anywhere.
          Only drawn once a reader has written a Label, because a row of nothing is a
          control that teaches nobody what it is for.
        */}
        {known.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {known.map((label) => (
              <button
                key={label}
                type="button"
                aria-pressed={picked.includes(label)}
                onClick={() => toggle(label)}
                className={`h-6 rounded-full px-2 text-xs ${
                  picked.includes(label)
                    ? "bg-accent-emphasis text-ink-on-emphasis"
                    : "bg-raised text-ink-muted"
                }`}
              >
                {label}
              </button>
            ))}
            {picked.length > 0 ? (
              <button
                type="button"
                onClick={() => setPicked([])}
                className="h-6 px-2 text-xs text-ink-muted hover:bg-hover"
              >
                Clear
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="text-xs text-ink-muted">
          {shown.length === rows.length
            ? `${rows.length} ${whose === "starred" ? "starred " : ""}gist${
                rows.length === 1 ? "" : "s"
              }`
            : `${shown.length} of ${rows.length}`}
          {whole ? null : " · some older pages could not be read, so this list is short"}
        </p>

        {shown.length === 0 ? (
          <p className="py-6 text-sm text-ink-muted">
            Nothing here matches. The search reads titles, descriptions and the file
            content GitHub&rsquo;s own search skips, so a gist missing from this is a gist
            missing from the pages that were read.
          </p>
        ) : (
          shown.map((row) => (
            <GistRowView
              key={row.id}
              row={row}
              labels={labelsOf(kept, row.id)}
              name={nameOf(kept, row.id)}
              known={known}
              onChange={onChange}
            />
          ))
        )}
      </div>
    </>
  )
}
