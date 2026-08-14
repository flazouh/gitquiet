import { Effect, Fiber, Option } from "effect";
import { forgetIntent, intendedPath } from "@/app/intent";
import {
  closePullRequest,
  convertToDraft,
  markReadyForReview,
  mergePullRequest,
  reopenPullRequest,
} from "@/app/pullRequest";
import {
  loadActivity,
  loadRepositories,
  rememberedActivity,
  rememberedRepositories,
} from "@/app/destinations";
import { drawingIssues } from "@/app/rows";
import { loadWorkingSet, rememberedWorkingSet } from "@/app/workingSet";
import { fromPathname, type PullRequestRef } from "@/domain/PullRequestRef";
import type { RowDoing } from "@/domain/doable";
import type { Sitting } from "@/domain/sittings";
import { initialiseErrorReporting, reportError } from "@/observability/sentry";
import type { View } from "@/domain/Settings";
import { chosenView } from "@/app/settings";
import { isHome, showsWorkingSet } from "@/domain/pages";
import { answerPressesIn, drawingOurOwnRows, goTo } from "@/ui/going";
import { handBack, markPage, reveal, ungate } from "@/ui/mount";
import { whenLocationChanges } from "@/ui/navigation";
import { DASHBOARD, HOME, type Place } from "@/ui/place";
import { standAScreen } from "@/shell/screen";
import { settings, throughGitHub } from "@/shell/supplied";
import type { RepositoryActivity } from "@/domain/activity";
import type { Repository } from "@/domain/repositories";
import { Home } from "@/ui/Home";
import { loginOnPage, participantOnPage } from "@/ui/viewer";
import { WorkingSetScreen } from "@/ui/WorkingSetScreen";
import "@/ui/styles.css";

/**
 * Which app-level write each verb a row can offer stands for.
 *
 * Only the five the state alone allows — see `whatStateAllows` — since the
 * queue verbs need a merge state no row has read. Asked for by name so the menu
 * hands over a verb rather than a function, which is what lets the same menu
 * serve a surface whose gateway is nothing like this one.
 */
const WRITES = {
  merge: mergePullRequest,
  close: closePullRequest,
  reopen: reopenPullRequest,
  markReady: markReadyForReview,
  toDraft: convertToDraft,
} as const satisfies Record<RowDoing, (reference: PullRequestRef) => unknown>;

/**
 * The list as the reader last saw it, kept for as long as this document lives.
 *
 * A press on a row is answered without loading a page, so this script outlives
 * the list it drew and is still holding the whole of what was on the screen when
 * the reader comes back to it — Courts, stacks, sizes, check counts and all.
 *
 * That is worth much more than what the store can offer. Only GitHub's own
 * payloads for the six shelves are kept between visits, so a remembered list has
 * rows and nothing else: no stacks, because those are read one merge box at a
 * time, and no sizes. Coming back to a list that has lost its shape reads as a
 * list that has been reloaded, which is precisely what did not happen.
 */
let asLastSeen = Option.none<ReadonlyArray<Sitting>>();

const isPullRequest = (path: string): boolean =>
  Option.isSome(fromPathname(path));

/**
 * Which of GitHub's pages this list is being drawn on.
 *
 * Two, and the same list on both. Their pull request dashboard is where it started;
 * home is where `docs/spec/home.md` puts it as the first of three Destinations, and the
 * Courts are read from GitHub rather than from the path, so nothing about the list
 * itself changes. What changes is the markup around it — a `react-app` region on one, a
 * Rails column on the other — and everything the gate does is keyed on that.
 */
const placeAt = (path: string): Place => (isHome(path) ? HOME : DASHBOARD);

/**
 * Puts the Working Set on the page, and hands back the way to take it off again.
 *
 * The closing half is not tidiness. GitHub navigates without loading a page, so
 * the list would otherwise still be standing when the reader has moved on, and
 * the attribute holding GitHub's own list out of sight would still be set over a
 * page that is not a list at all.
 */
const open = (place: Place): (() => void) => {
  /**
   * The issues in the Courts, said for the screen that a press on one of them
   * opens.
   *
   * Half of what this list holds is issues, and pressing one of those used to
   * leave the reader on a page saying "Reading this issue…" for seconds. The row
   * is the issue's header, so the row is handed over. Pull requests are not: a
   * card is read ahead on the hover and opens from the store. See
   * `src/app/rows.ts`.
   */
  const drawn = (sittings: ReadonlyArray<Sitting>): void =>
    drawingIssues(
      window,
      sittings.flatMap((sitting) => sitting.issues),
    );

  // Started before anything is waited on. Reading the Working Set and waiting for
  // GitHub to render a region to stand in have nothing to say to each other, and
  // running them one after the other spends the whole of GitHub's page load doing
  // nothing.
  const reading = () =>
    loadWorkingSet().pipe(
      throughGitHub,
      // Held as it lands, so that coming back to this list is the list rather
      // than a paler copy of it read out of the store.
      Effect.tap((sittings) =>
        Effect.sync(() => {
          asLastSeen = Option.some(sittings);
          drawn(sittings);
        }),
      ),
      Effect.tapError((error) => Effect.sync(() => reportError(error))),
    );

  // Forked rather than described: the read is in the air from here, and the
  // screen joins whatever it has got to by the time it mounts.
  const first = Effect.runFork(reading());

  /*
   * What to show while the live read finds out what is there now, asked for
   * beside it rather than after it: arriving first is the whole of its value.
   *
   * Whatever was last on the screen, where this document has had this list up
   * before — instantly, from memory, and complete. Otherwise what the last visit
   * left in the store, which is a few milliseconds against most of a second for
   * six shelves, and rows without their stacks or their sizes.
   */
  const remembered = () =>
    (Option.isSome(asLastSeen)
      ? Effect.succeed(asLastSeen)
      : rememberedWorkingSet().pipe(
          throughGitHub,
          // Nothing remembered, or a store that would not answer. Neither is worth
          // reporting: the live read is on its way and is the answer either way.
          Effect.catch(() =>
            Effect.succeed(Option.none<ReadonlyArray<Sitting>>()),
          ),
        )
    ).pipe(
      // Whichever of the two is on the screen is the one whose rows a press lands
      // on, so both say what they hold.
      Effect.tap((was) =>
        Effect.sync(() => {
          if (Option.isSome(was)) drawn(was.value);
        }),
      ),
    );

  // The first ask joins what is already in flight; every ask after it is
  // somebody saying the Working Set has changed, and joining that same finished
  // fiber would answer with the list they are trying to leave.
  let started = false;
  const read = () => {
    if (!started) {
      started = true;
      return Fiber.join(first);
    }
    return reading();
  };

  /**
   * One verb, against one row.
   *
   * The same four writes the card offers, reached from the list instead — plus
   * the reopening the card has never offered, a closed pull request being a row
   * here and no card at all. Refusals come back to the menu that asked for them
   * and are reported, as everywhere else that writes.
   */
  const askFor = (doing: RowDoing, reference: PullRequestRef) =>
    WRITES[doing](reference).pipe(
      throughGitHub,
      Effect.tapError((error) => Effect.sync(() => reportError(error))),
    );

  /**
   * Enter, rather than a press.
   *
   * The same journey a press makes, asked for by hand: the keyboard has no link
   * for the browser to follow, and there is nothing about arriving by keyboard
   * that should cost a document a press does not.
   */
  const openWithTheKeyboard = (reference: PullRequestRef): void => {
    goTo(
      window,
      `/${reference.owner}/${reference.repo}/pull/${reference.number}`,
    );
  };

  return standAScreen({
    place,
    /*
     * Said before a press can happen rather than while one is being answered: the shell
     * asks for the card on `pointerdown`, so the screen that has to read this has
     * already started by the time a handler in this tree is reached.
     *
     * Every pull request on the list is one this screen can hand the page to, because
     * the card is drawn where this list is standing.
     */
    holding: (container) => {
      drawingOurOwnRows(window, true);
      const stopAnswering = answerPressesIn(container, window, isPullRequest);
      return () => {
        // Off the page: whatever is on it now draws its own rows and answers its own
        // presses.
        drawingOurOwnRows(window, false);
        stopAnswering();
      };
    },
    draw: (standing) =>
      place === HOME ? (
        // Home is the page whose navigation this extension takes — their sidebar of
        // repositories is hidden, and their own readers asked for one such list rather
        // than two. Home is also the only screen the Rail is on: every other one keeps
        // whatever navigation it already has rather than growing a second strip.
        <Home
          load={read}
          preload={remembered}
          onOpen={openWithTheKeyboard}
          onStepAside={standing.stepAside}
          ask={askFor}
          repositories={() => loadRepositories().pipe(throughGitHub)}
          rememberedRepositories={() =>
            rememberedRepositories().pipe(
              throughGitHub,
              Effect.catch(() => Effect.succeed(Option.none<ReadonlyArray<Repository>>())),
            )
          }
          activity={() => loadActivity(loginOnPage() ?? "").pipe(throughGitHub)}
          rememberedActivity={() =>
            rememberedActivity(loginOnPage() ?? "").pipe(
              throughGitHub,
              Effect.catch(() =>
                Effect.succeed(Option.none<ReadonlyArray<RepositoryActivity>>()),
              ),
            )
          }
          participant={participantOnPage()}
        />
      ) : (
        <WorkingSetScreen
          load={read}
          preload={remembered}
          onOpen={openWithTheKeyboard}
          onStepAside={standing.stepAside}
          ask={askFor}
          /*
           * The bar's own two, which Home reads off GitHub for the Rail and this page
           * does not read at all: the face off their markup, and the switcher's list
           * out of what the last visit kept. Nothing here costs a request.
           */
          participant={participantOnPage()}
          recallRepositories={() =>
            rememberedRepositories().pipe(
              throughGitHub,
              Effect.catch(() =>
                Effect.succeed(Option.none<ReadonlyArray<Repository>>()),
              ),
            )
          }
        />
      ),
  }).close;
};

/**
 * Puts the Working Set in charge of the document, once.
 *
 * Called by the shell — the one script that is on every GitHub page and cannot be
 * navigated away from. "Pull requests" in GitHub's own nav is a soft navigation
 * from anywhere on the site, so this was never a page a content script's matches
 * could catch: it arrived by the worker, and how long the worker took to wake is
 * how long GitHub's own dashboard was on the screen.
 */
export const start = (): void => {
  // Before anything else, because the rules that hide GitHub's own dashboard are
  // written per page and hang on this. Said again per arrival below, where the address
  // is known for certain — this list stands on two of their pages now, and marking it
  // as the wrong one holds back a region that is not on the screen.
  const arrivedOn = window.location.pathname;
  if (showsWorkingSet(arrivedOn)) markPage(document, placeAt(arrivedOn));

  initialiseErrorReporting("working-set");

  const store = settings();

  let close = (): void => {};
  let view: View = "ours";

  /*
   * Which of GitHub's pages this list is standing on, where it is on one.
   *
   * A boolean until home was one of them, because there was only one page to be drawn
   * on. It has to name the place now: `/pulls` and `/` are the same list in different
   * markup, and a list left standing across that move would be holding a container in a
   * region GitHub has just thrown away, under rules written for the page being left.
   */
  let standing: Place | null = null;

  const show = (path: string): void => {
    const place = showsWorkingSet(path) ? placeAt(path) : null;

    /*
     * This page, at a second address. `/pulls` is not a page GitHub serves: it
     * answers with the dashboard and then redirects to `/pulls/inbox` a tenth of
     * a second later, so arriving here by their own nav is two addresses rather
     * than one. Closing and opening again would take a finished list off the
     * screen and stand an empty one in its place to read the identical thing —
     * a hole for as long as that read takes, which on a cold store is not brief.
     *
     * The same place, though, not merely the same list: moving between their dashboard
     * and home is a page GitHub really does render again, and the list has to be
     * stood up in the region that arrives with it.
     */
    if (place !== null && place === standing) return;

    close();
    close = () => {};
    standing = null;

    /*
     * Somewhere else entirely. The stylesheet is gating this page too, because
     * a stylesheet cannot read a URL, so handing it back is the first thing this
     * does before anything slower can delay it past a paint.
     *
     * Revealed, but deliberately not ungated. This also runs the instant a
     * reader leaves the Working Set for a pull request, while GitHub is still
     * on its way there: the address then says pull request, and the
     * conversation about to be rendered is precisely the thing the other gate
     * is holding back for the card that is being injected.
     */
    if (place === null) {
      handBack(document);
      return;
    }

    // Their list, because that is what was asked for last time. Nothing is
    // read, nothing is drawn, and the gate comes off at once.
    if (view === "github") {
      reveal(document);
      ungate(document);
      return;
    }

    // Ahead of the gate `open` puts up, since the rules it switches on are the ones
    // written for this page — and on a move between the two, the name on the document
    // is still the page being left.
    markPage(document, place);
    standing = place;
    close = open(place);
  };

  whenLocationChanges(window, show);

  // Nothing is drawn until the choice is known, so a reader who wants GitHub's
  // page is not charged eight requests for an interface they turned off.
  Effect.runFork(
    chosenView(store).pipe(
      Effect.map((chosen) => {
        view = chosen;

        // What the address says, or — while GitHub is still fetching and the
        // address still names the page being left — what the reader pressed.
        // The second is how this arrives at all when the worker injects it:
        // the press is a second ahead of the address, and waiting for the
        // address would be waiting for permission to do work already possible.
        const here = window.location.pathname;
        const promise = intendedPath(window);
        forgetIntent(window);

        if (showsWorkingSet(here)) show(here);
        else if (promise !== null && showsWorkingSet(promise)) show(promise);
        else reveal(document);
      }),
    ),
  );
};
