import type { Effect, Option } from "effect";
import { type ReactNode, useMemo } from "react";
import type { PullRequestRef } from "../domain/PullRequestRef";
import type { Destination } from "../domain/Settings";
import { LEADS_TO, type RowDoing } from "../domain/doable";
import type { Repository } from "../domain/repositories";
import { owedIn } from "../domain/finding";
import { afterDoing, saysItIs, type Sitting } from "../domain/sittings";
import { repositoriesAtWork, type RepositoryAtWork } from "../domain/rail";
import type { Keys } from "../keys/commands";
import { Rail } from "./Rail";
import { TheBar } from "./TheBar";
import { useWaiting } from "./useWaiting";
import { Waiting } from "./Waiting";
import { ReadFailed, viewerOnPage } from "./ReadFailed";
import { DrawnAt } from "./drawnAt";
import type { Asking } from "./Doings";
import { type Load, useLive } from "./useLive";
import { WorkingSet } from "./WorkingSet";

export type WorkingSetScreenProps = {
  readonly load: Load<ReadonlyArray<Sitting>>;
  /**
   * The Working Set as it was last time, for the screen to show while {@link load}
   * finds out what it is now. Whatever it gives goes the moment the live read
   * answers, either way — a read that failed leaves the failure rather than what was
   * remembered, which is the only age nothing here can bound.
   */
  readonly preload?: () => Effect.Effect<Option.Option<ReadonlyArray<Sitting>>>;
  /** What this page is called in this document's memory. See {@link useLive}. */
  readonly where?: string;
  /** The exact pathname this screen stands for, as {@link DrawnAt} needs it said. */
  readonly at?: string;
  readonly onOpen: (reference: PullRequestRef) => void;
  /** Restores GitHub's own list, which is still on the page behind this. */
  readonly onStepAside: () => void;
  /** The repositories the reader pinned, and how the screen remembers a change. */
  readonly pinned?: ReadonlyArray<string>;
  readonly onPinned?: (pinned: ReadonlyArray<string>) => void;
  readonly keys?: Keys;
  /**
   * Whether GitHub has anyone signed in, asked only when a read has failed.
   * Overridden in tests; in the browser it is the page's own answer.
   */
  readonly signedIn?: () => boolean;
  /**
   * How a row's menu asks GitHub for something, where this surface can write.
   *
   * The screen supplies what happens afterwards, since it is the thing holding
   * the read: every verb here changes which Court a pull request belongs to, so
   * the list asks GitHub again rather than editing the row it just changed.
   */
  readonly ask?: (
    doing: RowDoing,
    reference: PullRequestRef,
  ) => Effect.Effect<void, unknown>;
  /**
   * Whether this list is Home rather than their pull request dashboard.
   *
   * The same list either way — the Courts are read from GitHub, not from the address —
   * and the difference is the Rail beside it. On Home there is no navigation of GitHub's
   * left: this screen took their sidebar, which is the thing their own readers asked to
   * have replaced rather than duplicated. On `/pulls` their nav is still up the page, and
   * a second strip of navigation there would be the duplication all over again.
   */
  readonly home?: boolean;
  /**
   * Which of Home's three Destinations is showing.
   *
   * Kept by the settings record rather than by the address, which is the one decision here
   * worth defending: `/` is GitHub's address and pushing our own onto it would put a page
   * in their history that their soft navigation knows nothing about. A reader who wants
   * Repositories every morning says so once in Settings; a reader who wants it for one
   * minute presses it in the Rail and the choice is theirs until they change it.
   */
  readonly destination?: Destination;
  readonly onDestination?: (destination: Destination) => void;
  /** Whether the Rail starts narrow, and how to remember that it was. */
  readonly collapsed?: boolean;
  readonly onCollapsed?: (collapsed: boolean) => void;
  /** Who the reader is, for the Rail's menu. */
  readonly participant?: {
    readonly login: string;
    readonly faceUrl: Option.Option<string>;
  };
  /**
   * Every repository the reader has, for the Rail's filter.
   *
   * Absent until that read lands, and the Rail draws the repositories it already knows from
   * the Working Set in the meantime — navigation that fills in rather than navigation that
   * waits to appear.
   */
  readonly repositories?: ReadonlyArray<Repository>;
  /**
   * The same list out of the store, for the bar's switcher on their dashboard.
   *
   * Home hands the whole list in above, having read it off GitHub for the Rail. Their
   * dashboard reads nothing of the kind — the Working Set names only the repositories
   * the reader has work in — so the switcher there is what the last visit kept, which
   * is how every screen outside Home fills it.
   */
  readonly recallRepositories?: () => Effect.Effect<
    Option.Option<ReadonlyArray<Repository>>
  >;
  /**
   * What the other two Destinations draw, supplied by whoever holds the reads.
   *
   * A function rather than two elements so that neither is built until it is asked for:
   * Activity costs a request against a limit of sixty an hour, and a Destination nobody
   * pressed should not spend one.
   */
  readonly elsewhere?: (
    destination: Exclude<Destination, "working-set">,
    atWork: ReadonlyArray<RepositoryAtWork>,
  ) => ReactNode;
};

const WORKING = "Reading your pull requests…";

/** One array rather than a new one per render, so the fold below is not redone hourly. */
const EMPTY: ReadonlyArray<Sitting> = [];

export const WorkingSetScreen = ({
  load,
  preload,
  where,
  at,
  onOpen,
  onStepAside,
  pinned,
  onPinned,
  keys,
  signedIn = viewerOnPage,
  ask,
  home = false,
  destination = "working-set",
  onDestination,
  collapsed,
  onCollapsed,
  participant,
  repositories,
  recallRepositories,
  elsewhere,
}: WorkingSetScreenProps) => {
  const live = useLive(load, preload, where);
  const { read, meanwhile } = live;
  const waiting = useWaiting(read.status);

  /*
   * The Rail's repositories, out of the read that is already on the screen.
   *
   * No request of its own, which is the whole reason this is the first of the Rail's
   * three lists: every row the Working Set draws names a repository, so "where is my
   * work" is a fold over what has already arrived. Empty while the read is in flight —
   * navigation appears immediately and fills in, rather than waiting to appear.
   */
  const sittings = read.status === "ready" ? read.value : EMPTY;
  const atWork = useMemo(() => repositoriesAtWork(sittings), [sittings]);
  const needsYou =
    sittings.find((sitting) => sitting.court === "needs-you")?.count ?? 0;
  // What ⌘K searches beside the repositories: a title half-remembered is the usual way
  // back to a pull request, and every one of them is already on this screen.
  const owed = useMemo(() => owedIn(sittings), [sittings]);

  const asking = useMemo<Asking | undefined>(
    () =>
      ask === undefined
        ? undefined
        : {
            /*
             * The change is on the screen before GitHub has been asked.
             *
             * Every verb a row offers moves the pull request to another Court,
             * and working out which one is the domain's job rather than
             * GitHub's — so the list is rearranged now, the ask goes out behind
             * it, and the read that follows either agrees or quietly puts it
             * back. What this replaced was a press, a second of a list that had
             * not moved, and then the whole thing arriving again.
             *
             * `until` is the half that keeps it there. This list is read off
             * GitHub's search, whose index is behind a write by seconds to
             * minutes, so the read that arrives just after a close is the one
             * most likely to still call the pull request open — and it used to
             * win, which put the row back under Your Move with the toast about
             * having closed it still on the screen. Now the arrangement is worn
             * until a read comes back agreeing about the state, which is the one
             * fact the verb decided.
             */
            ask: (doing, reference) =>
              meanwhile(
                {
                  change: (sittings) => afterDoing(sittings, doing, reference),
                  until: (sittings) => saysItIs(sittings, reference, LEADS_TO[doing]),
                },
                ask(doing, reference),
              ),
          },
    [ask, meanwhile],
  );

  /*
   * Above the page rather than in it: `TheBar` portals itself to the top of the document,
   * where GitHub's own bar stood.
   *
   * Held here, before any of the three things this screen can be, because all three are
   * pages of ours and a page of ours has this bar. It used to be built inside the Home
   * half alone, so their dashboard drew the list with no switcher, no palette and no way
   * to the settings — and their own header stayed up, that being hidden by the presence
   * of our bar rather than by anything else. The same reasoning covers the failure: a
   * read that did not answer is the moment a reader most needs the way off the page.
   */
  const bar = (
    <TheBar
      where={{ kind: "home" }}
      participant={participant}
      repositories={repositories}
      recall={recallRepositories}
      owed={owed}
      onStepAside={onStepAside}
    />
  );

  if (read.status === "failed") {
    return (
      <>
        {/* The failure screen is an answer too. See {@link DrawnAt}. */}
        <DrawnAt path={at ?? null} />
        {bar}
        <ReadFailed
          signedOut={!signedIn()}
          why={read.why}
          what="Your pull requests"
          onStepAside={onStepAside}
          asideLabel="Show GitHub's list"
        />
      </>
    );
  }

  const list = (
    // One wrapper for the wait and for the list, holding both in the same two
    // slots throughout, so the wait is the same element before and after GitHub
    // answers and the dissolve has a resting state to start from.
    <div className="relative">
      <DrawnAt path={read.status === "loading" ? null : (at ?? null)} />
      {read.status === "ready" ? (
        <WorkingSet
          sittings={read.value}
          onOpen={onOpen}
          scope="working-set"
          keys={keys}
          asking={asking}
          // On Home the padding belongs to the pair of columns below, not to this one alone.
          bare={home}
        />
      ) : null}
      {waiting ? (
        <Waiting what={WORKING} room="list" leaving={read.status === "ready"} />
      ) : null}
    </div>
  );

  if (!home)
    return (
      <>
        {bar}
        {list}
      </>
    );

  /*
   * Home is never a dead end.
   *
   * An empty Working Set is the good day — nothing is waiting on the reader — and GitHub's
   * answer to it is an empty page, which is the one moment their dashboard actively wastes
   * somebody's time. So the page says so in a line and offers the repositories underneath,
   * without moving the reader anywhere: the Destination they chose is still the one that is
   * marked, and pressing anything in the Rail still goes where it says.
   */
  const emptyHanded =
    destination === "working-set" &&
    read.status === "ready" &&
    sittings.every((sitting) => sitting.count === 0);

  const showing =
    destination === "working-set" ? (
      emptyHanded && elsewhere !== undefined ? (
        <div className="flex flex-col gap-3">
          {list}
          <p className="text-sm text-ink-muted">
            Nothing is waiting on you. Your repositories, in case you came looking
            for one:
          </p>
          {elsewhere("repositories", atWork)}
        </div>
      ) : (
        list
      )
    ) : (
      (elsewhere?.(destination, atWork) ?? list)
    );

  return (
    <>
      {bar}
      {/*
       * No inset here. It was on this row once, on both columns at once, so that the Rail and
       * whatever stood beside it started on the same line — and it made this the only screen
       * with a frame while the five others ran flush to the window edge. The shell owns it
       * now: `#gitquiet-root` on GitHub's page, `.page` in the window, one number for every
       * screen either of them draws.
       *
       * The Rail is handed no Participant. It can draw one, and did while it was the only
       * thing on this screen that could, but the bar above now keeps the face where GitHub
       * keeps it and where a hand already goes for it. Two of the same menu on one screen is
       * a reader wondering which of them is the real one.
       */}
      <div className="flex items-start gap-1 py-3">
        <Rail
          destination={destination}
          onDestination={onDestination ?? (() => undefined)}
          atWork={atWork}
          needsYou={needsYou}
          repositories={repositories}
          collapsed={collapsed}
          onCollapsed={onCollapsed}
          pinned={pinned}
          onPinned={onPinned}
          keys={keys}
        />
        <div className="min-w-0 flex-1">{showing}</div>
      </div>
    </>
  );
};
