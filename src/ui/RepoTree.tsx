import { Effect, Option } from "effect"
import { useEffect, useMemo, useRef, useState } from "react"
import { inReadingOrder, type Entry, type Kind, type Touch } from "../domain/repoHome"
import type { Chord } from "../keys/commands"
import { useArt } from "./art"
import { Cap } from "./Cap"
import { FIELD, HERE } from "./dress"
import { mountSprite } from "./FileHeading"
import { materialIcon } from "./fileIcon"
import { useSlice } from "./slice"
import { useSettings } from "./useSettings"
import { Who } from "./Who"
import { ageOf, freshnessOf, momentOf } from "./when"
import { onward } from "@/observability/report"

export type RepoTreeProps = {
  readonly entries: ReadonlyArray<Entry>
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly branch: string
  /** The commit the tree is read at. Their route refuses a branch name. */
  readonly head: string
  /** Every path in the repository. Absent until it lands, and absent if it fails. */
  readonly loadPaths?: (sha: string) => Effect.Effect<ReadonlyArray<string>, unknown>
  /**
   * Last commits under one folder, for the column beside nested rows.
   *
   * The root column is already on `entries`. This is asked when a folder opens,
   * and again for each folder a hunt reveals, because their route answers one
   * directory at a time.
   *
   * `partly` is the messages and the dates, which are one request. The answer is
   * the same column with its faces, which are one request per unique commit
   * behind it — so a folder drawn only from the answer is a folder whose column
   * waits on avatars it does not need.
   */
  readonly loadTouches?: (
    sha: string,
    folder: string,
    partly: (touches: ReadonlyMap<string, Touch>) => void
  ) => Effect.Effect<ReadonlyMap<string, Touch>, unknown>
  /** A file was pressed. The pane beside the tree shows it. */
  readonly onOpen: (path: string) => void
  /**
   * Opens Go to File, which is where finding a file by name lives now.
   *
   * Absent where nothing can open one, and then the tree has no such control —
   * rather than one that opens nothing, which is the offer this interface cannot
   * keep and the reader is the last to find out about.
   */
  readonly onFind?: () => void
  /** The chord that does the same, for the cap on it. Off the same table the key is on. */
  readonly finding?: Chord | null
  /**
   * Every path, once it has landed, for whatever else on the page wants them.
   *
   * The tree is the one thing here that needs the whole list — six hundred
   * kilobytes on a large repository — and Go to File needs exactly the same
   * list. Said out loud rather than read twice: two components asking the same
   * route is two answers that can differ and one download nobody needed.
   */
  readonly onPaths?: (paths: ReadonlyArray<string>) => void
  /** The pointer is resting on a file. Read it now, so the press costs nothing. */
  readonly onNear?: (path: string) => void
  /** The file that pane is showing, so the row for it is marked as chosen. */
  readonly reading: string | null
  /** Frozen in tests, so a colour for "today" does not depend on the clock. */
  readonly now?: Date
}

/**
 * Reports the file the pointer settles on, and never the ones it passes over.
 *
 * One timer, and it belongs to a path rather than to an event. A pointer that
 * drifts a few pixels inside one row would otherwise reset its own timer for as
 * long as it kept drifting and never report the row it was sitting on.
 */
const useDwell = (onNear: ((path: string) => void) | undefined) => {
  const waiting = useRef<number | undefined>(undefined)
  const on = useRef<string | null>(null)

  useEffect(() => () => window.clearTimeout(waiting.current), [])

  return (event: PointerEvent): void => {
    if (onNear === undefined) return

    const path = fileUnder(event)
    if (path === on.current) return

    window.clearTimeout(waiting.current)
    on.current = path
    if (path === null) return

    waiting.current = window.setTimeout(() => onNear(path), DWELL)
  }
}

/**
 * How long the pointer has to rest on a row before the file behind it is read.
 *
 * A pointer crossing the list on its way somewhere else passes over a dozen rows,
 * and reading all twelve is twelve requests nobody asked for.
 *
 * The same figure the shell spends on a link, though it is spent differently: the
 * shell adds up time in and around a link and this waits for a rest, because a row
 * here is a row of a tree the reader is already inside and the pointer arrives at
 * it from the row above rather than from across the page. See `ui/lingering.ts`.
 */
const DWELL = 150

/** One visible row of the tree, as the list draws it. */
export type Shown = {
  readonly path: string
  readonly name: string
  readonly kind: Kind
  readonly depth: number
  readonly open: boolean
  readonly touched: Option.Option<Touch>
}

export type ShownOf = {
  readonly entries: ReadonlyArray<Entry>
  /** Every file path in the repository. Absent until it lands. */
  readonly whole?: ReadonlyArray<string>
  readonly opened: ReadonlySet<string>
  /** Last commits for nested rows, keyed by path. Root rows already carry theirs. */
  readonly touches?: ReadonlyMap<string, Touch>
}

const touchesOn = (entries: ReadonlyArray<Entry>): ReadonlyMap<string, Touch> => {
  const touches = new Map<string, Touch>()
  for (const entry of entries) {
    const touch = Option.getOrUndefined(entry.touched)
    if (touch !== undefined) touches.set(entry.path, touch)
  }
  return touches
}

/**
 * The files and folders directly under one folder, taken from the whole tree.
 *
 * Directories are prefixes of file paths, because the list GitHub sends is files
 * only. A trailing slash left on a path is ignored, so a list written the old
 * way still opens.
 */
const childrenOf = (
  folder: string,
  files: ReadonlyArray<string>,
  touches: ReadonlyMap<string, Touch>
): ReadonlyArray<Entry> => {
  const prefix = `${folder}/`
  const names = new Map<string, Kind>()
  for (const file of files) {
    if (!file.startsWith(prefix)) continue
    const rest = file.slice(prefix.length).replace(/\/$/, "")
    if (rest === "") continue
    const slash = rest.indexOf("/")
    if (slash === -1) {
      if (names.get(rest) !== "directory") names.set(rest, "file")
    } else {
      names.set(rest.slice(0, slash), "directory")
    }
  }
  return inReadingOrder(
    [...names].map(([name, kind]) => {
      const path = `${folder}/${name}`
      return {
        name,
        path,
        kind,
        touched: Option.fromNullishOr(touches.get(path))
      }
    })
  )
}

/**
 * The rows the list should draw, from the root, the opened folders, and the hunt.
 *
 * The root comes from `entries` at once. Nested rows come from `whole` when it
 * has landed; until then an opened folder shows no children, which is the same
 * bargain the commit column makes.
 */
export const shownOf = ({
  entries,
  whole,
  opened,
  touches: extra
}: ShownOf): ReadonlyArray<Shown> => {
  const touches = new Map(touchesOn(entries))
  if (extra !== undefined) {
    for (const [path, touch] of extra) touches.set(path, touch)
  }
  const walk = (nodes: ReadonlyArray<Entry>, depth: number): Array<Shown> => {
    const rows: Array<Shown> = []
    for (const node of nodes) {
      const open = node.kind === "directory" && opened.has(node.path)
      rows.push({
        path: node.path,
        name: node.name,
        kind: node.kind,
        depth,
        open,
        touched: node.touched
      })
      if (open && whole !== undefined) {
        rows.push(...walk(childrenOf(node.path, whole, touches), depth + 1))
      }
    }
    return rows
  }

  return walk(entries, 0)
}

/**
 * The file a pointer event happened over, or nothing where it was not over one.
 *
 * Read from the composed path rather than from the target, so a move over the
 * commit lane still names the file. A directory is not a file and there is
 * nothing to read for it.
 */
export const fileUnder = (event: PointerEvent): string | null => {
  for (const step of event.composedPath()) {
    if (!(step instanceof HTMLElement)) continue
    const { path, kind } = step.dataset
    if (path === undefined) continue
    return kind === "directory" || path.endsWith("/") ? null : path
  }
  return null
}

const Mark = ({
  path,
  kind,
  icons
}: {
  readonly path: string
  readonly kind: Kind
  readonly icons: "material" | "plain"
}) => {
  const art = useArt()
  const Folder = art.files
  const File = art.file

  if (kind === "directory") {
    return <Folder size={16} className="shrink-0 text-ink-muted" />
  }

  if (icons === "material") {
    const icon = materialIcon(path)
    return (
      <svg
        aria-hidden
        viewBox={icon.viewBox}
        className="h-4 w-4 shrink-0"
        xmlns="http://www.w3.org/2000/svg"
      >
        <use href={`#${icon.name}`} />
      </svg>
    )
  }

  return <File size={16} className="shrink-0 text-ink-muted" />
}

const Commit = ({
  touch,
  now
}: {
  readonly touch: Option.Option<Touch>
  readonly now: Date
}) =>
  Option.match(touch, {
    onNone: () => <span className="min-w-0" />,
    onSome: (one) => {
      const who = Option.getOrUndefined(one.who)
      return (
        <a
          href={one.url}
          className={`group flex min-w-0 items-center gap-2 text-xs no-underline ${freshnessOf(one.at, now)}`}
        >
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
            {who === undefined ? null : (
              <Who login={who.login} src={Option.getOrUndefined(who.face)} size={16} />
            )}
          </span>
          {/*
           * The underline is on the words and carries a `!`, which is two
           * deliberate choices rather than one. GitHub ships a `.no-underline` of
           * its own with `!important` in it, and this link wears that class name,
           * so a plain `hover:underline` on it draws nothing at all — measured on
           * their own repository page. And the message is what a reader reaches
           * for, so the line belongs under the words wherever in the row the
           * pointer entered.
           */}
          <span className="min-w-0 truncate group-hover:!underline" title={one.said}>
            {one.said}
          </span>
          <span className="shrink-0 tabular-nums" title={momentOf(one.at)}>
            {ageOf(one.at, now)}
          </span>
        </a>
      )
    }
  })

/**
 * The repository, as a tree a reader can open.
 *
 * Drawn twice. The root directory is in the page payload and goes up
 * immediately; every path in the repository is six hundred kilobytes on a large
 * one, and folds in behind it when it lands. A reader who never opens a folder
 * never waits for any of it, and one who opens the first folder before it lands
 * finds it a moment later — which is the same bargain the commit column makes.
 *
 * A file opens in the pane beside the tree rather than on GitHub's page for it.
 * That is the whole reason this page claims the blob address: a reader following
 * a repository through four files should keep the tree, the README's place and
 * their scroll position, and lose all three on every press if the file were
 * theirs to show.
 */
export const RepoTree = ({
  entries,
  head,
  loadPaths,
  loadTouches,
  onOpen,
  onNear,
  onPaths,
  onFind,
  finding = null,
  reading,
  now = new Date()
}: RepoTreeProps) => {
  const { settings } = useSettings()
  const icons = settings.tree.icons
  const art = useArt()
  const Chevron = art["chevron-right"]
  const Search = art["search"]
  const [whole, setWhole] = useState<ReadonlyArray<string> | undefined>(undefined)
  // Through a ref, because a parent writes this inline and a new function every
  // render would read the whole list again on every render.
  const told = useRef(onPaths)
  told.current = onPaths
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set())
  const [extra, setExtra] = useState<ReadonlyMap<string, Touch>>(() => new Map())
  const asked = useRef(new Set<string>())
  /*
   * The tree a folder's column is allowed to land on, and whether it is still up.
   *
   * Neither belongs to the effect that starts the read. That effect runs again on
   * every redraw, and the first stage of the read is itself a redraw — so a read
   * cancelled by its own effect running again is a read that stages its messages
   * and then throws its faces away.
   */
  const at = useRef(head)
  const living = useRef(true)

  useEffect(
    () => () => {
      living.current = false
    },
    []
  )

  useEffect(() => {
    if (icons === "material") mountSprite(document)
  }, [icons])

  useEffect(() => {
    if (loadPaths === undefined) return
    let watching = true

    void Effect.runPromise(
      loadPaths(head).pipe(
        Effect.map((paths) => {
          if (!watching) return
          setWhole(paths)
          told.current?.(paths)
        }),
        // The root is on the screen and is not wrong, only shallow. There is
        // nothing here worth an error message over.
        Effect.catch(onward)
      )
    )

    return () => {
      watching = false
    }
  }, [loadPaths, head])

  const rows = useMemo(
    () => shownOf({ entries, whole, opened, touches: extra }),
    [entries, whole, opened, extra]
  )

  /*
   * Only the rows in front of the reader are drawn. Four folders open on a large
   * repository is a few thousand of them, and each one is a grid, two icons, a
   * link and three spans — see `slice.ts` for the two spacers that stand in for
   * the rest and keep the scrollbar where it was.
   */
  const { frame, slice, onScroll } = useSlice(rows.length)

  useEffect(() => {
    at.current = head
    asked.current = new Set()
    setExtra(new Map())
  }, [head])

  useEffect(() => {
    if (loadTouches === undefined) return

    /** A column, onto the tree that asked for it. Nothing, once that tree is gone. */
    const fold =
      (was: string) =>
      (found: ReadonlyMap<string, Touch>): void => {
        if (!living.current || at.current !== was) return
        setExtra((have) => {
          const next = new Map(have)
          for (const [path, touch] of found) next.set(path, touch)
          return next
        })
      }

    for (const row of rows) {
      /*
       * Pressed, and not merely shown open. A hunt opens every folder holding a
       * match, and a column for each of those is one request per folder revealed
       * on every keystroke — several hundred on a large repository, for a reader
       * who is reading names. The folders they pressed keep the columns they
       * already have.
       */
      if (row.kind !== "directory" || !opened.has(row.path)) continue
      if (asked.current.has(row.path)) continue
      asked.current.add(row.path)

      const onto = fold(head)
      void Effect.runPromise(
        loadTouches(head, row.path, onto).pipe(
          Effect.map(onto),
          // Forgotten rather than remembered as answered, so the next press asks
          // again. A column is worth one attempt, and a dropped connection is
          // not a reason to leave a folder blank for the rest of the visit.
          Effect.catch(() =>
            Effect.sync(() => {
              asked.current.delete(row.path)
            })
          )
        )
      )
    }
  }, [rows, opened, loadTouches, head])

  const toggle = (path: string): void => {
    setOpened((was) => {
      const next = new Set(was)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const resting = useDwell(onNear)

  if (entries.length === 0) return null

  return (
    <>
      {onFind === undefined ? null : (
        /*
         * The way to a file by name, and no longer a filter over this tree.
         *
         * There were two of these: a field that narrowed the tree in place, and
         * Go to File, which ranks every path in the repository and opens the one
         * chosen. Two ways to do one thing, and the weaker one was the one with a
         * box on the screen — it could only match a substring, it could only
         * reach what this tree holds, and it left the reader to find the row
         * afterwards.
         *
         * So the box stays and what it does changes. It stays because it is the
         * only thing on the page that says this can be done at all: GitHub's own
         * repository page has a Go to file control, a key with nothing to show
         * for it is a key nobody presses, and `docs/spec/repo-home.md` is built
         * on the argument that what a reader cannot see they do not have.
         *
         * A button dressed as a field rather than a field, because it is one: it
         * takes no text, it opens the box that does. The cap comes off the same
         * table the key does, so the letter on the face and the letter that works
         * cannot drift apart.
         */
        <div className="shrink-0 px-2 pb-2">
          <button
            type="button"
            onClick={onFind}
            className={`${FIELD} flex h-7 w-full items-center gap-1.5 px-2 text-xs text-ink-muted hover:text-ink`}
          >
            <Search size={12} aria-hidden="true" className="shrink-0" />
            <span className="flex-1 text-left">Go to file</span>
            {finding === null ? null : <Cap chord={finding} />}
          </button>
        </div>
      )}
      <div
        ref={frame}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto text-xs"
        onPointerMove={(event) => resting(event.nativeEvent)}
      >
        {slice.above > 0 ? <div aria-hidden style={{ height: slice.above }} /> : null}
        {rows.slice(slice.from, slice.to).map((row) => {
          const here = reading === row.path
          return (
            <div
              key={row.path}
              data-path={row.path}
              data-kind={row.kind}
              className={`grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-2 ${
                here ? HERE : "hover:bg-hover"
              }`}
            >
              <button
                type="button"
                aria-expanded={row.kind === "directory" ? row.open : undefined}
                aria-current={here ? "true" : undefined}
                onClick={() => (row.kind === "directory" ? toggle(row.path) : onOpen(row.path))}
                className="flex min-w-0 items-center gap-1 py-1 text-left text-ink"
                style={{ paddingLeft: 4 + row.depth * 12 }}
              >
                {row.kind === "directory" ? (
                  <Chevron
                    size={12}
                    className={`shrink-0 text-ink-muted transition-transform ${row.open ? "rotate-90" : ""}`}
                  />
                ) : (
                  <span className="inline-block w-3 shrink-0" />
                )}
                <Mark path={row.path} kind={row.kind} icons={icons} />
                <span className="min-w-0 truncate">{row.name}</span>
              </button>
              <Commit touch={row.touched} now={now} />
            </div>
          )
        })}
        {slice.below > 0 ? <div aria-hidden style={{ height: slice.below }} /> : null}
      </div>
    </>
  )
}
