import { Effect, Option } from "effect";
import { defineContentScript } from "wxt/utils/define-content-script";
import { screenFor, type Wanted } from "@/app/screens";
import { intendTo, intendedPath } from "@/app/intent";
import { oursToOpen } from "@/app/pressing";
import { readingAhead } from "@/app/readAhead";
import { type Ahead, type Connection, dataToSpare, warmingFor } from "@/app/warming";
import { isHome } from "@/domain/pages";
import { elsewhereThan, type PullRequestRef } from "@/domain/PullRequestRef";
import { noteArrival } from "@/github/arrival";
import { layer as gatewayLayer } from "@/github/GitHubGateway";
import { initialiseErrorReporting, reportError } from "@/observability/sentry";
import type { View } from "@/domain/Settings";
import { browserSettings } from "@/settings/browserStore";
import {
  addressIn,
  answerPress,
  aPlainPress,
  ARRIVING,
  drawingOurOwnRows,
  goTo,
} from "@/ui/going";
import {
  markPage,
  theScreenArrived,
  theScreenIsNotElsewhere,
  unmarkPage,
} from "@/ui/mount";
import { linkNear, type Reached } from "@/ui/linkNear";
import {
  forwardness,
  lingerFor,
  type Lingering,
  NOTHING,
  type Seen,
  smoothed,
} from "@/ui/lingering";
import { hintRead, showLingering } from "@/ui/lingeringHint";
import type { Point } from "@/ui/near";
import { type Stop, whenAddressChanges, whenTheyStayPut } from "@/ui/navigation";
import {
  ACTIONS,
  COMMIT,
  COMMITS,
  CONVERSATION,
  DASHBOARD,
  HOME,
  ISSUE,
  ISSUES,
  NOTIFICATIONS,
  PERSON_REPOS,
  PROFILE,
  RAISE,
  RELEASES,
  REPO_HOME,
  REPO_ISSUES,
  REPO_PULLS,
  RUN,
  SIGN_ON,
  type Place,
  placeLoadedOn,
  placeOwning,
} from "@/ui/place";
import "@/ui/gates.load.css";
import "@/ui/gates.soft.css";
import "@/ui/gates.bar.css";

/**
 * How many pull requests one visit to one page will read ahead.
 *
 * Reading a pull request is seven requests to GitHub, made with the reader's own
 * session: the changes, and the six `page_data` routes their own page asks for.
 * A list they linger over should not turn into a hundred of them.
 *
 * Twelve is eighty-four requests, which is close enough to their limit to be
 * worth knowing about. Benchmarking this repository tripped it — GitHub answered
 * 503 to every route for several minutes, and what the reader sees when that
 * happens is "Something GitHub sends has changed" on a page that reads fine a
 * quarter of an hour later.
 */
const AT_MOST = 12;

/**
 * How long the conversation is held back before giving up on the interface.
 *
 * Only reached when the screen never arrives — the file would not load, the
 * extension was reloaded underneath the page and its files are gone. In every one
 * of those cases GitHub's own conversation is the right thing to show, and the
 * reader should not be looking at a gap while we work that out.
 *
 * Much less likely to be reached than it was. This used to cover a worker that was
 * asleep and stayed asleep, which is a thing that happens to every reader every day;
 * a module import from the extension's own files has nobody to wake.
 */
const GIVE_UP = 8_000;

/** Set while a pull request is being navigated to and the interface is not up yet. */
const GATING = "data-gitquiet-gating";

/**
 * Which of GitHub's pages each screen stands on, for the rules that hide it.
 *
 * Two names for five pages, and they are deliberately not the same names: a screen
 * is what this extension shows, a place is what GitHub renders. `place.ts` calls a
 * pull request's page its conversation because that is the region being replaced.
 */
const PLACE_OF: Record<Wanted, Place> = {
  "pull-request": CONVERSATION,
  commit: COMMIT,
  commits: COMMITS,
  "working-set": DASHBOARD,
  "repo-pulls": REPO_PULLS,
  "repo-home": REPO_HOME,
  issue: ISSUE,
  "repo-issues": REPO_ISSUES,
  raise: RAISE,
  issues: ISSUES,
  run: RUN,
  actions: ACTIONS,
  releases: RELEASES,
  notifications: NOTIFICATIONS,
  "person-repos": PERSON_REPOS,
  profile: PROFILE,
  /*
   * The one entry here that `pageAt` can never return, because its place is
   * deliberately absent from the routing table: a wall has no address of its own.
   * It is reached from the bottom of `main` instead, where the document is read.
   */
  "sign-on": SIGN_ON,
};

/**
 * The same lookup, told which address it is for.
 *
 * One screen stands on two of GitHub's pages: the Working Set is their pull request
 * dashboard at `/pulls` and it is home's first Destination at `/`, and those are
 * different regions of different markup. Everything the gate does is keyed on the
 * place, so asking for the screen's usual one on home would hide the wrong column and
 * hold back a region that is not there.
 *
 * Asked with the address being *gone to* rather than the one on the screen, which on a
 * press is not the same string for another few hundred milliseconds.
 */
const placeFor = (what: Wanted, path: string): Place =>
  what === "working-set" && isHome(path) ? HOME : PLACE_OF[what];

/**
 * The same lookup read backwards: whose screen a place belongs to.
 *
 * Built from the record above rather than written out again, so a screen added to
 * one of them cannot be missing from the other.
 */
const SCREEN_OF = new Map<Place, Wanted>(
  (Object.entries(PLACE_OF) as ReadonlyArray<readonly [Wanted, Place]>).map(
    ([what, place]) => [place, what],
  ),
);

/**
 * Which of this extension's pages an address is, where it is one of them.
 *
 * The addresses are not written here. `place.ts` says which are whose and this
 * reads that, because `mount.ts` holds a takeover back until the address is the
 * screen's own: a screen routed by one rule while its takeover waits on another
 * is a screen that never stands up.
 *
 * The search is asked for as well as the path, because a person's three pages are
 * one path and a `tab` parameter. Left out, `/flazouh?tab=stars` would route to
 * whichever of the three claims the bare path.
 *
 * Nothing where a place claims the address and no screen answers for it, which is
 * how a page can be named in `place.ts` before its screen is written: GitHub keeps
 * it, exactly as they keep every page this extension has no opinion about.
 */
const pageAt = (path: string, search?: string): Wanted | null => {
  const place = placeOwning(path, search);
  return place === null ? null : (SCREEN_OF.get(place) ?? null);
};

/** The address on the screen, as `pageAt` wants it. */
const hereNow = (): readonly [string, string] => [
  window.location.pathname,
  window.location.search,
];

/**
 * Which of this extension's pages the reader is on now, markup and address together.
 *
 * `pageAt` above answers for an address, which is what a press is: a destination with
 * no document behind it yet. This answers for the page in front of the reader, and the
 * two differ on exactly one page — an organisation's single sign-on, which GitHub
 * serves in place of what was asked for and under that page's own URL. Read by the
 * address alone, the wall is the pull request it stands in front of.
 *
 * Which is not a nicety. The fetch below drops any screen the reader has since left,
 * and it tells them apart by asking this: asked for an address, the sign-on screen is
 * fetched, found to be standing on a pull request, and thrown away — leaving the page
 * named, GitHub's wall held back by the rules that name carries, and nothing at all on
 * the screen.
 */
const wantedNow = (): Wanted | null => {
  const place = placeLoadedOn(document, ...hereNow());
  return place === null ? null : (SCREEN_OF.get(place) ?? null);
};

/**
 * Reads a pull request ahead of being asked for it, so that opening it is a
 * storage read rather than a page load.
 *
 * There is nothing here about caching, because reading is what fills the store:
 * the gateway keeps what it decodes. Warming a pull request and opening one are
 * the same call, and the only difference is who asked.
 */
export default defineContentScript({
  // Every GitHub page, not only pull requests: the links worth reading ahead
  // are on the list, the dashboard and the notifications inbox, which is to say
  // everywhere except the page the reader has already arrived at.
  matches: ["*://github.com/*"],
  /*
   * Before the parser has produced anything to flash.
   *
   * It used to be enough for this to run at `document_idle`, when all it did was
   * read pages ahead and ask the worker for one. It owns the gate now: naming the
   * page is what puts the rules that hide GitHub's version of it into force, and one
   * frame later is one frame of their page on the screen.
   */
  runAt: "document_start",
  main() {
    initialiseErrorReporting("prefetch");

    // Everything below is in aid of an interface that a reader can turn off,
    // and none of it is worth a single request when they have. Watched as well
    // as read, so that turning it off in this tab stops the next press here
    // rather than the next press after a reload.
    const settings = browserSettings();
    let view: View = "ours";
    Effect.runFork(
      settings.read.pipe(
        Effect.map((stored) => {
          view = stored.page.view;
        }),
      ),
    );
    settings.watch((stored) => {
      view = stored.page.view;
    });

    /**
     * Pages read on a guess, and the rules about when not to.
     *
     * In `app/readAhead.ts` rather than here, because both of its rules are about
     * time and cancellation and neither could be asserted about from inside this
     * closure. See that file: every bug it has had was in the part with no test.
     */
    const readAhead = readingAhead();

    /*
     * The pull request a press is headed for, where that is one other than the
     * page being read — which is the page the address names now, and not the one
     * this document was loaded on. See {@link elsewhereThan}, which is where the
     * two are compared, and why reading the live address is the whole of it: a
     * reader who moves between two layers of a stack moves the address and
     * nothing else, so a page held from the start goes stale on the first press.
     *
     * The one already open is declined, both here and for reading ahead. Reading
     * a page the reader is already on is a race with the screen reading it for
     * real, for a result nobody is going to wait for.
     */
    const wanted = (target: EventTarget | null): PullRequestRef | null => {
      if (!(target instanceof Element)) return null;

      const link = target.closest("a");
      if (link === null || link.hostname !== window.location.hostname)
        return null;

      return Option.getOrNull(
        elsewhereThan(window.location.pathname, link.pathname),
      );
    };

    /**
     * What lingering near a link would read, and the name it is read under.
     *
     * The table is `app/warming.ts`, where every page of ours is listed and the
     * coverage is tested. This half is the part that needs a document: which link
     * the pointer is over, and where the reader is while it is there.
     */
    const aheadOf = (link: HTMLAnchorElement): Ahead | null =>
      warmingFor(link.href, window.location.href);

    /**
     * And the screen's own file, fetched while the pointer is still on its way.
     *
     * A screen is several hundred kilobytes and the first press of a session is the
     * one that fetches it. Measured on a press between two person pages: a hundred
     * and eighty-five milliseconds from the press to the interface, nearly all of it
     * this. It is an extension file, so there is no request to GitHub in it and
     * nothing to be polite about — the only cost of being wrong about where the
     * reader is going is a module read from disk and never started.
     *
     * Fetching is all this does. Starting a screen is the press's business, and one
     * started for a page nobody is on gates a page it is not about.
     */
    const fetched = new Set<Wanted>();

    const soon = (link: HTMLAnchorElement): void => {
      const page = pageAt(link.pathname, link.search);
      if (page === null || fetched.has(page)) return;

      fetched.add(page);
      Effect.runFork(screenFor(page).pipe(Effect.ignore));
    };

    /*
     * Which page the pointer is closing on, measured as attention rather than as a rest.
     *
     * A reader deciding on a link slows down as they approach it, lands on it, drifts a
     * few pixels while they read the row, and only then presses. Every one of those
     * frames is evidence, and `ui/lingering.ts` adds them up: near earns credit slowly,
     * on the link earns it at full rate, and a link the pointer has left loses what it
     * had. Enough credit on one link is the signal to read its page.
     *
     * A rest is the weakest form of that evidence and it used to be the only one that
     * counted, so the reader who moved decisively towards a row was charged the whole
     * dwell again on arrival — and the one whose hand shook lost the timer entirely.
     */
    let lingering: Lingering = NOTHING;
    let at: Point | undefined;
    let ticking = 0;
    let lastLook = 0;
    /** Where the pointer was when it was last looked at, and where it is going. */
    let wasAt: Point | undefined;
    let travel: Point = { x: 0, y: 0 };

    /*
     * Read each time rather than once, because both halves of it move: a reader turns
     * data saver on mid-session, and a laptop carried out of range is on 2g by the time
     * the next list is drawn.
     *
     * The cast is the whole API. Neither the DOM library nor Firefox nor Safari has
     * `navigator.connection`, so the shape is stated here and read as absent everywhere
     * it is missing.
     */
    const connectionNow = (): Connection | undefined =>
      (navigator as Navigator & { connection?: Connection }).connection;

    /**
     * Whether what the pointer is near is worth earning credit towards, and at what rate.
     *
     * Several reasons it is not, and they are different kinds of reason: nothing is near
     * at all, there is no page of ours behind what is, that page is read already, this
     * visit has read its share, or the reader is on a connection where a guess costs more
     * than it saves.
     */
    const worthReading = (found: Reached | null): Seen<Ahead> | null => {
      if (found === null || readAhead.read() >= AT_MOST || !dataToSpare(connectionNow())) {
        return null;
      }

      const ahead = aheadOf(found.link);
      if (ahead === null || readAhead.already(ahead.key)) return null;

      return {
        key: ahead.key,
        reach: found.from.reach,
        forward: forwardness(travel, found.from),
        page: ahead,
      };
    };

    /*
     * On a frame rather than on the event, and it keeps running while there is anything
     * to add to. `pointermove` fires far faster than a page can be read, and a pointer
     * that lands without moving again — dropped there by a scroll, or by a hand that is
     * simply still — sends no more events at all while it earns its read.
     */
    const look = (now: number): void => {
      ticking = 0;

      const point = at;
      if (point === undefined) return;

      // Switched to GitHub's own pages mid-hover. What the pointer earned was earned
      // against an interface that is no longer on the page, so it is not worth carrying
      // back if the reader switches again.
      if (view === "github") {
        lingering = NOTHING;
        return;
      }

      // Waiting on a press. The pointer sits exactly where it pressed while the new
      // screen draws underneath it, so what it earns there is credit towards reading
      // the page the reader is leaving. See `readAhead`.
      if (readAhead.waiting(now)) {
        lingering = NOTHING;
        return;
      }

      const elapsed = now - lastLook;
      lastLook = now;

      travel =
        wasAt === undefined
          ? travel
          : smoothed(travel, { x: point.x - wasAt.x, y: point.y - wasAt.y });
      wasAt = point;

      const found = linkNear(point);
      // Whatever the reader is near, whether or not it earns anything. The file is
      // fetched once a session either way, and the pages worth having it are ours.
      if (found !== null) soon(found.link);

      const worth = worthReading(found);
      const step = lingerFor(lingering, worth, elapsed);
      lingering = step.lingering;

      if (step.ripe !== null) {
        readAhead.offer(step.ripe.key, step.ripe.read.pipe(Effect.provide(gatewayLayer)));
      }

      // Gone from a built extension entirely: `import.meta.env.DEV` is `false` before the
      // bundler runs, so the branch goes and the module with it. See `ui/lingeringHint`.
      if (import.meta.env.DEV) {
        if (step.ripe !== null) hintRead(step.ripe.key);
        showLingering({
          travel,
          lingering,
          seen: worth,
          read: readAhead.read(),
          atMost: AT_MOST,
          sparing: !dataToSpare(connectionNow()),
        });
      }

      // Nothing near and nothing part-way there is the pointer at rest over GitHub's own
      // furniture, and there is no reason to hit test the page sixty times a second for
      // it. The next move starts this again.
      if (worth !== null || lingering.size > 0) ticking = window.requestAnimationFrame(look);
    };

    const keepLooking = (event: PointerEvent): void => {
      if (view === "github") return;

      at = { x: event.clientX, y: event.clientY };
      if (ticking !== 0) return;

      // Starting again after an idle spell. Both halves of the heading are stale: the
      // last position is too old to measure a step from, and the heading it built was
      // for a movement that ended. Neither is worth more than starting over.
      wasAt = undefined;
      travel = { x: 0, y: 0 };
      lastLook = performance.now();
      ticking = window.requestAnimationFrame(look);
    };

    document.addEventListener("pointermove", keepLooking, { passive: true });
    // The pointer put on a link by a scroll rather than by a hand, which is the one case
    // that produces no movement to measure and would otherwise never be looked at.
    document.addEventListener("pointerover", keepLooking, { passive: true });

    /*
     * A pointer that has left the window is not near anything, whatever the last
     * position said. Without this, a reader who lands on a row and then leaves for
     * another window goes on earning a read they are not going to press.
     */
    document.addEventListener(
      "pointerleave",
      () => {
        at = undefined;
        // And no heading either. A pointer that comes back through the other side of the
        // window is not still going the way it left.
        wasAt = undefined;
        travel = { x: 0, y: 0 };
      },
      { passive: true },
    );

    /**
     * Which screens are up and following the address on their own.
     *
     * A screen is started once per document. After that it watches the address
     * itself — between pull requests, between pages of a list — so a second press
     * of the same kind of page is not this script's business at all.
     */
    const up = new Set<Wanted>();
    let givingUp: ReturnType<typeof setTimeout> | undefined;
    /** The way to call off the last press, where GitHub has since acted on it. */
    let stayingPut: Stop = () => {};

    const ungate = (): void => {
      document.documentElement.removeAttribute(GATING);
      clearTimeout(givingUp);
    };

    /**
     * Gives the page back to GitHub, because the screen for it is not coming.
     *
     * Both gates, not one. Lifting the soft gate alone leaves the rules that hide by
     * default in force, and those are keyed on the page having a name — so a screen
     * that failed to arrive would leave the reader looking at nothing at all rather
     * than at GitHub's own page. Which is what happened the first time this ran:
     * three screens threw on a missing `document.head`, and three pages were blank.
     */
    const failed = (cause: unknown): void => {
      reportError(cause);
      ungate();
      unmarkPage(document);
    };

    /**
     * Fetches a screen and lets it take the page, holding GitHub's own back while it
     * comes.
     *
     * Wanted as early as possible: the screen is several hundred kilobytes and the
     * reader is watching. Called on the press rather than on the navigation, so the
     * fetch and the parse happen while GitHub is still assembling its version of the
     * page — and the first press of a session is the only one that fetches anything
     * at all.
     */
    const fetchIt = (what: Wanted): void => {
      Effect.runFork(
        screenFor(what).pipe(
          Effect.map((screen) => {
            // Started here rather than at the fetch, because between the two the
            // reader may have gone somewhere else entirely — and a screen started for
            // a page nobody is on gates a page it is not about.
            if (up.has(what)) return;
            if (wantedNow() !== what && intendedPath(window) === null) return;
            up.add(what);
            screen.start();
          }),
          Effect.catch((cause) => Effect.sync(() => failed(cause))),
        ),
      );
    };

    /**
     * What this extension is doing about a press it is answering itself, where
     * it is answering one at all.
     *
     * Two states rather than one, because a press is three events and only the
     * last of them is a navigation. Everything expensive happens on the first —
     * the gate goes up and the screen is fetched while GitHub is still thinking —
     * and the address may not move until the third. Moving it earlier tears the
     * bar down between the press and the release, so the press that follows lands
     * on nothing, and the browser loads the whole document for a page already on
     * the screen. Measured: two hundred milliseconds of interface, then a reload.
     *
     * `push` is the whole address, which `going` is not: everything else here
     * reads a path, and a history entry is the one thing that carries the search.
     */
    type Ours = { readonly push?: string };

    const open = (
      what: Wanted,
      going?: string,
      /** Nothing where the press is GitHub's to route. See {@link answerPress}. */
      mine?: Ours,
    ): void => {
      // Their page is the one being opened, so there is nothing to hold back
      // and nothing to fetch. Leaving the gate alone here is the whole of it:
      // a reader who has turned this off never sees a frame of it.
      if (view === "github") return;

      /** Whether the screen this press asked for is up, address and all. Set once the press is ours. */
      let arrived: (() => boolean) | undefined;
      /**
       * Whether the screen for this address is somewhere it should not be, which is
       * the only question the repair below is entitled to act on.
       */
      let goneWrong: (() => boolean) | undefined;

      /*
       * The press, carried out here if their router drops it — which on their
       * issues page it reliably does. One at a time: a reader who presses twice
       * in a second has changed their mind, and the first deadline must not drag
       * them back to where they were going a moment ago.
       *
       * Never armed for a press this answers itself. Their router is not in that
       * one at all, so there is nothing to wait on — and waiting anyway is the
       * whole of the fault this deadline used to cause: a screen the reader is
       * already reading, under the address and the tabs of the page they left,
       * and then a document load two and a half seconds later that throws away
       * everything already read.
       */
      if (going !== undefined) {
        stayingPut();
        stayingPut =
          mine === undefined ? whenTheyStayPut(window, going) : () => {};
      }

      /*
       * No document is coming, so the screen arriving stands on the surface the
       * screen being left is holding. Said before the fetch below, because that
       * screen reads this the instant it starts.
       */
      if (mine !== undefined) {
        drawingOurOwnRows(window, true);

        /*
         * And from here the connection belongs to the reader. `readAhead` is where
         * the cost of not saying so is measured.
         *
         * Said on the first event of the press rather than the third, which is about
         * a hundred milliseconds earlier. This is already the moment the shell
         * decided the press is happening: the gate goes up below and the screen's
         * own file is fetched, several hundred kilobytes of it, while GitHub is
         * still thinking about their page. A guess left running against that fetch
         * is competing with the press twice over.
         *
         * The read for the page being opened is spared. It is the one thing the
         * resting before the press bought — it lands in the store, and the screen
         * draws that store before GitHub has answered anything — and calling it off
         * cost exactly what it was worth: 238ms rested became 1,256ms.
         */
        const target = new URL(
          mine.push ?? going ?? window.location.pathname,
          window.location.origin,
        );
        const wanted = placeFor(what, target.pathname).name;

        /*
         * Both the kind of screen and the address it has drawn, which is one question
         * asked in two halves. The kind alone answers yes on the first frame of a move
         * between two pull requests, because it never changed: measured on that press,
         * it still read "conversation" at 0.4s, 1s, 2s, 4s and 8s. So the quiet period
         * below ended before it began, on the one route that needed it most.
         *
         * Strict, and only ever asked where a wrong "no" costs nothing. This one holds
         * reading ahead back, so being told no while the page is still arriving is the
         * answer that was wanted anyway.
         */
        arrived = () => theScreenArrived(document, wanted, target.pathname);

        /*
         * The repair asks a weaker question, because it answers a no by loading the
         * whole document. A screen nobody has wired to publish an address says nothing
         * at all, and read strictly that silence is a reload after a press that worked.
         */
        goneWrong = () => theScreenIsNotElsewhere(document, wanted, target.pathname);

        readAhead.pressed(warmingFor(target.href, window.location.href)?.key ?? null, {
          there: arrived,
          by: performance.now() + ARRIVING,
        });
      }

      /*
       * Said before anything else and whoever is already up, because it is the page
       * this document is *about* rather than anything about the screen for it.
       *
       * A reader pressing a row on a list has the card's screen up already — it was
       * started on the pull request they came from — and this used to return below
       * without saying so, leaving the document named as a list while a pull request
       * was rendered into it. The rules that hide their conversation before ours is up
       * are keyed on this name, so they were the rules for the wrong page, and what
       * held their header back was the soft gate alone.
       */
      markPage(document, placeFor(what, going ?? window.location.pathname));

      /*
       * Fetched and gated only where the screen is not already up. One that is
       * follows GitHub around by itself, and gating for it would hide the region
       * it is standing in — which is to say the interface — with nothing left to
       * lift it, because the give-up below would see the screen in charge and
       * conclude all is well.
       */
      if (!up.has(what)) {
        // Said before the screen is fetched, so that it is already there to be read
        // the instant it starts — which is a full second before the address agrees.
        if (going !== undefined) intendTo(window, going);

        document.documentElement.setAttribute(GATING, "");

        clearTimeout(givingUp);
        givingUp = setTimeout(() => {
          if (!up.has(what)) ungate();
        }, GIVE_UP);

        fetchIt(what);
      }

      /*
       * And last, the address, because everything above is what makes it true.
       *
       * The repair is told what an arrival looks like rather than left to guess.
       * A screen already standing redraws in place — a file opening in a tree, a
       * second page of a list — and never replaces its container, so the guess
       * would call those moves failures and load the document this exists to
       * avoid. The page name is the honest test: it is set by the takeover, and
       * only by the screen the address is now about.
       */
      // The same answer the quiet period above waits on, and for the same reason: a
      // repair made while the screen is on its way loads the whole document.
      const push = mine?.push;
      if (push !== undefined && goneWrong !== undefined) goTo(window, push, goneWrong);
    };

    const pressed = (event: Event): void => {
      // A plain press only. Anything held down turns this into a new tab, a new
      // window or a download, and the page stays exactly where it is — so
      // taking it over would replace a list the reader is still looking at.
      if (!aPlainPress(event as MouseEvent)) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a");
      if (link === null || link.hostname !== window.location.hostname) return;

      /*
       * Their nav's own "Pull requests", a repository's own tab of the same name,
       * and every link to either from anywhere on the site.
       *
       * All of them are soft navigations, and all of them are invisible to a content
       * script's matches for the same reason: no document loads, so the match is
       * never tested again and the script for the page never runs.
       */
      const page = pageAt(link.pathname, link.search);

      /*
       * Every link to a page of ours, and their router in none of them.
       *
       * Which pages those are is `app/pressing.ts`, where the list can be read next to the
       * list of screens and is tested. It used to be a chain of comparisons here, and two
       * pages were missing from it: a commit and an issue went to their router, which on a
       * measured press moved the address three point eight seconds after the reader let go.
       *
       * The one question left here is about a node rather than an address: a press on a
       * pull request's row counts only where it landed on the part that means the pull
       * request, which is what `wanted` is the judge of.
       */
      const what =
        // The link is an address and the page under it is a document, so the two
        // are asked differently. See `wantedNow`: on a wall the address alone says
        // the reader is on the pull request their organisation is refusing them.
        oursToOpen(page, wantedNow()) &&
        (page !== "pull-request" || wanted(target) !== null)
          ? page
          : null;
      if (what === null) return;

      /*
       * The one rule, asked of every event of every press, and kept in one place
       * so that no caller here can keep half of it. See `answerPress`.
       *
       * Their router is never in a press of ours. It was, for every link except a
       * row on the Working Set, and it drops roughly every other one — which cost
       * the reader two and a half seconds of the new screen under the old address,
       * and then a whole document load. See `oursToAnswer` and `whenTheyStayPut`.
       */
      answerPress(event, link, window, {
        theirs: () => open(what, link.pathname),

        // Everything worth doing before the reader lets go: the gate up, and the
        // screen fetched while GitHub is still thinking about their own page.
        ready: () => open(what, link.pathname, {}),

        go: () => open(what, link.pathname, { push: addressIn(link) }),
      });
    };

    // All three, because the gate has to be up before GitHub renders and no one
    // of them can be relied on to say so. A pointer fires all three in order; a
    // keyboard fires only the last; and automation, synthetic clicks and the
    // odd browser skip whichever they like. Asking twice costs an attribute
    // that is already set and a message that is never sent again.
    for (const name of ["pointerdown", "mousedown"]) {
      document.addEventListener(name, pressed, {
        passive: true,
        capture: true,
      });
    }

    // The press itself, and not passive: a link of ours to a page of ours is
    // answered here rather than by the browser, and answering it means cancelling
    // it. The two above cannot — a passive listener may not, and neither of them
    // is the event that loads a document anyway.
    document.addEventListener("click", pressed, { capture: true });

    // The presses this misses: the back button, a middle-click promoted to this
    // tab, anything GitHub navigates on its own account. Later than a press —
    // the page is already changing — but still before their conversation has
    // been rendered into the region that is about to be hidden.
    /*
     * The whole address, not the path. A press between a person's three tabs changes
     * the `tab` parameter and nothing else, so a watcher on the path alone never heard
     * about it — and the screen for one tab went on standing on another's page.
     */
    whenAddressChanges(window, (path, search) => {
      // Their router moved, so the last press was acted on and the deadline that
      // would have carried it out by hand has nothing left to do.
      stayingPut();
      stayingPut = () => {};

      const page = pageAt(path, search);
      if (page === null) {
        ungate();
        // Somewhere we have nothing to say about — an issue, the Code tab. The rules
        // that hide by default are keyed on this and an issue has the same regions.
        unmarkPage(document);
        // And no surface of ours for anything to stand on, whoever said there was.
        // A screen arriving after this has a document coming and their region in it.
        drawingOurOwnRows(window, false);
        return;
      }
      open(page);
    });

    /*
     * And the page this document was loaded on, which is the one case that needs no
     * press and no message.
     *
     * Whatever the reader's preference, unlike every path above. A screen handed the
     * page back to GitHub is what puts the control on their header that brings it
     * home again — decline to start it and the choice becomes a door that only opens
     * one way. It reads the preference itself and hands over in the same breath.
     *
     * Synchronous as far as the page name, which is what the gate hangs on: this runs
     * at `document_start`, before their markup has been parsed, and an attribute set
     * a frame later is a frame of their page on the screen.
     *
     * Which is also why the markup is read here and never on a press: at this moment
     * the root element is all the parser has produced, and it is enough to recognise
     * the one page whose address belongs to something else — an organisation's single
     * sign-on, served in place of the page that was asked for. A guess at that point,
     * and the screen settles it. See `wantedNow`.
     */
    const loadedOn = wantedNow();
    if (loadedOn !== null) {
      markPage(document, placeFor(loadedOn, window.location.pathname));
      // Before the screen is asked for, because this is the only moment the answer is
      // plain: a document being fetched right now is a navigation the worker was told
      // about, and the screen that will want to know is a bundle that does not finish
      // arriving until GitHub's page is done. A pull request and no other page, because
      // that is the only read the worker is told to start. See `arrival.ts`.
      if (loadedOn === "pull-request") noteArrival(window, document);
      fetchIt(loadedOn);
    }
  },
});
