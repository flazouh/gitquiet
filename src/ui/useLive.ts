import { Cause, Effect, Option } from "effect"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAtomRefresh, useAtomValue } from "./atoms"
import { keepDrawn, lastDrawn } from "./lastDrawn"
import { wornOut } from "./worn"

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

/**
 * A change the reader has made, worn over every read until GitHub agrees.
 *
 * Both halves are required, and the second is the one worth explaining. A write
 * that GitHub answers 200 to is not a write GitHub's reads know about yet: their
 * search index is behind by seconds to minutes, their run page keeps saying "In
 * progress" for a while after a cancel. So "the write worked" is the wrong moment
 * to stop showing the change — at that moment the confirming read is at its most
 * likely to still describe the world as it was, and it would win.
 *
 * `until` is how a caller says what agreement looks like: given a read, has GitHub
 * caught up with this? The change is worn until that answers yes, and only then is
 * the read left to speak for itself.
 */
export type Worn<T> = {
  readonly change: (value: T) => T
  readonly until: (value: T) => boolean
}

export type Live<T> = {
  readonly read: Read<T>
  /** Reads again, keeping what is on the screen if the new read fails. */
  readonly again: () => void
  /**
   * Shows a change now, and keeps showing it until GitHub says the same thing.
   *
   * The list is the reader's answer to what to do next, and every write they
   * can make from it changes which part of it a row belongs to. Waiting for
   * eight requests to find that out means pressing Close and watching nothing
   * happen for most of a second — so the change is applied to what is on the
   * screen and the ask goes out behind it.
   *
   * What the read that follows does with it is the whole of {@link Worn}: it
   * confirms the change and the change comes off, or it is a read taken mid-lag
   * and the change stays on. Dropping it the moment the write succeeded is what
   * this used to do, and it is the one moment that cannot be trusted: a pull
   * request closed from a row was back under Your Move a second later, wearing
   * the check badge it had before, because GitHub's own list had not caught up.
   *
   * Hands back an effect that answers as GitHub did, because the control that
   * asked is usually the only place a refusal makes sense: the row menu says why
   * on the item that was pressed, and a rollback with no sentence attached is a
   * row that moved and moved back for reasons nobody was told.
   */
  readonly meanwhile: (
    worn: Worn<T>,
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

/** One {@link Worn} change, and when it was made, so it can be given up on. */
type Wearing<T> = Worn<T> & { readonly at: number }

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

    return { early, read: watched, remembering }
  }, [load, preload, where])

  const live = useAtomValue(atoms.read)
  const early = useAtomValue(atoms.early)
  const again = useAtomRefresh(atoms.read)

  useAtomValue(atoms.remembering)

  /**
   * Every change the reader has made that GitHub has not yet said back.
   *
   * Held here rather than folded into the atom, because it is not something the
   * read has an opinion about: the read is GitHub's answer, and this is the list
   * of things that answer is allowed to be behind on.
   */
  const [worn, setWorn] = useState<ReadonlyArray<Wearing<T>>>([])

  const said = shownFrom(live, early)

  /*
   * Which of them are still worth wearing, decided against the read itself.
   *
   * Worked out here rather than in an effect so that a read which agrees is drawn
   * agreeing on the same frame it arrives. Doing it after the paint would show the
   * change over a read that no longer needs it — harmless, since a change GitHub
   * agrees with makes no difference — but it would also mean the one frame where
   * the two disagree is decided by whichever ran first, which is not a thing to
   * leave to chance on a list somebody is about to press.
   */
  const now = Date.now()
  const standing =
    said.status === "ready"
      ? worn.filter((one) => !wornOut(one.at, now) && !one.until(said.value))
      : worn

  /*
   * The pruning, which is only about memory. `standing` is already what is drawn;
   * this is what stops the array growing for the life of a long-lived list screen.
   * Compared by length because entries are only ever appended and filtered, never
   * rewritten, so a shorter list is the only way one can have gone.
   */
  useEffect(() => {
    if (standing.length !== worn.length) setWorn(standing)
  }, [standing, worn])

  const meanwhile = useCallback(
    (one: Worn<T>, work: Effect.Effect<unknown, unknown>) => {
      const wearing: Wearing<T> = { ...one, at: Date.now() }
      setWorn((held) => [...held, wearing])

      return work.pipe(
        /*
         * A refusal takes it straight back off. GitHub has said this did not
         * happen, so there is nothing to be behind on and nothing to wait for —
         * the read was right all along and the reader is owed the sentence saying
         * so, which is the caller's half of this.
         */
        Effect.tapError(() =>
          Effect.sync(() => setWorn((held) => held.filter((each) => each !== wearing)))
        ),
        // And a success asks again, which is what gives `until` something to
        // answer. The change stays on until it does.
        Effect.tap(() => Effect.sync(again)),
        Effect.asVoid
      )
    },
    [again]
  )

  const read =
    said.status === "ready" && standing.length > 0
      ? {
          status: "ready" as const,
          value: standing.reduce((value, one) => one.change(value), said.value)
        }
      : said

  return { read, again, meanwhile }
}
