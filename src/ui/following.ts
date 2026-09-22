import { Effect, Option } from "effect"
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react"
import type { Beyond, Reading, Where, Writing } from "../ports/Ledger"
import type { Bounds, DiffHandle, Modifiers, Name } from "../ports/Renderer"
import { goModulesKnown, knowGoModules, knowPhpPrefixes, phpPrefixesKnown, reachingAll } from "../ledger/reaching"
import { goModulesIn, isGoMod } from "../ledger/goModules"
import { isComposerJson, phpPrefixesIn } from "../ledger/composer"

/**
 * How many files one press may read before it gives up.
 *
 * A name brought in by an import is one file. A name looked for in the files
 * this one took whole is as many as it took, times as many files as each of
 * those could be — and every one of them is a read a reader is waiting on.
 */
const MOST_CANDIDATES = 12

/**
 * How many files a Follow goes on through, where each passes the name on.
 *
 * A package re-exporting from a module re-exporting from another is two; three
 * covers any layout written on purpose, and bounds a chain nobody meant.
 */
const MOST_HOPS = 3

/**
 * How many `go.mod` or `composer.json` files a press reads before it resolves an
 * import. A repository of more than this is resolved with the ones it has read.
 */
const MOST_MODULES = 20

/**
 * The files that say how a language's imports map to folders, read once per set of
 * paths: Go's `go.mod` and PHP's `composer.json`.
 *
 * Only for a file of that language, and only the first time: every later press
 * finds them known. The shallowest first, since the root's is the one most imports
 * are of and nested ones can outnumber the cap. One that will not come, or one past
 * the cap, is left out rather than stopping the press, which then guesses for any
 * import the ones it read do not hold.
 */
const LAYOUTS: ReadonlyArray<{
  readonly for: string
  readonly says: (path: string) => boolean
  readonly known: (paths: ReadonlySet<string>) => boolean
  readonly learn: (paths: ReadonlySet<string>, read: ReadonlyMap<string, string>, whole: boolean) => void
}> = [
  {
    for: ".go",
    says: isGoMod,
    known: goModulesKnown,
    learn: (paths, read, whole) => knowGoModules(paths, goModulesIn(read), whole)
  },
  {
    for: ".php",
    says: isComposerJson,
    known: phpPrefixesKnown,
    learn: (paths, read) => knowPhpPrefixes(paths, phpPrefixesIn(read))
  }
]

const learnLayout = (source: string, across: Across): Effect.Effect<void> => {
  const layout = LAYOUTS.find((one) => source.endsWith(one.for))
  if (layout === undefined || layout.known(across.paths)) return Effect.void
  const every = [...across.paths]
    .filter(layout.says)
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))
  const files = every.slice(0, MOST_MODULES)
  return Effect.forEach(
    files,
    (path) =>
      across.read(path).pipe(
        Effect.map((text) => [path, text] as const),
        Effect.catch(() => Effect.succeed(null))
      ),
    { concurrency: 4 }
  ).pipe(
    Effect.map((read) => {
      const texts = new Map(read.filter((one) => one !== null))
      layout.learn(across.paths, texts, texts.size === every.length)
    })
  )
}

/** A file whose bare imports name npm packages rather than folders of this repository. */
const SCRIPT = /\.[cm]?[jt]sx?$/u
import { useLedger } from "./ledger"
import { useSettings } from "./useSettings"
import { sameName } from "../diff/engine"
import { lineBounds, showLine } from "./showLine"
import { onward } from "../observability/report"

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
  /** A name written in another repository, where it is, and where to draw it. */
  readonly beyond: { readonly found: Beyond; readonly at: Bounds } | null
  readonly unbeyond: () => void
  /**
   * The Writing a press asked about, for the panel that lists where it is used.
   *
   * A press on an underlined name asks "what is this, and who uses it" rather
   * than moving the reader somewhere — see the note on {@link Following.onName}.
   */
  readonly asked: {
    readonly writing: Writing
    readonly where?: string
    /** The line that asked, for anything that wants to put it on the screen. */
    readonly under: number
    /**
     * Where the name is, for the panel to open beside it.
     *
     * It used to be the line alone, and the panel was a row the renderer hung
     * under it — the file opened apart and the answer sat in the gap. That put
     * the answer inside the drawing it was about, which is where it went wrong:
     * a press in the panel bubbled out into the file's own renderer, which
     * followed it too and re-opened the panel on a new root, so a name in the
     * preview could not be followed at all. A rectangle and a popup over the
     * code has no such parent to escape into.
     */
    readonly at: Bounds
  } | null
  readonly unask: () => void
  /**
   * The file's whole text, if it has been read.
   *
   * Read once when the first name is asked about and kept, so the panel that
   * lists Uses does not fetch a file the answer it is drawing already came out
   * of. Null before anything has been asked, which is when nothing is drawn.
   */
  readonly textNow: () => string | null
  /**
   * Asks who depends on the name the pointer is on, from the keyboard.
   *
   * The same question a press on a Writing asks, for a hand already on the
   * keyboard — and the only way to ask it about a name written in another file,
   * where a press goes there instead. Does nothing where the pointer is on no
   * name, rather than opening a panel that has to explain itself.
   */
  readonly askNow: () => void
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

/**
 * Whether the Name pressed is the Writing itself, rather than a use of it.
 *
 * Which decides what a press does, and is the whole of the rule: press a call
 * and you are asking to be taken to the thing; press the thing and you are
 * asking who depends on it. Every editor that offers both settles it this way,
 * and a reader who has used one already knows it without being told.
 *
 * The two sides count columns differently and this is the only place it
 * matters. A renderer's token starts at `lineCharStart`, which counts from
 * nothing; a Writing's column comes off a syntax tree and is written for a
 * reader, so it counts from one. Compared without the adjustment, no press is
 * ever on a Writing and every press navigates — which is a feature with half of
 * itself quietly missing rather than a bug anybody would notice.
 */
const isTheWriting = (name: Name, writing: Writing, where: string | undefined, path: string):
  boolean =>
  (where === undefined || where === path) &&
  writing.line === name.line &&
  writing.from === name.from + 1

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
  /*
   * Whether a package nothing here holds may be asked about elsewhere.
   *
   * The reader's, and theirs to turn off: asking a registry means telling
   * somebody else the name of a package this repository depends on. It is asked
   * last of all, so a package this repository holds never reaches it.
   */
  const { settings } = useSettings()
  /** As a fact rather than as the settings, so the ask below depends on it. */
  const askRegistry = settings.diff.registry === "on"
  /**
   * The text, once. A file is read at a commit and does not change underneath a
   * reader, so the first ask is the only one — which is what makes Following in
   * a diff cost one request rather than one per name.
   */
  const text = useRef<{ readonly path: string; readonly text: string } | null>(null)
  const handle = useRef<DiffHandle | null>(null)
  const [shown, setShown] = useState<Shown | null>(null)
  const [peeked, setPeeked] = useState<Peeked | null>(null)
  const [asked, setAsked] = useState<{
    writing: Writing
    where?: string
    under: number
    at: Bounds
  } | null>(null)
  /**
   * A name that turned out to be written in another repository.
   *
   * Kept apart from the rest because following it is a different act: not a
   * scroll and not the pane redrawn, but a page — which this extension already
   * draws, so it stays inside the interface either way.
   */
  const [beyond, setBeyond] = useState<{ readonly found: Beyond; readonly at: Bounds } | null>(
    null
  )
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
    /**
     * Where the word was when the key was held over it.
     *
     * Kept because `boundsOf` only answers about the token the renderer last
     * reported entering, and the press that opens the panel arrives after it
     * has reported the leave. Measured once, on the hover that drew the
     * underline, rather than on every token a pointer crosses.
     */
    readonly at?: Bounds
  } | null>(null)

  /** The underline and the card go together, and go away together. */
  const draw = useCallback((name: Name, writing: Writing, where?: string) => {
    /*
     * Solid, because everything that reaches here is Sure.
     *
     * This drew dotted unless a compiler had answered, which read the line as
     * "types or guesswork" when the spec's two words are Sure and Likely — and
     * a Name resolved inside its own scope, or through an import this file
     * states, is Sure by both of them. `Writing.sure` says as much and was
     * ignored. With the compiler off, which is its default, that meant every
     * underline in the file was drawn as a guess about an answer arrived at by
     * proof.
     *
     * Dotted is kept for the one reading that really is a guess: a package
     * whose repository was guessed and whose Writing is a name match. That is
     * marked where it is drawn, further down.
     */
    handle.current?.mark(name, "sure")
    const at = handle.current?.boundsOf(name) ?? null
    setShown(at === null ? null : { writing, at, ...(where === undefined ? {} : { where }) })
    // Kept for the press that may follow, which cannot measure it again.
    const here = on.current
    if (at !== null && here !== null && sameName(here.name, name)) on.current = { ...here, at }
  }, [])

  const clear = useCallback(() => {
    handle.current?.mark(null)
    setShown(null)
    setBeyond(null)
  }, [])

  /**
   * Where the Name is written, whichever file that turns out to be.
   *
   * Two questions where the name was borrowed, and the second is asked of the
   * other file: this one says "I read `two` from `./whole`", and `./whole` is
   * asked what it writes down under `two`. Neither half is a guess — the
   * specifier is resolved against the paths the repository really has.
   */
  /*
   * The repository, read when a question is asked rather than closed over.
   *
   * A screen rebuilds this object every time it reads its metadata again — ten
   * seconds apart on a pull request, with nothing in it changed. Closed over, it
   * put a new identity on `ask`, on the handlers built from it, and so on the
   * object the renderer is handed; and the effect that draws the file lists that
   * object among the things a redraw depends on. So the file was thrown away and
   * drawn again on a timer, taking any underline with it, and the door the pane
   * opens was shut and reopened alongside.
   *
   * The type above says these handlers never change. Read through a ref, they
   * do not, and a question still asks the repository as it stands now.
   */
  const repository = useRef(across)
  repository.current = across

  /** A Name whose answer waits on the repository's paths. See the effect below. */
  const awaiting = useRef<Name | null>(null)

  /** The file as the Ledger wants it, read once and kept. */
  const asking = useCallback((): Effect.Effect<Reading, unknown> => {
    if (source === null) return Effect.fail("nothing to read")

    /** Which repository, for the tier that keeps a compiler per one. */
    const over = repository.current
    const within =
      over?.repo === undefined || over.sha === undefined
        ? {}
        : { repo: over.repo, sha: over.sha }

    const held = text.current
    if (held !== null && held.path === source.path) {
      return Effect.succeed({ path: source.path, text: held.text, ...within })
    }
    return source.text.pipe(
      Effect.map((whole) => {
        text.current = { path: source.path, text: whole }
        return { path: source.path, text: whole, ...within }
      })
    )
  }, [source])

  const ask = useCallback(
    (
      name: Name,
      then: (writing: Writing, where?: string) => void,
      /*
       * Whether to answer even though the pointer has moved on.
       *
       * A hover must not: the answer arrives after the reader has gone, and an
       * underline drawn then belongs to nothing. A press must: the reader
       * pressed *that* name, and whether their pointer is still on it a
       * moment later is not a question anybody asked.
       *
       * Written as one flag rather than two functions because it is one
       * difference, and because it was the absence of it that made a press do
       * nothing at all — the renderer reports a leave as the button goes down,
       * so every press arrived with the pointer already gone and every answer
       * was dropped on the way back.
       */
      insist = false
    ) => {
      if (source === null) return

      const mine = (found: Where): Effect.Effect<void> => {
        if (found.at === "here") {
          return Effect.sync(() => {
            if (!insist && on.current?.name !== name) return
            // The compiler answers with the file it found the name in, which may
            // not be the file being read — it follows an import on its own,
            // where the shapes answer `elsewhere` and leave the following to
            // whoever knows the repository.
            const where = found.writing.path
            on.current = { name, writing: found.writing, ...(where === undefined ? {} : { where }) }
            then(found.writing, where)
          })
        }

        // Borrowed. Which file, out of the ones the repository has?
        const across = repository.current
        if (across === undefined) return Effect.void

        /*
         * A bare specifier is not a path. It names a package, which resolves
         * against a folder no archive carries — so where it resolves is a
         * repository, and that is a question for the Ledger rather than for a
         * list of paths. See `src/ledger/packages.ts`.
         *
         * In JavaScript and TypeScript only, which are the languages that
         * lookup knows: it reads `package.json`. Every other language writes its
         * own packages without a dot — `example.com/app/shapes`,
         * `com.ex.shapes.Box`, `App\\Thing` — and sending those there found
         * nothing, so they never reached this repository's own files below.
         */
        if (!found.borrowed.specifier.startsWith(".") && SCRIPT.test(source.path)) {
          if (across.repo === undefined || across.sha === undefined) return Effect.void

          return ledger
            .beyond(
              across.repo,
              across.sha,
              found.borrowed.specifier,
              found.borrowed.name,
              askRegistry
            )
            .pipe(
              Effect.map((there) => {
                if (there.path === undefined || (!insist && on.current?.name !== name)) return

                // Beside the name, like every other answer. Asked of the
                // renderer at the moment of drawing, because a rectangle goes
                // stale the moment anything scrolls.
                const at = handle.current?.boundsOf(name) ?? null
                if (at === null) return

                /*
                 * And underlined, like every other answer.
                 *
                 * This branch drew a card and left the word plain, so a name
                 * from another repository was the one kind of name a reader
                 * could not see was followable — they had to press it to find
                 * out. Likely, because the repository is proved and which
                 * Writing inside it is a name match.
                 */
                handle.current?.mark(name, "likely")

                setBeyond({
                  at,
                  found: {
                    ...there,
                    path: there.path,
                    line: there.line ?? 1,
                    name: there.name ?? found.borrowed.name
                  }
                })
              }),
              Effect.catch(onward)
            )
        }

        if (across.paths.size === 0) {
          /*
           * Nothing to resolve against yet. Ask for the tree — rather than
           * reading it on every review that never follows a name out of its
           * diff — and remember the name that asked, so the answer arrives for
           * this hold rather than the next one.
           *
           * Dropping it was the honest cost of not having read the tree, and it
           * is what a reader reports as a wait: holding the key over an imported
           * name did nothing at all, holding it again a moment later worked, and
           * coming back to the file did nothing again because the pane remounts
           * with no tree. Nothing here is asked any sooner; what changes is that
           * the question already asked is not thrown away.
           */
          awaiting.current = name
          across.reach?.()
          return Effect.void
        }
        /*
         * Every file this name could have come from, asked in turn until one
         * writes it. Most languages name a file and there is only ever one; Go
         * names a package, which is a folder, and a file that took others whole
         * says which files rather than which names.
         *
         * In turn rather than at once: the first answers for every language but
         * one, and a reader pressing a name should not fetch a whole package to
         * find out.
         */
        const asked = found.borrowed.name
        // Read before the candidates are, because they are what a Go import is
        // resolved against. See {@link learnLayout}.
        return learnLayout(source.path, across).pipe(
          Effect.andThen(
            Effect.suspend(() => {
              /** Every file a borrow could be read from, capped over all of them. */
              const candidatesFor = (from: string, where: Extract<Where, { readonly at: "elsewhere" }>) =>
                [where.borrowed.specifier, ...(where.orFrom ?? [])]
                  .flatMap((specifier) => reachingAll(from, specifier, across.paths, where.borrowed.name))
                  // Capped over the whole list and not only per specifier: a C++ file
                  // that includes twenty headers, pressed on a name none of them writes,
                  // would otherwise read all twenty before saying nothing.
                  .slice(0, MOST_CANDIDATES)

              /*
               * Every file it could be, before any of them is followed further.
               *
               * One that does not write the name may pass it on — a package's
               * `__init__.py`, a barrel, a Rust `pub use` — and says where from.
               * Those are gone on from only once none of the rest writes it: a Go
               * package is several files, and the sibling that writes `Box` is the
               * answer where going on through the one before it is another
               * package's. A few files deep at most, nothing read twice for the
               * same name, and nothing read at all once the pointer has left.
               */
              const seek = (
                candidates: ReadonlyArray<string>,
                wanted: string,
                hops: number,
                seen: Set<string>
              ): Effect.Effect<boolean> => {
                const gone = () => !insist && on.current?.name !== name
                const passers: Array<Reading> = []

                const trying = (at: number): Effect.Effect<boolean> => {
                  const path = candidates[at]
                  if (path === undefined || gone()) return Effect.succeed(false)

                  const onwards = (): Effect.Effect<boolean> => trying(at + 1)
                  if (seen.has(`${wanted}@${path}`)) return onwards()
                  seen.add(`${wanted}@${path}`)

                  return across.read(path).pipe(
                    Effect.flatMap((text) =>
                      ledger
                        .writingNamed({ path, text }, wanted)
                        .pipe(Effect.map((writing) => ({ writing, text })))
                    ),
                    Effect.flatMap(({ writing, text }): Effect.Effect<boolean> => {
                      if (Option.isNone(writing)) {
                        passers.push({ path, text })
                        return onwards()
                      }
                      if (gone()) return Effect.succeed(true)
                      on.current = { name, writing: writing.value, where: path, text }
                      then(writing.value, path)
                      return Effect.succeed(true)
                    }),
                    // A file that would not come is the next one's turn — reported
                    // first, because `onward` is the only trace this extension keeps and
                    // swallowing the cause here made a failed read look like a file that
                    // simply said nothing.
                    Effect.catch((cause) => onward(cause).pipe(Effect.andThen(onwards())))
                  )
                }

                /** Each file that did not write it, asked where it got it, in turn. */
                const deeper = (at: number): Effect.Effect<boolean, unknown> => {
                  const passer = passers[at]
                  if (passer === undefined || hops >= MOST_HOPS || gone()) return Effect.succeed(false)
                  return ledger.borrowedAs(passer, wanted).pipe(
                    // One file that cannot say is one file, not the end of the rest.
                    Effect.catch(() => Effect.succeed(Option.none())),
                    Effect.flatMap((passed) =>
                      Option.isNone(passed)
                        ? Effect.succeed(false)
                        : seek(candidatesFor(passer.path, passed.value), passed.value.borrowed.name, hops + 1, seen)
                    ),
                    Effect.flatMap((done) => (done ? Effect.succeed(true) : deeper(at + 1)))
                  )
                }

                return trying(0).pipe(
                  Effect.flatMap((done) => (done ? Effect.succeed(true) : deeper(0))),
                  Effect.catch((cause) => onward(cause).pipe(Effect.as(false)))
                )
              }

              const candidates = candidatesFor(source.path, found)
              if (candidates.length === 0) return Effect.void
              return seek(candidates, asked, 0, new Set()).pipe(Effect.asVoid)
            })
          )
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
          Effect.catch(onward)
        )
      )
    },
    [asking, askRegistry, ledger, source]
  )

  /*
   * The name that asked before the repository's paths had been read.
   *
   * Kept for the moment they land, and answered then if the pointer is still on
   * it. One name, because a reader has one pointer — and cleared on the way out
   * so a tree arriving long after a reader moved on marks nothing.
   */
  useEffect(() => {
    const name = awaiting.current
    if (name === null) return
    if ((repository.current?.paths.size ?? 0) === 0) return

    awaiting.current = null
    const here = on.current
    // Only where the reader is still there. The answer to a question nobody is
    // waiting for is an underline under a word the pointer has left.
    if (here === null || !sameName(here.name, name)) return
    ask(name, (writing, where) => draw(name, writing, where))
  }, [across, ask, draw])

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
    awaiting.current = null
    clear()
  }, [clear])

  /** The lines a Writing is written on, out of whichever file holds it. */
  const linesOf = useCallback(
    (writing: Writing, where?: string): ReadonlyArray<string> => {
      // The kept text only if it is this file's: `source` can move on between a
      // question and its answer, and a Peek of the file before it would be the
      // right line numbers over the wrong lines.
      const held = text.current !== null && text.current.path === source?.path ? text.current.text : null
      const whole = where === undefined || where === source?.path ? held : on.current?.text
      const all = (whole ?? "").split("\n")
      // Enough to see what it is: the line it starts on and the few under it.
      // A Peek is not a second file view — the press beside it opens the file.
      return all.slice(writing.line - 1, writing.line - 1 + PEEK)
    },
    [source]
  )

  /**
   * Where to open the panel, from whatever still knows where the word is.
   *
   * Three answers, best first. The renderer's is best because it knows the
   * token; it is also the one most likely to be gone, since a press lets go of
   * the token on the way down. The hover that drew the underline measured the
   * same rectangle a moment earlier. And a line is drawn whether or not any
   * token is still reported, so the last answer is always an answer — the panel
   * opens beside the right line even when nothing can say which word.
   */
  const anchorOf = useCallback(
    (name: Name): Bounds | null => {
      const held = on.current
      return (
        handle.current?.boundsOf(name) ??
        (held !== null && sameName(held.name, name) ? held.at : undefined) ??
        lineBounds(host.current, name.line)
      )
    },
    [host]
  )

  const onName = useCallback(
    (name: Name, held: Modifiers) => {
      if (!held.go) return

      const peek = (writing: Writing, where?: string): void => {
        clear()
        setPeeked({
          writing,
          under: name.line,
          lines: linesOf(writing, where),
          ...(where === undefined ? {} : { where })
        })
      }

      if (held.shift) {
        const already =
          on.current !== null && sameName(on.current.name, name) ? on.current.writing : null
        if (already !== null) peek(already, on.current?.where)
        // Insisting, for the same reason the press below insists: the renderer
        // reports a leave as the button goes down, so a Peek asked without this
        // arrives after the pointer has officially gone and is dropped on the
        // way back. Every Shift press did nothing at all, and the test covering
        // it passed — it calls the handlers in order, and a real pointer puts a
        // leave between them.
        else ask(name, peek, true)
        return
      }

      /*
       * Which of the two a press is, decided by where the press landed.
       *
       * On a call, the question is "take me to it", and this is the gesture
       * every editor answers that way. On the Writing itself there is nowhere to
       * be taken — the reader is already looking at it — and the question that
       * is left is the one they actually have: who depends on this. So the same
       * press does both, and neither has to be learnt.
       *
       * Going to it never leaves the review. In this file it is a scroll; in
       * another it is the address changing and the pane drawing something else,
       * which is what pressing a row of the tree does.
       */
      const arrive = (writing: Writing, where?: string): void => {
        clear()
        if (where !== undefined && where !== source?.path) {
          repository.current?.open(where, writing.line)
          return
        }
        if (showLine(host.current, writing.line)) return
        /*
         * The line is not on the screen, so there is nowhere to scroll to.
         *
         * A pull request draws the hunks and a few lines either side, and folds
         * the rest into an "unmodified lines" bar — so a name written in the
         * same file is very often written on a line the diff never drew. The
         * answer is right and the row it names does not exist, and `showLine`
         * said so with a `false` nobody read: the underline went on, the press
         * did nothing, and nothing said why.
         *
         * The Peek is the same answer without the scroll. It reads the lines
         * from the whole file the Ledger was asked about, which holds every
         * line whether or not the diff drew it.
         */
        peek(writing, where)
      }

      const show = (writing: Writing, where?: string): void => {
        // Measured before the mark is let go, because letting go of it is what
        // takes the token the rectangle is being asked about.
        const at = anchorOf(name)
        clear()
        if (at === null) return
        setAsked({ writing, ...(where === undefined ? {} : { where }), under: name.line, at })
      }

      const answer = (writing: Writing, where?: string): void => {
        if (isTheWriting(name, writing, where, source?.path ?? "")) show(writing, where)
        else arrive(writing, where)
      }

      // The answer from the hover, where the hover asked. A press that has to
      // ask again is a press that waits, and the reader has been holding the key
      // over an underlined name — the answer is what put the line there.
      // Three fields rather than identity: the renderer builds a fresh Name for
      // every event, so `===` between the hover's and the press's was never
      // once true and this answer was never once reused. `sameName` is in the
      // engine for exactly this, and says so.
      const known =
        on.current !== null && sameName(on.current.name, name) ? on.current.writing : null
      if (known !== null) {
        answer(known, on.current?.where)
        return
      }
      // Insisting: the reader pressed this name, and the renderer has already
      // told us the pointer left it.
      ask(name, answer, true)
    },
    [anchorOf, ask, clear, host, linesOf, source]
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
  /*
   * The door, opened before anybody walks through it.
   *
   * A reader holding Command over a name was waiting for a worker to wake, a
   * document to open, a runtime to compile and a megabyte and a half of grammar
   * to arrive — every time, the first time, while watching a word not underline.
   * None of that is a question about a name, so none of it waits for the key.
   *
   * The file is fetched here too, which is the other half of the same wait.
   * Opening the door and then standing in it while a file is read off the
   * network still leaves a reader watching a word not underline: measured on an
   * 86-file pull request, letting the screen stand for three full seconds
   * before reaching for the key still cost 544ms, because none of that time had
   * been spent on the one thing the first question actually needs. It is the
   * same file the pane will fetch if the reader expands a hunk, and it is kept,
   * so the cost is one request for a file somebody is already looking at.
   *
   * Nothing is asked. The rule that nothing is asked until the key is held is
   * about questions — about a name, about who uses it — and neither of these is
   * one.
   *
   * Opened per file, and shut by nothing else.
   *
   * This used to depend on `asking`, which depends on `across`, which a screen
   * rebuilds whenever it reads its metadata again — every ten seconds on a pull
   * request, and the object is written fresh each time whether or not anything
   * in it changed. So the clean-up below ran on a timer and interrupted both
   * forks: the grammar on its way and the file on its way, each restarted from
   * nothing. A reader who held the key in one of those windows paid the whole
   * cost the door exists to have already paid — and paid it again on returning
   * to the file, because the pane remounts and the cycle begins again.
   *
   * The path is what this is about. `asking` is read through a ref so the fetch
   * still uses the current one without its identity being able to close the
   * door.
   */
  const askingNow = useRef(asking)
  askingNow.current = asking
  const reading = source?.path ?? null
  useEffect(() => {
    if (reading === null) return

    const opening = Effect.runFork(ledger.ready(reading).pipe(Effect.catch(onward)))
    const fetching = Effect.runFork(askingNow.current().pipe(Effect.catch(onward)))
    return () => {
      opening.interruptUnsafe()
      fetching.interruptUnsafe()
    }
  }, [ledger, reading])

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
  const unask = useCallback(() => setAsked(null), [])
  const unbeyond = useCallback(() => setBeyond(null), [])
  /**
   * The uses of whatever the pointer is on, asked for by the letter.
   *
   * It used to answer only where the Writing was already in hand, which it only
   * ever is while the key is held — so the letter worked for a reader already
   * holding Command and did nothing at all for everybody else, silently, which
   * is not what it is for. The letter is the way to ask *without* holding
   * anything: a reader reads a line, wonders about a name, and presses `u`.
   *
   * Insisting, for the reason every press here insists: this is a key, the
   * pointer is not being tracked through it, and an answer thrown away because
   * the renderer reported a leave is an answer nobody asked it to throw away.
   */
  const askNow = useCallback(() => {
    const here = on.current
    if (here === null) return

    const show = (writing: Writing, where?: string): void => {
      const at = anchorOf(here.name)
      clear()
      if (at === null) return
      setAsked({ writing, ...(where === undefined ? {} : { where }), under: here.name.line, at })
    }

    if (here.writing !== null) {
      show(here.writing, here.where)
      return
    }
    ask(here.name, show, true)
  }, [anchorOf, ask, clear])
  const textNow = useCallback(
    () => (text.current?.path === source?.path ? (text.current?.text ?? null) : null),
    [source]
  )

  return {
    names,
    shown: source === null ? null : shown,
    peeked: source === null ? null : peeked,
    unpeek,
    asked: source === null ? null : asked,
    unask,
    beyond: source === null ? null : beyond,
    unbeyond,
    textNow,
    askNow
  }
}
