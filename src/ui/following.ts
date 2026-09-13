import { Effect, Option } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Reading, Where, Writing } from "../ports/Ledger"
import type { Bounds, DiffHandle, Modifiers, Name } from "../ports/Renderer"
import { reaching } from "../ledger/reaching"
import { useLedger } from "./ledger"
import { showLine } from "./showLine"

/**
 * Holding a key over code, and pressing what it underlines.
 *
 * The act `docs/spec/following.md` is named for, wired to the two ends that
 * already exist: the renderer says which identifier the pointer is on (`Name`,
 * off its own token events) and the Ledger says where that name is written.
 * Neither knows about the other, and this is the twenty lines between them.
 *
 * Nothing is asked until the key is held. A reader moving a pointer across a
 * file crosses a hundred identifiers, and asking about each would be a hundred
 * parses of a file nobody is asking about — so the modifier is the question, and
 * a reader who never holds it is on the screen that exists today.
 */
export type Following = {
  readonly onName: (name: Name, held: Modifiers) => void
  readonly onNameEnter: (name: Name, held: Modifiers) => void
  readonly onNameLeave: (name: Name) => void
  /** The renderer's handle, once there is one, for the underline. */
  readonly drawnBy: (handle: DiffHandle | null) => void
}

/** A Writing to be shown beside the Name that asked for it. */
export type Shown = {
  readonly writing: Writing
  readonly at: Bounds
  /** The file it is written in, where that is not the file being read. */
  readonly where?: string
}

/**
 * How to reach a file this one borrowed a name from.
 *
 * Two things, and a pane that has neither does not follow across files: which
 * paths the repository has, so a specifier is resolved against what exists
 * rather than guessed at, and how to read one of them. Both belong to the screen
 * — it is the screen that knows which repository and which commit — and neither
 * is something this hook could work out.
 */
export type Across = {
  readonly paths: ReadonlySet<string>
  /**
   * Which repository this is, at which commit, for the questions only a Ledger
   * can answer — every Use of a name, and every name the repository writes.
   *
   * Absent on a screen that knows its files but not what they are part of.
   */
  readonly repo?: { readonly owner: string; readonly repo: string }
  readonly sha?: string
  /**
   * Asks for the paths, where they are not read until something wants them.
   *
   * A repository's front page has read them for its tree before a reader can
   * press anything. A pull request has not, and should not on the chance that a
   * name will be followed out of the diff — so this is called the first time one
   * is, and the answer arrives as a new `paths` a render later. The Follow that
   * asked finds nothing, which is the honest cost of not having read it: the
   * second press of the same name works.
   */
  readonly reach?: () => void
  readonly read: (path: string) => Effect.Effect<string, unknown>
  /** Opens another file at a line. The address follows, as a Follow's does. */
  readonly open: (path: string, line: number) => void
}

/**
 * What the pane needs: handlers that never change, and a card that does.
 *
 * Two fields rather than one object, and the split is load-bearing. The
 * handlers are handed to the renderer inside an effect, so a new object on every render
 * would tear the drawn file down and build it again — on every pointer move. The
 * card is state and changes constantly. Keeping them apart is what lets the
 * first be stable while the second is not.
 */
export type Follows = {
  readonly names: Following
  readonly shown: Shown | null
  /** A Writing the reader asked to see without leaving the file they are in. */
  readonly peeked: Peeked | null
  /** Puts a Peek away. The reader pressing Escape, or opening something else. */
  readonly unpeek: () => void
  /**
   * The Writing the pointer is on, for a panel that asks about it.
   *
   * Whatever the last answer was, whether or not it is drawn: a reader presses
   * the key for Uses while looking at a name, and the name they are looking at
   * is the one under the pointer.
   */
  readonly onNow: () => Writing | null
}

/**
 * A Writing drawn under the line that asked for it.
 *
 * What a reader wants most of the time, because the question is usually "what
 * does this do" rather than "take me there" — and the card above the pointer can
 * hold a signature and a sentence but not a body.
 */
export type Peeked = {
  readonly writing: Writing
  /** The line of the file being read that the rows hang under. */
  readonly under: number
  /** The Writing's own lines, from wherever it is written. */
  readonly lines: ReadonlyArray<string>
  readonly where?: string
}

/** How many lines of a Writing a Peek shows. Enough to see what it is. */
const PEEK = 12

/** Nothing to follow, for a pane with no file of its own to ask about. */
const NOWHERE: Following = {
  onName: () => {},
  onNameEnter: () => {},
  onNameLeave: () => {},
  drawnBy: () => {}
}

/**
 * The file being read, and how to get hold of the whole of it.
 *
 * An Effect rather than the text, because half the screens that can ask do not
 * have it. A repository's file pane holds every line; a pull request's diff
 * holds the hunks and three lines either side, and the rest of the file is a
 * request it already knows how to make. Both are a path and a way to the text,
 * and the way is not run until a reader holds the key.
 */
export type Source = {
  readonly path: string
  readonly text: Effect.Effect<string, unknown>
}

export const useFollowing = (
  source: Source | null,
  host: RefObject<HTMLElement | null>,
  across?: Across
): Follows => {
  const ledger = useLedger()
  /**
   * The text, once. A file is read at a commit and does not change underneath a
   * reader, so the first ask is the only one — which is what makes Following in
   * a diff cost one request rather than one per name.
   */
  const text = useRef<{ readonly path: string; readonly text: string } | null>(null)
  const handle = useRef<DiffHandle | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [peeked, setPeeked] = useState<Peeked | null>(null)
  /**
   * The Name the pointer is on, and what was found for it.
   *
   * The answer arrives after the pointer may have moved on, so what it is about
   * is kept beside it: marking the token the reader has already left is worse
   * than not marking at all, because the underline then belongs to nothing.
   */
  const on = useRef<{
    readonly name: Name
    readonly writing: Writing | null
    readonly where?: string
    /** The other file's own text, kept so a Peek into it costs no second read. */
    readonly text?: string
  } | null>(null)

  /** The underline and the card go together, and go away together. */
  const draw = useCallback((name: Name, writing: Writing, where?: string) => {
    handle.current?.mark(name)
    const at = handle.current?.boundsOf(name) ?? null
    setShown(at === null ? null : { writing, at, ...(where === undefined ? {} : { where }) })
  }, [])

  const clear = useCallback(() => {
    handle.current?.mark(null)
    setShown(null)
  }, [])

  /**
   * Where the Name is written, whichever file that turns out to be.
   *
   * Two questions where the name was borrowed, and the second is asked of the
   * other file: this one says "I read `two` from `./whole`", and `./whole` is
   * asked what it writes down under `two`. Neither half is a guess — the
   * specifier is resolved against the paths the repository really has.
   */
  /** The file as the Ledger wants it, read once and kept. */
  const asking = useCallback((): Effect.Effect<Reading, unknown> => {
    if (source === null) return Effect.fail("nothing to read")

    const held = text.current
    if (held !== null && held.path === source.path) {
      return Effect.succeed({ path: source.path, text: held.text })
    }
    return source.text.pipe(
      Effect.map((whole) => {
        text.current = { path: source.path, text: whole }
        return { path: source.path, text: whole }
      })
    )
  }, [source])

  const ask = useCallback(
    (name: Name, then: (writing: Writing, where?: string) => void) => {
      if (source === null) return

      const mine = (found: Where): Effect.Effect<void> => {
        if (found.at === "here") {
          return Effect.sync(() => {
            if (on.current?.name !== name) return
            on.current = { name, writing: found.writing }
            then(found.writing)
          })
        }

        // Borrowed. Which file, out of the ones the repository has?
        if (across === undefined) return Effect.void
        if (across.paths.size === 0) {
          // Nothing to resolve against yet. Ask for the tree, so the next press
          // has one — rather than reading it on every review that never follows
          // a name out of its diff.
          across.reach?.()
          return Effect.void
        }
        const path = reaching(source.path, found.borrowed.specifier, across.paths)
        if (path === null) return Effect.void

        return across.read(path).pipe(
          Effect.flatMap((text) =>
            ledger
              .writingNamed({ path, text }, found.borrowed.name)
              .pipe(Effect.map((writing) => ({ writing, text })))
          ),
          Effect.map(({ writing, text }) => {
            if (Option.isNone(writing) || on.current?.name !== name) return
            on.current = { name, writing: writing.value, where: path, text }
            then(writing.value, path)
          }),
          // A file that would not come, or that says nothing under that name.
          // The reader is left where they were, with no underline.
          Effect.catch(() => Effect.void)
        )
      }

      Effect.runFork(
        asking().pipe(
          Effect.flatMap((whole) =>
            ledger.writingAt(whole, { row: name.line - 1, column: name.from })
          ),
          Effect.flatMap((found) =>
            Option.isNone(found) ? Effect.void : mine(found.value)
          ),
          // A Ledger that could not answer leaves the file as it is. There is
          // nothing to tell a reader who asked for nothing.
          Effect.catch(() => Effect.void)
        )
      )
    },
    [across, asking, ledger, source]
  )

  const onNameEnter = useCallback(
    (name: Name, held: Modifiers) => {
      on.current = { name, writing: null }
      setShown(null)
      if (!held.go) return
      ask(name, (writing, where) => draw(name, writing, where))
    },
    [ask, draw]
  )

  const onNameLeave = useCallback(() => {
    on.current = null
    clear()
  }, [clear])

  /** The lines a Writing is written on, out of whichever file holds it. */
  const linesOf = useCallback(
    (writing: Writing, where?: string): ReadonlyArray<string> => {
      const whole =
        where === undefined || where === source?.path ? text.current?.text : on.current?.text
      const all = (whole ?? "").split("\n")
      // Enough to see what it is: the line it starts on and the few under it.
      // A Peek is not a second file view — the press beside it opens the file.
      return all.slice(writing.line - 1, writing.line - 1 + PEEK)
    },
    [source]
  )

  const onName = useCallback(
    (name: Name, held: Modifiers) => {
      if (!held.go) return

      if (held.shift) {
        const peek = (writing: Writing, where?: string): void => {
          clear()
          setPeeked({
            writing,
            under: name.line,
            lines: linesOf(writing, where),
            ...(where === undefined ? {} : { where })
          })
        }
        const already = on.current?.name === name ? on.current.writing : null
        if (already !== null) peek(already, on.current?.where)
        else ask(name, peek)
        return
      }

      // The answer from the hover, where the hover asked. A press that has to
      // ask again is a press that waits, and the reader has been holding the key
      // over an underlined name — the answer is what put the line there.
      const arrive = (writing: Writing, where?: string): void => {
        clear()
        // Another file is the screen's to open — the address changes, and the
        // pane draws something else. This one is a scroll.
        if (where !== undefined && where !== source?.path) {
          across?.open(where, writing.line)
          return
        }
        showLine(host.current?.shadowRoot ?? null, writing.line)
      }

      const known = on.current?.name === name ? on.current.writing : null
      if (known !== null) {
        arrive(known, on.current?.where)
        return
      }
      ask(name, arrive)
    },
    [across, ask, clear, host, linesOf, source]
  )

  const drawnBy = useCallback((given: DiffHandle | null) => {
    handle.current = given
  }, [])

  /*
   * The key pressed while the pointer is already on a name.
   *
   * Without this the underline only ever appeared for a reader who was holding
   * Command *before* they arrived at the word — which is not how anybody does
   * it. A reader reads a line, wonders what a name is, and reaches for the key
   * with the pointer already sitting on it.
   *
   * On the document and in the capture phase, like the rest of this interface's
   * keyboard: the code is inside a shadow root, and a modifier pressed over it
   * is reported against whatever the event was retargeted to. Nothing is
   * prevented and nothing is stopped — this is a key being *held*, not a
   * shortcut being pressed, and `src/keys/commands.ts` says as much in
   * `HOLDING`.
   */
  useEffect(() => {
    if (source === null) return

    const down = (event: KeyboardEvent) => {
      if (event.key !== "Meta" && event.key !== "Control") return
      const here = on.current
      if (here === null) return
      if (here.writing !== null) {
        draw(here.name, here.writing, here.where)
        return
      }
      ask(here.name, (writing, where) => draw(here.name, writing, where))
    }

    const up = (event: KeyboardEvent) => {
      if (event.key !== "Meta" && event.key !== "Control") return
      clear()
    }

    // A window that loses the focus never hears the key come back up — the
    // reader has switched away with it held, and the underline would still be
    // there when they came back. A scroll moves the code out from under the
    // card, whose place was measured before it moved.
    const away = () => clear()

    document.addEventListener("keydown", down, true)
    document.addEventListener("keyup", up, true)
    window.addEventListener("blur", away)
    window.addEventListener("scroll", away, true)
    return () => {
      document.removeEventListener("keydown", down, true)
      document.removeEventListener("keyup", up, true)
      window.removeEventListener("blur", away)
      window.removeEventListener("scroll", away, true)
    }
  }, [ask, clear, draw, source])

  // Stable, because the renderer is handed these inside an effect and a new
  // object would redraw the whole file. Every one of them is a `useCallback`
  // already, so the object is the only thing left that could change.
  const names = useMemo(
    (): Following =>
      source === null ? NOWHERE : { onName, onNameEnter, onNameLeave, drawnBy },
    [source, onName, onNameEnter, onNameLeave, drawnBy]
  )

  const unpeek = useCallback(() => setPeeked(null), [])
  const onNow = useCallback(() => on.current?.writing ?? null, [])

  return {
    names,
    shown: source === null ? null : shown,
    peeked: source === null ? null : peeked,
    unpeek,
    onNow
  }
}
