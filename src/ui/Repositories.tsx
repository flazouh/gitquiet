import { Option } from "effect"
import { useMemo, useRef, useState } from "react"
import type { RepositoryAtWork } from "../domain/rail"
import { matching, pullRequestsIn, type Repository } from "../domain/repositories"
import type { Keys } from "../keys/commands"
import { FIELD, PILL } from "./dress"
import { Section } from "./Section"
import { useKeyboard } from "./useKeyboard"
import { useKeys } from "./useKeys"
import { StillReading } from "./Waiting"

/**
 * The Repositories Destination: every repository the reader has, and a box to find one in.
 *
 * The complaint this answers is a number. GitHub's own home sidebar offers ten repositories
 * under the heading "Top repositories", ranked by where the reader has recently been — and a
 * live account turned out to have a hundred and fifty-four. The other hundred and forty-four
 * are reachable only by remembering their names and typing them into a search that also
 * searches everybody else's. So the list here is deliberately the whole list, and the way
 * through it is typing rather than remembering.
 *
 * Presentational on purpose. It is handed the repositories, whatever the Working Set already
 * knows about which of them are asking something, and whether the live read has landed; it
 * decides nothing about where any of that came from. The reads, the remembering and the
 * ranking belong to the screen above it.
 */
export type RepositoriesProps = {
  /**
   * Every repository, drawn in the order it is given.
   *
   * Ranking is `ranked`'s job in the domain and the screen's to ask for, the same way the
   * Rail is handed an order rather than choosing one. A list that is navigation must not
   * reorder itself while somebody is reaching for a row of it.
   */
  readonly repositories: ReadonlyArray<Repository>
  /**
   * What the Working Set already knows: the reader's own open pull requests, per repository.
   *
   * A fold over a read that has already happened, so a row can say a repository is asking for
   * something without this component asking GitHub anything. Absent where that read has not
   * landed, and then the rows simply say less rather than saying nothing.
   */
  readonly atWork?: ReadonlyArray<RepositoryAtWork>
  /**
   * Whether the live read is still out.
   *
   * The list opens from what was remembered, so `waiting` usually arrives with rows already
   * on the screen: it means "this may be a read old", not "there is nothing here yet". Both
   * states are worth saying, and they are not the same sentence.
   */
  readonly waiting?: boolean
  readonly keys?: Keys
}

/**
 * Whose repository it is, as a picture.
 *
 * Decoration beside a name and never instead of one — `alt=""` and the address in text next
 * to it — because a reader with four owners across a hundred and fifty repositories groups
 * the list by eye without reading a single one, and a reader with a screen reader gets the
 * name they would have got anyway. A rounded square rather than a circle, which is GitHub's
 * own distinction between a place and a person.
 *
 * Where GitHub gave no face the initial stands in, so the names stay in one column instead of
 * stepping left and right down the page depending on who has an avatar.
 */
const Face = ({ one, size = 16 }: { readonly one: Repository; readonly size?: number }) => (
  <span
    aria-hidden="true"
    className="flex shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface text-[8px] font-semibold uppercase text-ink-muted"
    style={{ width: size, height: size }}
  >
    {Option.match(one.faceUrl, {
      onNone: () => one.owner.slice(0, 1),
      onSome: (src) => <img alt="" src={src} width={size} height={size} />
    })}
  </span>
)

const Row = ({ one, work }: { readonly one: Repository; readonly work?: RepositoryAtWork }) => (
  /*
   * The same row the Working Set draws: named for the two stylesheets that reach for
   * whatever lights under the pointer, lit on the whole line rather than on the text
   * inside it, and divided from its neighbour by the list rather than by a gap. It was
   * a floating pill with rounded corners and a gap under it, which is a different
   * component wearing the same words.
   */
  <li data-row="" className="flex items-center hover:bg-hover">
    <a
      // Their pull requests rather than their code: it is the page this extension already
      // draws, and looking for a repository at all is usually looking for what is open in it.
      href={pullRequestsIn(one)}
      /*
       * No `aria-label`, deliberately. Everything a row says is real text — the address,
       * whether it is private, how much of it is the reader's — so the accessible name is
       * built from the same words that are on the screen and cannot fall behind them, which
       * is what a hand-written label eventually does.
       */
      className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-sm no-underline"
    >
      <Face one={one} />

      <span className="min-w-0 truncate font-mono text-xs text-ink">{one.nameWithOwner}</span>

      {/*
       * Private in words rather than in a colour or a padlock. Half the rows in a real
       * account are private and the fact changes what a reader is willing to paste into a
       * message, so it has to survive being read aloud and being read by somebody who cannot
       * tell the two greys apart.
       */}
      {one.isPrivate ? (
        <span className={`${PILL} shrink-0 text-xs text-ink-muted`}>Private</span>
      ) : null}

      {/*
       * Empty is worth saying before the press rather than after it: a repository with
       * nothing pushed to it has no pull requests either, and the page this row leads to
       * would be a blank one with no explanation on it.
       */}
      {one.isEmpty ? <span className="shrink-0 text-xs text-ink-muted">Empty</span> : null}

      {work === undefined ? null : (
        <span className="ml-auto flex shrink-0 items-center gap-2">
          {/*
           * Whose move it is leads, because it is the only thing in the row that is a
           * request. A count of open pull requests says how busy a repository is; this says
           * it is waiting on the person reading it.
           */}
          {work.needsYou > 0 ? (
            <span className={`${PILL} text-xs text-ink-accent`}>
              {`${work.needsYou} your move`}
            </span>
          ) : null}
          <span className="text-xs text-ink-muted tabular-nums">{`${work.count} open`}</span>
        </span>
      )}
    </a>
  </li>
)

export const Repositories = ({
  repositories,
  atWork = [],
  waiting = false,
  keys: given
}: RepositoriesProps) => {
  const keys = useKeyboard(given)
  const [typed, setTyped] = useState("")
  const box = useRef<HTMLInputElement | null>(null)

  const shown = useMemo(() => matching(repositories, typed), [repositories, typed])

  const work = useMemo(
    () => new Map(atWork.map((one) => [`${one.owner}/${one.repo}`, one])),
    [atWork]
  )

  /*
   * `/` reaches the box and Escape empties it, which are the two keys anybody who has used
   * GitHub already presses. `/` is theirs as well — it opens their search — so it has to be
   * taken out of the air rather than merely listened for, which is what {@link useKeys} does
   * in the capture phase.
   *
   * It refuses to fire while anything is being typed in, and that refusal is the point: a
   * reader looking for `flazouh/octo-repo` types a slash in the middle of the name, and a shortcut
   * that swallowed it would make the one list that is searched by address unsearchable by
   * address. Escape inside the box is answered by the box itself for the same reason — the
   * keyboard goes quiet while somebody is typing, and this is the one key that still has to
   * mean something there.
   */
  useKeys(keys, {
    search: () => box.current?.focus(),
    dismiss: () => setTyped("")
  })

  return (
    // Unpadded: this only ever stands in a Destination on Home, which is inset with the Rail
    // beside it. Padding here as well put the list sixteen pixels further in than the strip
    // it lines up against.
    // `t-panels` for the same reason the Courts have it: the box and the card under it
    // rise into place forty milliseconds apart, so the Destination assembles itself the
    // way the Working Set does instead of appearing all at once beside a list that does.
    <nav aria-label="Repositories" className="t-panels flex flex-col gap-3">
      {/*
       * The box runs the width of the card under it, the way the Working Set's filters run
       * the width of the Courts. Held to `max-w-lg` it was half a line long above a list
       * that was not, which read as two panels that had been laid out separately.
       */}
      <div className="flex items-center gap-3">
        <input
          ref={box}
          type="search"
          aria-label="Filter your repositories"
          placeholder="Filter by owner or name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return
            setTyped("")
          }}
          className={`${FIELD} h-8 min-w-64 grow px-3 text-sm`}
        />

      </div>

      {/*
       * Not the whole-page wait. That one carries the attribute the click benchmark reads to
       * decide when a reader could start reading, and this list has usually been drawn from
       * memory already — claiming to be unread while a hundred rows are on the screen would
       * quietly spoil every measurement taken since.
       */}
      {waiting ? <StillReading what="Still reading every repository you have." /> : null}

      {repositories.length === 0 && waiting ? null : (
        /*
         * One card, the same one a Court is drawn in, rather than a bare run of rows on the
         * page. The Working Set next door is three of these, and a Destination that dropped
         * the box, the border and the header for the same content read as a different app a
         * press away.
         */
        <Section
          name="Repositories"
          art="repositories"
          summary={
            /*
             * How many of how many, spoken as it changes, and now in the header where a
             * Court keeps its count. With a hundred and fifty-four of them the count is the
             * only way to know whether a word narrowed the list to the one that was wanted
             * or to nothing at all, and a reader who cannot see the rows shorten needs
             * telling rather than showing. The total on its own before anything is typed:
             * "154 of 154" is a line spending itself to say the same number twice.
             */
            <span aria-live="polite" className="tabular-nums">
              {typed.trim().length === 0
                ? `${repositories.length}`
                : `${shown.length} of ${repositories.length}`}
            </span>
          }
        >
          {repositories.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">
              You have no repositories yet. One you are added to will appear here.
            </p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-2 text-sm text-ink-muted">
              Nothing matches that.{" "}
              <button
                type="button"
                onClick={() => {
                  setTyped("")
                  box.current?.focus()
                }}
                className="rounded text-sm text-ink-accent hover:bg-hover"
              >
                Clear the filter
              </button>
            </p>
          ) : (
            <ul
              aria-label="Every repository you have"
              className="flex list-none flex-col p-0"
            >
              {shown.map((one) => (
                <Row key={one.nameWithOwner} one={one} work={work.get(one.nameWithOwner)} />
              ))}
            </ul>
          )}
        </Section>
      )}
    </nav>
  )
}
