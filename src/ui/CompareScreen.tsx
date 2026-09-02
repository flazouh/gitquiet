import { useMemo, useRef, useState } from "react"
import type { Changed, Comparing } from "../domain/compare"
import { TheBar } from "./TheBar"
import { useSlashFocuses } from "./useSlashFocuses"

/**
 * Two refs, and what stands between them — `/{owner}/{repo}/compare/{base}...{head}`.
 *
 * How a pull request starts, and the fourth page in `research/pages-to-replace.md` in
 * the notes repository. It earns its place here on one complaint, Community #165765:
 * "GitHub's `/compare` page does not support filtering by path. That means when there a
 * lot of changes in the other projects it gets very hard to read the comparison."
 *
 * So this is the file list first, filtered by path, with every count on it — and their
 * own anchors kept, so the diff of any one file is still one press away on the page
 * this screen is standing in front of. It does not draw the hunks. Their fragment
 * renders a handful of files and defers the rest, and a screen that fetched every hunk
 * to show a list would be paying the whole cost of the page it replaced.
 *
 * See `plans/008-the-two-pages-left.md`.
 */

export type CompareScreenProps = {
  readonly comparing: Comparing
  readonly changed: ReadonlyArray<Changed>
  /** Whether their fragment has answered yet. */
  readonly reading: boolean
  readonly failed: boolean
  /** Restores GitHub's own comparison, which is still on the page behind this. */
  readonly onStepAside: () => void
}

const KIND_WORDS: Readonly<Record<Changed["kind"], string>> = {
  added: "added",
  removed: "removed",
  renamed: "renamed",
  modified: "changed"
}

export const CompareScreen = ({
  comparing,
  changed,
  reading,
  failed,
  onStepAside
}: CompareScreenProps) => {
  const [query, setQuery] = useState("")
  const box = useRef<HTMLInputElement | null>(null)

  // On a page whose whole reason to exist is filtering by path, a reader should not
  // have to reach for the mouse to start.
  useSlashFocuses(box)

  const shown = useMemo(() => {
    const asked = query.trim().toLowerCase()
    return asked === ""
      ? changed
      : changed.filter((one) => one.path.toLowerCase().includes(asked))
  }, [changed, query])

  const totals = useMemo(
    () =>
      shown.reduce(
        (held, one) => ({
          added: held.added + one.added,
          deleted: held.deleted + one.deleted
        }),
        { added: 0, deleted: 0 }
      ),
    [shown]
  )

  return (
    <>
      <TheBar where={{ kind: "home" }} />
      <div className="t-panels flex flex-col gap-3 py-3">
        <div className="rounded-md bg-raised p-3">
          <h1 className="text-sm">
            <span className="text-ink-muted">
              {comparing.repo.owner}/{comparing.repo.repo}
            </span>{" "}
            <span className="font-semibold">{comparing.base}</span>
            <span className="text-ink-muted"> … </span>
            <span className="font-semibold">{comparing.head}</span>
          </h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              ref={box}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Filter by path"
              placeholder="Filter by path — the thing their compare page has never had.  /"
              className="h-8 min-w-64 grow rounded-md bg-hover px-3 text-sm"
            />
            <button
              type="button"
              onClick={onStepAside}
              className="h-8 rounded-md px-2 text-xs text-ink-muted hover:bg-hover"
            >
              Show GitHub&rsquo;s comparison
            </button>
          </div>

          <p className="mt-2 text-xs text-ink-muted">
            {reading
              ? "Reading what changed…"
              : failed
                ? "Their file list could not be read."
                : `${shown.length}${
                    shown.length === changed.length ? "" : ` of ${changed.length}`
                  } file${shown.length === 1 ? "" : "s"} · +${totals.added} −${totals.deleted}`}
          </p>
        </div>

        {shown.length === 0 && !reading && !failed ? (
          <p className="py-6 text-sm text-ink-muted">
            {changed.length === 0
              ? "Nothing changed between these two."
              : "No path here matches."}
          </p>
        ) : null}

        {shown.map((one) => (
          <div
            key={one.path}
            className="flex flex-wrap items-baseline gap-3 rounded-md bg-raised px-3 py-2"
          >
            {/*
              Their own anchor, kept. This screen lists what changed and does not draw
              the hunks, so the way to read one file is still their diff of it — which
              is on the page standing behind this one.
            */}
            <a
              href={one.anchor ?? undefined}
              className="grow truncate text-sm hover:underline"
              title={one.path}
            >
              {one.path}
            </a>
            <span className="text-xs text-ink-muted">{KIND_WORDS[one.kind]}</span>
            {one.added === 0 ? null : (
              <span className="text-xs text-pass">+{one.added}</span>
            )}
            {one.deleted === 0 ? null : (
              <span className="text-xs text-fail">−{one.deleted}</span>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
