import { Cause, Effect, Option } from "effect"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import { useCallback, useMemo } from "react"
import { useAtomAsk, useAtomRefresh, useAtomValue } from "./atoms"
import { keepDrawn, lastDrawn } from "./lastDrawn"

/**
 * Reading something from GitHub and never resting on what was remembered.
 *
 * The shape shared by every list this interface draws: show what was remembered
 * if it arrives first, replace it the moment GitHub answers, and on a failure
 * show the failure rather than the memory. A list read to decide what to work
 * on next is worse than useless when it is quietly half an hour out of date,
 * because it looks exactly like one that is right.
 *
 * Three states rather than four, and the fourth is the interesting one: a
 * re-read that fails keeps what is on the screen. That used to be a `catch`
 * that dropped the failure on the floor; here it is `AsyncResult`'s own
 * `previousSuccess`, which is the same sentence said by the library.
 */
export type Read<T> =
  | { readonly status: "loading" }
  /**
   * The failure itself, and not because a screen should print it.
   *
   * One kind of failure is the reader's to fix rather than ours: an organisation
   * that wants single sign-on before it will serve its repositories. A card that
   * only knows "failed" cannot tell them that, and blaming GitHub for a shape
   * that changed sends somebody looking for a bug behind a wall with a door in
   * it. What each screen does with this is hand it to {@link ReadFailed}.
   */
  | { readonly status: "failed"; readonly why: unknown }
  | { readonly status: "ready"; readonly value: T }

/**
 * A read, which may say what it knows before it knows all of it.
 *
 * A repository's list takes four reads of GitHub to draw completely and one to
 * draw usefully, so `load` is handed somewhere to put each better answer as it
 * arrives rather than being made to hold everything back until the last one
 * lands. A load with nothing to report early ignores the argument, which is why
 * every `() => Effect<T>` still fits.
 */
export type Load<T> = (partly: (value: T) => void) => Effect.Effect<T, unknown>

export type Live<T> = {
  readonly read: Read<T>
  /**
   * Whether what `read` shows is a memory with a live read still running behind it.
   *
   * Showing the last answer immediately is the right thing to do and it is also a
   * small lie: the reader is looking at what was true last time, and until this
   * existed nothing on the screen said so. Every list here is read to decide what
   * to do next, and "this is a moment old and being checked" is part of the answer.
   *
   * False while there is nothing to look at. The wait is already saying it then, in
   * the middle of the screen, at the size of the thing that is missing.
   */
  readonly catchingUp: boolean
  /** Reads again, keeping what is on the screen if the new read fails. */
  readonly again: () => void
  /**
   * Shows a change now, and takes it back if GitHub refuses it.
   *
   * The list is the reader's answer to what to do next, and every write they
   * can make from it changes which part of it a row belongs to. Waiting for
   * eight requests to find that out means pressing Close and watching nothing
   * happen for most of a second — so the change is applied to what is on the
   * screen, the ask goes out behind it, and the read that follows is the one
   * that either confirms it or quietly puts it back.
   *
   * Hands back an effect that answers as GitHub did, because the control that
   * asked is usually the only place a refusal makes sense: the row menu says why
   * on the item that was pressed, and a rollback with no sentence attached is a
   * row that moved and moved back for reasons nobody was told.
   */
  readonly meanwhile: (
    change: (value: T) => T,
    work: Effect.Effect<unknown, unknown>
  ) => Effect.Effect<void, unknown>
}

/**
 * How long an answer is worth reusing rather than asking again.
 *
 * Short enough that nobody is reading a stale list on purpose, long enough that
 * the two or three screens drawn while a reader moves around inside one page do
 * not each pay for the whole thing. Coming back to the tab ignores it.
 */
const FRESH = "10 seconds"

/** What a caller hands to {@link Live.meanwhile}, carried as one value. */
type Meanwhile<T> = {
  readonly change: (value: T) => T
  readonly work: Effect.Effect<unknown, unknown>
}

/**
 * What to show, from what the live read has got to and what was remembered.
 *
 * The order matters and is the whole of the policy: GitHub's answer beats a
 * memory, a memory beats a wait, and a failure with something behind it is not
 * a failure worth showing anybody.
 */
const shownFrom = <T>(live: AsyncResult.AsyncResult<T, unknown>, early: Option.Option<T>): Read<T> => {
  if (live._tag === "Success") return { status: "ready", value: live.value }
  if (live._tag === "Failure") {
    return Option.isSome(live.previousSuccess)
      ? { status: "ready", value: live.previousSuccess.value.value }
      : { status: "failed", why: Cause.squash(live.cause) }
  }

  return Option.isSome(early) ? { status: "ready", value: early.value } : { status: "loading" }
}

export const useLive = <T>(
  load: Load<T>,
  preload?: () => Effect.Effect<Option.Option<T>>,
  /**
   * A name for the page this read is of, the same on every visit to it.
   *
   * Given one, what GitHub last said stays in this document's memory and is on
   * the screen on the first frame of the next visit — which is what makes Back
   * instant rather than a skeleton over a storage read. See {@link lastDrawn}.
   *
   * Named by the caller rather than worked out here, because the name has to be
   * the same on both visits and nothing in this hook knows what it is reading.
   * The names are in `lastDrawn.ts`, together, so that two of them claiming one
   * page is a thing you can see. Left out by every screen that has not been
   * given one yet, and by the two that read twice on one page — `ProfileScreen`
   * and `Home` — until each of their reads is named separately.
   */
  where?: string
): Live<T> => {
  const atoms = useMemo(() => {
    /** What this document last drew for this page, if it drew it. */
    const kept = where === undefined ? Option.none<T>() : lastDrawn<T>(where)

    /**
     * Whatever arrived before the answer did.
     *
     * Three things end up here: what this document drew here last, what the last
     * visit left in the store, and the stages a staged read reports on its way to
     * being finished. All are worth looking at and none is the answer. They are
     * not the same kind of thing though, and which of them is here decides
     * whether the other may land on top of it — see `remembered`.
     */
    const early = Atom.make(kept)

    /**
     * Whether what `early` holds is a memory rather than a stage of the live read.
     *
     * The two are not interchangeable, which is the fault this exists to answer. A
     * memory is a whole page: the list as this document last had it up, or the list
     * the last visit left in the store. The first stage of a live read is the rows
     * with none of what goes beside them — no Courts, no stacks, no sizes — because
     * a repository's list takes four reads of GitHub to draw completely.
     *
     * Recorded on a live GitHub, arriving at `flazouh/ghpro-scratch/pulls`: the
     * remembered list whole on the screen at 1010ms, the read's first stage over the
     * top of it at 1423ms — the reader's own five rows regrouped from "Needs You" to
     * "Waiting", every check gone — and the whole list back at 1736ms. Then walking
     * out of pull request 10 onto that same list: whole at 6394ms, the stage at
     * 7153ms, whole again at 7619ms. Most of a second of a list taking itself apart
     * and putting itself back together, on the way to saying what it already said.
     * See `scripts/probe-flicker-dom.js`, which is what recorded it.
     *
     * So a stage is worth showing over nothing and never over a memory. Nothing here
     * can compare two pages and say which is the fuller one, and it does not have to:
     * where a memory arrived, there is a whole page on the screen already, and the
     * read has an answer coming that is better than either.
     */
    let remembered = Option.isSome(kept)

    const read = Atom.make((get: Atom.AtomContext) => {
      const running = load((value) => {
        if (remembered) return
        get.set(early, Option.some(value))
      })

      /*
       * Written down only where GitHub answered. A stage is half a page and a
       * failure is not a page at all, and drawing either of them again on the
       * next visit — over a GitHub that has since recovered — is worse than the
       * skeleton this exists to remove.
       */
      return where === undefined
        ? running
        : running.pipe(Effect.tap((value) => Effect.sync(() => keepDrawn(where, value))))
    })

    /*
     * Coming back to the tab is a re-read, every time. A list of pull requests
     * goes stale in ways nothing in here can listen for — someone else
     * reviewed, a check landed, a machine slept — and what they have in common
     * is the moment they stop mattering: the reader is looking again, and about
     * to act on what this says.
     *
     * `windowFocusSignal` is the `visibilitychange` listener this hook used to
     * add itself, and the stale time is the one thing it never had: two screens
     * of ours in the same second — a card opened from the list and the list
     * behind it — no longer cost two full reads.
     */
    const watched = Atom.swr(read, {
      staleTime: FRESH,
      revalidateOnFocus: "always",
      focusSignal: Atom.windowFocusSignal
    })

    /*
     * Wrapped, so that a change can be shown against it before GitHub has been
     * asked. A successful ask refreshes this — which is the re-read that used
     * to be wired up by hand after every write, now happening behind a screen
     * that already shows the answer rather than in front of one that does not.
     */
    const shown = Atom.optimistic(watched)

    const meanwhile = Atom.optimisticFn(shown, {
      reducer: (held: AsyncResult.AsyncResult<T, unknown>, asked: Meanwhile<T>) =>
        held._tag === "Success" ? AsyncResult.success(asked.change(held.value)) : held,
      // Whatever the caller is asking GitHub for. Its failure is what rolls the
      // change back; nothing here needs to know what it was.
      fn: Atom.fn((asked: Meanwhile<T>) => asked.work)
    })

    /**
     * What the last visit left behind, where this platform keeps such things.
     *
     * An atom whose value nobody reads: it exists to be mounted, because
     * mounting it is what asks the store at all, and what it has to say it says
     * by putting it where the stages of a staged read go.
     */
    const remembering = Atom.make((get: Atom.AtomContext) =>
      preload === undefined
        ? Effect.void
        : preload().pipe(
            Effect.map((was) => {
              // Only while nothing better has arrived. A memory landing after
              // GitHub's own answer is a list going backwards.
              if (Option.isSome(was) && Option.isNone(get.get(early))) {
                remembered = true
                get.set(early, was)
              }
            })
          )
    )

    return { early, read: watched, shown, meanwhile, remembering }
  }, [load, preload, where])

  const live = useAtomValue(atoms.shown)
  /*
   * The same read, asked before the optimistic wrapper.
   *
   * `Atom.optimistic` drops a success that is still waiting — `if (!value.waiting
   * && …)` — which is right for the value and loses the one bit that says a read
   * is running. Coming back to the tab starts exactly that read, and through the
   * wrapper it is indistinguishable from nothing happening.
   */
  const watching = useAtomValue(atoms.read)
  const early = useAtomValue(atoms.early)
  const again = useAtomRefresh(atoms.read)
  const ask = useAtomAsk(atoms.meanwhile)

  useAtomValue(atoms.remembering)

  const meanwhile = useCallback(
    (change: (value: T) => T, work: Effect.Effect<unknown, unknown>) =>
      ask({ change, work }).pipe(Effect.asVoid),
    [ask]
  )

  const read = shownFrom(live, early)

  return {
    read,
    // Both halves are needed. `isWaiting` is true for the very first read as well,
    // when there is nothing underneath it to be catching up with.
    catchingUp: read.status === "ready" && AsyncResult.isWaiting(watching),
    again,
    meanwhile
  }
}
