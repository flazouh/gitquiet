import { useEffect, useRef, useState, type ReactNode } from "react";
import { Option } from "effect";
import { listsPullRequests, THE_HOME } from "../domain/pages";
import { switchable, type Repository } from "../domain/repositories";
import { useArt } from "./art";
import { Cap } from "./Cap";
import { HERE, INSIDE, PRESSABLE, TINT } from "./dress";
import { Face } from "./Face";
import { Menu, type Row } from "./Menu";
import { Owner } from "./Owner";
import { participantRows } from "./participant";
import { tabMark } from "./tabMarks";
import type { Tab } from "./theirNav";
import { isViewer } from "./viewer";

/**
 * The strip across the top, ours instead of theirs.
 *
 * GitHub's own is 64 pixels on Home and 100 in a repository, holding twelve controls of which
 * nine are unlabelled icons crammed into the right five hundred pixels, with 1169 pixels of
 * nothing in the middle and a crumb reading "Dashboard" — a name for a page that is now three
 * Destinations. Four of those controls are things the Rail already does, one is a second
 * entrance to the chat box their own thread voted down, and the search advertises a key the
 * Rail has taken.
 *
 * So: 48 pixels, and only what this extension can answer for — and only what nothing else on
 * the page is already saying, which is why Home's side of it is a mark rather than words. One
 * search. The tabs a reader lives in, read off their own row rather than reproduced. The
 * inbox as a dot, which is everything `/notifications/indicator` knows. The Participant.
 *
 * See `docs/spec/top-bar.md`, and `docs/spec/top-bar-compare.html` for why the six monthly
 * tabs went behind the repository's name rather than staying in the row.
 */
export type Where =
  /**
   * Home, which needs no describing here.
   *
   * Nothing but the kind. The Destination and the count used to ride along for a crumb to read
   * out, and the Rail one row below was reading them out at the same time — so they left with
   * the crumb rather than sitting in a type as a temptation.
   */
  | { readonly kind: "home" }
  | {
      readonly kind: "repository";
      readonly owner: string;
      readonly repo: string;
      /*
       * No number in here, and the same argument as the Destination above it. `#1934` sat
       * beside the name on the one page whose own title is that number in large type
       * directly below, and the palette that wanted to know which repository the reader is
       * in never wanted to know which pull request. A field nothing draws is a temptation.
       *
       * No face either, for the harder version of the same reason: it was here, no screen
       * ever passed one, and the strip quietly drew a letter in a grey box on every
       * repository for as long as it existed. `Owner` asks GitHub's redirect by name, so
       * there is nothing to pass and nothing to forget to pass.
       */
    }
  /**
   * A person's own pages: their profile, their repositories, their stars.
   *
   * A login rather than an address, and no tab in here. Which of their three tabs the
   * reader is on is drawn by the screen, one row below this bar and beside the counts it
   * belongs to, exactly as a repository's tabs are.
   */
  | { readonly kind: "person"; readonly login: string };

export type BarProps = {
  readonly where: Where;
  /**
   * Their repository tabs as `repositoryTabs` read them, or nothing where their row was never
   * there to read — which is Home, and any page whose bar arrives before their nav does.
   */
  readonly tabs?: ReadonlyArray<Tab>;
  /** Whether anything is in the inbox. A dot, never a number: see the spec. */
  readonly unread?: boolean;
  /**
   * Everything the reader has, for the switcher behind the repository's name.
   *
   * The same list the palette searches, handed here as well rather than fetched again: the
   * store already holds it, and two lists of one reader's repositories can disagree.
   */
  readonly repositories?: ReadonlyArray<Repository>;
  /**
   * The ones the reader pinned, and the ones they read lately, for the switcher's order.
   *
   * Handed in rather than read here, because a bar is drawn on a page and both of these are
   * kept somewhere: the pins in settings, the visits in `visited`. See `switchable` for what
   * each band is worth and why neither is a score.
   */
  readonly pinned?: ReadonlyArray<string>;
  readonly lately?: ReadonlyArray<string>;
  /**
   * Whether the reader is in the code, the name being the way to it.
   *
   * Handed in rather than taken from their row. Their row says Code is the current tab on
   * `/owner/repo/issues` whenever a repository has Issues switched off, which put "you are
   * here" on the name while the reader was reading issues. The address knows; their markup
   * does not. See `readingTheCode`.
   *
   * In the code, rather than on the repository's own page, which is what `readingTheCode`
   * answers: the root and every `/tree/` and `/blob/` under it. Which of those two the reader
   * is on is settled here against {@link at}, because a file is inside the code and is not the
   * repository's own page. Nothing marks the name on the rest of the repository's pages: a
   * reader on `/issues` is inside this repository, and so is every reader who can see this
   * bar, so a mark there would say nothing.
   */
  readonly atTheCode?: boolean;
  /**
   * The address the reader is on, for telling a tab's own page from the section around it.
   *
   * Which page it is is the one thing a row read out of GitHub's markup cannot say — see
   * {@link standingOn} — so the strip has to know where the reader stands as well as what
   * their row marks.
   *
   * Read off the document where nothing hands it in, which is every screen as things are:
   * this strip is drawn on the page it describes, and `TheBar` reads the same
   * `window.location.pathname` a line away for `atTheCode`. Handed in, it wins, which is how
   * a test says where a reader is without a document to move.
   */
  readonly at?: string;
  readonly participant?: {
    readonly login: string;
    readonly faceUrl: Option.Option<string>;
  };
  /**
   * Opening the palette, from whoever owns one.
   *
   * Left out and no search is drawn at all. A control that presses into nothing is worse than
   * a bar without one, and it is exactly the mistake being fixed here: their own button still
   * advertises a slash key that now belongs to the Rail's filter.
   */
  readonly onSearch?: () => void;
  /**
   * Going back one page, from whoever knows there is one behind this.
   *
   * Left out and neither of the two is drawn, which is a tab opened straight onto
   * this address: a pair of arrows with nothing behind them presses into nothing,
   * and this bar exists to stop the version of that mistake their own strip
   * makes. See `theTrail` in `going.ts`.
   */
  readonly onBack?: () => void;
  /** Starts preparing the Back route while the reader aims at its button. */
  readonly onPrepareBack?: () => void;
  /**
   * Going forward one page, where the reader has been back and can return.
   *
   * Left out and the control still stands, disabled. It is the one control in
   * this strip that keeps a dead slot, and the reason is the gesture either side
   * of it: a reader pressing Back twice presses the same pixel twice, and a
   * forward button that appeared in between would take the second press.
   */
  readonly onForward?: () => void;
  /** Starts preparing the Forward route while the reader aims at its button. */
  readonly onPrepareForward?: () => void;
  /**
   * The places behind this page, nearest first, for the menu on the back button.
   *
   * Fewer than two and no menu is offered: a column holding the one page Back
   * already goes to is a second control for the first one. Each row carries the
   * address as well as the press, so the browser's own ways of using a link — a
   * new tab, a copied address — still work on it. See `Row`.
   */
  readonly behind?: ReadonlyArray<Row>;
  readonly onStepAside?: () => void;
  /**
   * The way into the reader's own choices, which stands beside the inbox.
   *
   * A slot rather than the control itself, because the strip is drawn from what it is handed and
   * a settings sheet needs a store, a schema and somewhere to write. `TheBar` has all three and
   * this has none of them, which is the only reason the two are separate components.
   *
   * Filled on both hosts, unlike {@link tray}, which is what the surroundings add and a page
   * leaves empty.
   */
  readonly corner?: ReactNode;
  /**
   * Home as a press, from a host where Home is not an address.
   *
   * Left out and the mark is the link it has always been, which is right on a page: the
   * reader is in a tab, and the Working Set has an address. In the window it is not one.
   * There is a single webview and no way back into it, so following `/` there replaced
   * the app with GitHub's own dashboard and left the reader inside a window with no
   * address bar. See `around.ts`.
   */
  readonly onHome?: () => void;
  /**
   * Whatever is around this bar keeps past everything about the page.
   *
   * The window's update and account, and nothing in a tab: a tab has no version of its
   * own and its account is the browser's. Last in the row because that corner is where
   * every window on the machine keeps who is signed in, and because it is the one spot
   * nothing in this strip can push along. See `around.ts`.
   */
  readonly tray?: ReactNode;
};

/**
 * The tabs that stay in the strip.
 *
 * Two, by name rather than by position, because their row is not always nine long: a
 * repository with Discussions and Projects switched off still has these, and a reader who is
 * on none of them keeps whichever one they are on — see {@link inTheStrip}.
 */
const LIVED_IN: ReadonlyArray<string> = ["Issues", "Pull requests"];

/**
 * Their tab for the repository's own page, which this bar draws as the repository's name.
 *
 * It was in the strip beside the name, and the two went to the same address: seventy pixels
 * and a decision, for a page already reachable from the thing directly to its left. Their own
 * row keeps it because their name opens a menu instead of going anywhere.
 *
 * Still read, never drawn as a tab: it is how the strip knows the reader is on that page, and
 * the mark for it goes on the name.
 */
const THE_NAME = "Code";

/**
 * Where a reader stands in relation to one tab: on its page, inside its section, or neither.
 *
 * Three states, because two were a lie half the time. `here` was one boolean carrying both of
 * the first two, and on `/owner/repo/pull/542` it put the fill of a page being read on the Pull
 * requests tab and `aria-current="page"` on a link to `/owner/repo/pulls` — a different page. A
 * reader being read to was told they were already where that link goes; a reader looking at it
 * read the fill as a selection and asked why the list was highlighted on a pull request.
 *
 * Losing the mark was not the answer. Which section a reader is in is worth knowing, GitHub says
 * it too, and a strip that went quiet about it would be a different complaint.
 */
type Standing = "here" | "inside";

/**
 * One address in one spelling, so two spellings of one page compare equal.
 *
 * Their hrefs are theirs to write: the Issues tab carries `?q=is%3Aissue+is%3Aopen` on a
 * repository with a saved default, a row read out of a fetched document can hold a whole
 * `https://github.com` origin, and a reader typing an address types the capital letters and the
 * trailing slash they like. GitHub serves all of those as one page, so a strip that read them as
 * different pages would drop the mark on the page a reader is actually on.
 */
const pathOf = (address: string): string => {
  const path = address.replace(/^(?:https?:)?\/\/[^/]+/, "").replace(/[?#].*$/, "");
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

  return trimmed.toLowerCase();
};

/**
 * The address settles the page and their row settles the section, each answering what it knows.
 *
 * `repoTabs.ts` reads `aria-current="page"` off GitHub's own row, and GitHub puts that on Pull
 * requests for the list and for one pull request alike. So a row read out of their markup can
 * say which section holds the page and can never say which page it is — the fault above is that
 * limit taken for an answer. `tabsWeCanName` is built from the address and could tell the two
 * apart, but it names two tabs of nine and only stands in until their row arrives, so a rule
 * living there would hold for one frame and lapse. One comparison here answers it for every tab
 * from either source.
 *
 * A kept row is the third source and the reason the address wins outright rather than only
 * breaking a tie: it was read on the page before this one, so what it marks is where the reader
 * was. See `keptTabs`.
 */
const standingOn = (at: string, tab: Tab): Standing | undefined =>
  pathOf(at) === pathOf(tab.href) ? "here" : tab.here ? "inside" : undefined;

/**
 * The standing, said rather than painted, in the word ARIA has for each.
 *
 * `page` is a link to the page being read and `location` is a link to the section holding it,
 * which is the distinction the fault above collapsed: `page` on a link to `/owner/repo/pulls`
 * while the reader is on `/owner/repo/pull/542` tells somebody being read to that they are
 * already there. Nothing at all where the reader is neither, rather than `false`: an absent
 * attribute is the same answer in every screen reader, and a written one is a claim.
 */
const said = (standing: Standing | undefined) =>
  standing === undefined
    ? {}
    : { "aria-current": standing === "here" ? ("page" as const) : ("location" as const) };

/** One of their tabs with the reader's own standing worked out, which is what the row draws. */
type Stood = Tab & { readonly standing: Standing | undefined };

/**
 * The standing rather than their mark, so the tab a reader is on cannot fall out of the row.
 *
 * This asked their row, and their row is one of three sources: on the kept row of a repository
 * whose Actions the reader read last week, `here` is on Actions and off the tab this address
 * names. The address is the one thing about this page.
 */
const inTheStrip = (tab: Stood): boolean =>
  tab.name !== THE_NAME && (LIVED_IN.includes(tab.name) || tab.standing !== undefined);

const NOTHING: ReadonlyArray<never> = [];

export const Bar = ({
  where,
  tabs = [],
  unread = false,
  repositories = NOTHING,
  pinned = NOTHING,
  lately = NOTHING,
  atTheCode = false,
  at = window.location.pathname,
  participant,
  onSearch,
  onBack,
  onPrepareBack,
  onForward,
  onPrepareForward,
  behind = NOTHING,
  onStepAside,
  corner,
  onHome,
  tray,
}: BarProps) => {
  const art = useArt();
  const Chevron = art["chevron-down"];
  const Search = art.search;
  const Back = art.back;
  const Forward = art.forward;
  const backButton = useRef<HTMLButtonElement>(null);
  const forwardButton = useRef<HTMLButtonElement>(null);
  // The tray says which state it is in, so the two are named rather than one
  // glyph with something drawn over it.
  const Inbox = unread ? art["notifications-unread"] : art.notifications;
  const TheirMark = art.github;
  const More = art.more;
  const [opened, setOpened] = useState<
    "account" | "repositories" | "tabs" | "behind" | undefined
  >(undefined);

  useEffect(() => {
    const button = backButton.current;
    if (button === null || onPrepareBack === undefined) return;
    button.addEventListener("pointerenter", onPrepareBack);
    return () => button.removeEventListener("pointerenter", onPrepareBack);
  }, [onPrepareBack]);

  useEffect(() => {
    const button = forwardButton.current;
    if (button === null || onPrepareForward === undefined) return;
    button.addEventListener("pointerenter", onPrepareForward);
    return () => button.removeEventListener("pointerenter", onPrepareForward);
  }, [onPrepareForward]);

  const stood: ReadonlyArray<Stood> = tabs.map((one) => ({
    ...one,
    standing: standingOn(at, one),
  }));
  const strip = stood.filter(inTheStrip);
  const rest = stood.filter((one) => one.name !== THE_NAME && !inTheStrip(one));

  /*
   * The name's own three states, off the same two facts as a tab's.
   *
   * `atTheCode` is the section — the root and every file under it — and the address says which
   * of those the reader is on. Their row is no help here at all: see `atTheCode`.
   */
  const atTheName: Standing | undefined =
    atTheCode && where.kind === "repository"
      ? pathOf(at) === pathOf(`/${where.owner}/${where.repo}`)
        ? "here"
        : "inside"
      : undefined;

  return (
    <header
      /*
       * 48 pixels, and the height is on the element rather than on its padding: this stands
       * where GitHub's own 64 stood, and a bar that grows with its contents would move the
       * whole page down the first time a repository name ran long.
       */
      /*
       * A shadow under it, which is the one thing that says a strip is above a page.
       *
       * Its fill is one step of the ladder off the page's own, and on a pack where the chrome
       * is darker than the content — Cursor's, Vesper's — that step is two per cent of a grey.
       * Measured on the live page it read as a band of the page rather than as our bar. Same
       * argument as a menu, and the same token: see `quiet.css`.
       */
      /*
       * Forty pixels, down from forty-eight.
       *
       * Forty-eight was chosen against GitHub's sixty-four, which is the "padding too large"
       * complaint this strip answers, and it was the right direction but not far enough: a bar
       * carrying one glyph, a search box and three controls has no rows to stack, and the space
       * over and under a twenty-eight pixel control was doing nothing but pushing the list down.
       * Forty leaves six pixels either side of a control, which is enough to keep it off the
       * edges and not enough to read as a band.
       */
      /*
       * Eight pixels either side, which is the gutter the pane itself floats in.
       *
       * Twelve inside a pane inset by eight is a left edge at twenty against a Rail's at eight,
       * and the two are meant to be one edge — the argument `glass.css` makes about the gutter,
       * applied to the inside of the pane as well as the outside of it. The controls are twenty-
       * eight pixels in a forty pixel strip, so the room they need is vertical and already there.
       */
      className="flex h-10 items-center gap-2 bg-surface px-2 text-sm text-ink"
    >
      {/*
       * The way back and the way forward, first in the strip, before the mark for
       * Home.
       *
       * The mirror of the way out at the other end. This row already reads
       * outward to inward — Home, then the repository, then the section a page is
       * in — and the page behind this one stands a step further out than any of
       * them, so it goes at the head of that sequence rather than into the middle
       * of it. It is also the corner every browser and every window on the
       * machine keeps these two in, and this bar stands where a browser's chrome
       * does not: in the extension's own window there is nothing above it.
       *
       * Not on the screen below, which is where the exit used to be. A control
       * that exists on one of the four screens is a control a reader has to find
       * again on the other three, and that argument is what put the GitHub mark
       * in this row in the first place.
       *
       * Not beside that mark either. The far corner means leaving this interface
       * for GitHub's page, and going back moves within it: two controls a hand
       * cannot tell apart is how a reader learns to distrust both.
       *
       * Wordless like the tray at the other end. The mark says the direction and
       * the name says the destination, for a pointer and for anyone being read to.
       */}
      {onBack === undefined ? null : (
        <div className="relative flex shrink-0 items-center">
          {/*
           * One chip, two presses, which is the shape the repository's name takes
           * a few pixels to the right: the arrow goes back a page and the chevron
           * asks which page. The alternative was Chrome's, where the list is
           * behind a long press on the same arrow — a gesture nothing in this
           * interface uses and nothing on the strip could advertise.
           */}
          <div
            className={`flex items-center overflow-hidden rounded-md ${TINT}`}
          >
            <button
              ref={backButton}
              type="button"
              onClick={onBack}
              onFocus={onPrepareBack}
              aria-label="Back"
              title="Back"
              className="grid size-7 shrink-0 place-items-center text-ink-muted hover:bg-active hover:text-ink"
            >
              <Back size={16} />
            </button>
            {/*
             * Two or more, and the second is the reason: a menu whose only row is
             * the page the arrow beside it already goes to is a second button for
             * the first one.
             */}
            {behind.length < 2 ? null : (
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={opened === "behind"}
                aria-label="Where you have been"
                title="Where you have been"
                onClick={() => setOpened(opened === "behind" ? undefined : "behind")}
                /* Twenty across against the name's twenty-eight, and the same line
                   down its left. This half opens a menu beside a half that goes
                   somewhere, and the pair has to stay narrower than the two tabs
                   it pushes along. */
                className="grid h-7 w-5 shrink-0 place-items-center border-l border-line-muted text-ink-muted hover:bg-active hover:text-ink"
              >
                <Chevron
                  size={10}
                  className={`t-turn ${opened === "behind" ? "is-turned" : ""}`}
                />
              </button>
            )}
          </div>
          <Menu
            name="Where you have been"
            origin="top-left"
            wide="w-72"
            open={opened === "behind"}
            onShut={() => setOpened(undefined)}
            rows={behind}
          />
        </div>
      )}

      {/*
       * Forward keeps its slot whether or not there is anywhere ahead.
       *
       * Everything else in this strip is drawn only where it does something, and
       * this is the exception the gesture forces: Back is pressed twice as often
       * as once, and a control that appeared between the two presses would catch
       * the second one and undo the first. Said as disabled rather than painted
       * as absent, so a reader being read to hears why it does nothing.
       */}
      {onBack === undefined ? null : (
        <button
          ref={forwardButton}
          type="button"
          onClick={onForward}
          onFocus={onPrepareForward}
          aria-label="Forward"
          title="Forward"
          aria-disabled={onForward === undefined}
          disabled={onForward === undefined}
          className="grid size-7 shrink-0 place-items-center rounded-md text-ink-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40"
        >
          <Forward size={16} />
        </button>
      )}

      <Ours here={where.kind === "home"} onHome={onHome} />

      {/*
       * Their name, on somebody else's pages, and no chevron beside it.
       *
       * The chevron on a repository offers the reader's other repositories, which is a list
       * this bar is handed. Nothing hands it a list of people, and a menu built from the
       * owners of a repository list is a column of whoever happens to be in it rather than
       * anyone the reader chose. So one chip, one press, and it goes to their profile.
       *
       * Not on the reader's own pages. The menu at the other end of this strip is them, and
       * its first row is "Your profile" — so on `/your-login` the chip was a second link to
       * the page already on the screen, a centimetre from the first.
       */}
      {where.kind === "person" && !isViewer(where.login) ? (
        <a
          href={`/${where.login}`}
          className={`flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-ink no-underline hover:bg-active ${TINT}`}
        >
          <Owner owner={where.login} size={18} />
          <span className="font-semibold">{where.login}</span>
        </a>
      ) : null}

      {where.kind !== "repository" ? null : (
        <div className="relative flex shrink-0 items-center">
          {/*
           * One chip, two presses: the name goes to the repository and the chevron opens the
           * others. It was a single button, and the single thing it did was the menu — so
           * pressing `owner/repo` in the corner of a bar listed Actions and Settings, while
           * the way to the repository's own page was a tab a centimetre to the right.
           *
           * Split in behaviour and not in appearance. Two chips side by side for one name is
           * two objects where a reader sees one, and the chip is what the bar was drawn
           * around: the fill and the corners stay here, and neither half carries its own.
           */}
          <div
            /*
             * The two fills are written as one choice rather than one over the other.
             * `PRESSABLE` carries a fill of its own, so a `HERE` beside it was two background
             * rules on one element and the cascade — not the order they are written in —
             * decided: the resting tint won, and the name never showed where the reader was.
             *
             * `overflow-hidden` so each half can take a fill of its own and still be cut to
             * the chip's corners. Neither half is rounded itself: a rounded half inside a
             * rounded chip leaves a sliver of the chip's fill showing at the join.
             *
             * Filled on the repository's own page and not on a file inside it, where the name
             * is said to be the section and painted as it always is. The tabs step up from a
             * muted ink for that middle state and this has no muted state to step up from: the
             * name is the one thing in the strip that says which repository a reader is in, so
             * it stands at full strength on every page of it. That leaves the two fills, both
             * spoken for — see `INSIDE` — and the same answer `Ours` reaches below: said aloud,
             * not painted.
             */
            className={`flex items-center overflow-hidden rounded-md ${
              atTheName === "here" ? HERE : TINT
            }`}
          >
            <a
              href={`/${where.owner}/${where.repo}`}
              {...said(atTheName)}
              /*
               * Its own hover, and the chevron beside it has another. One tint over the pair
               * was a chip that looked like a single button and behaved as two: nothing said
               * which half a hand was about to press, and the half that went somewhere was
               * the half nobody aimed at.
               */
              className="flex items-center gap-1.5 px-2 py-1 text-ink no-underline hover:bg-active"
            >
              {/* Their picture, asked for by name.
                  This drew `Face` with whatever the screen had handed down, and
                  no screen hands anything down — so every repository in the strip
                  wore a grey square with its first letter in it, which is the
                  thing `Owner` exists to stop. Their redirect takes the login and
                  answers with the avatar, so nothing has to be looked up and
                  nothing has to be passed in. */}
              <Owner owner={where.owner} size={18} />
              <span className="font-semibold">
                {where.owner}/{where.repo}
              </span>
            </a>
            {/*
             * The other repositories, which is what a name with a chevron offers everywhere
             * else it appears. It offered the tabs this repository has instead — the one
             * thing its shape does not promise — and those are at the end of the tab row now.
             *
             * Drawn only where there is a list to draw. A reader who has not been to Home has
             * nothing kept, and a control that opens an empty menu is worse than no control.
             */}
            {repositories.length === 0 ? null : (
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={opened === "repositories"}
                aria-label="Switch repository"
                title="Switch repository"
                onClick={() =>
                  setOpened(opened === "repositories" ? undefined : "repositories")
                }
                /*
                 * Twenty-eight across, which is the smallest a control in this strip is
                 * allowed to be, and a line down its left so the pair reads as two things.
                 * It was twenty wide with no line: a target smaller than the comfortable
                 * minimum, inside a chip that gave no sign it had halves at all.
                 */
                className="grid size-7 shrink-0 place-items-center border-l border-line-muted text-ink-muted hover:bg-active hover:text-ink"
              >
                <Chevron
                  size={12}
                  className={`t-turn ${opened === "repositories" ? "is-turned" : ""}`}
                />
              </button>
            )}
          </div>
          <Menu
            name="Your repositories"
            origin="top-left"
            wide="w-72"
            /*
             * A field over these, unlike every other menu in the interface. The argument
             * against one is a column of five a reader can already see; this column is as
             * long as the reader's account, and the palette behind ⌘K is the other half of
             * the same answer rather than a reason to leave this list unreachable.
             */
            find="Find a repository"
            open={opened === "repositories"}
            onShut={() => setOpened(undefined)}
            rows={switchable(repositories, {
              here: `${where.owner}/${where.repo}`,
              pinned,
              lately,
            }).map((one) => ({
              name: one.nameWithOwner,
              where: `/${one.owner}/${one.repo}`,
              /* Their owner's picture rather than one glyph repeated down the column, which is
                 the same argument the chip above makes and the Rail's own list makes below. */
              face: one.owner,
              chosen: one.owner === where.owner && one.repo === where.repo,
            }))}
          />
        </div>
      )}

      {strip.length === 0 ? null : (
        <nav
          aria-label="Repository"
          className="flex shrink-0 items-center gap-0.5"
        >
          {strip.map((one) => {
            const Mark = art[tabMark(one.name)];
            /*
             * The list of pull requests, where that is a screen rather than an address.
             *
             * In the window this tab stands over a card and read as the way back up to
             * the list. It was an anchor, so it opened the reader's browser at GitHub's
             * own list while the app's list was the screen directly behind it. Same
             * destination as the mark in the corner, for the same reason: see
             * `around.ts`, and `outside.ts` in the window's view.
             */
            const up =
              onHome !== undefined && listsPullRequests(one.href) ? onHome : undefined;

            return (
              <Chip
                key={one.href}
                href={one.href}
                press={up}
                {...said(one.standing)}
                /*
                 * Where the reader is, a step deeper than the grey the tab beside it takes
                 * under a pointer. Two steps of one ladder rather than a fill of the pack's
                 * accent: `bg-hover` alone was a current tab nobody could find on a dark
                 * pack, and the accent was a tab that looked pressed rather than current.
                 * See `HERE` in `dress.ts`.
                 *
                 * The section around the page is the third state, and it is the ink rather
                 * than a third fill, because there are only two: a pointer takes `bg-hover`
                 * and the page being read takes `bg-active`. Full-strength words against the
                 * muted ones either side, and nothing filled, so the tab a reader is standing
                 * on stays the only one in this row wearing a fill. See `INSIDE`.
                 */
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 no-underline ${
                  one.standing === "here"
                    ? `${HERE} font-semibold`
                    : one.standing === "inside"
                      ? `${INSIDE} hover:bg-hover`
                      : "text-ink-muted hover:bg-hover hover:text-ink"
                }`}
              >
                <Mark size={14} className="shrink-0" />
                {one.name}
                {one.count === undefined ? null : (
                  <span
                    /* Muted anywhere but on the page being read, the section included: the
                       number is a fact beside the name rather than part of it, and a count at
                       full strength beside a name at full strength is one word of two. */
                    className={`font-mono text-xs tabular-nums ${
                      one.standing === "here" ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    {one.count}
                  </span>
                )}
              </Chip>
            );
          })}

          {/*
           * Everything else their row has, at the end of the tabs rather than behind the
           * repository's name: a reader looking for Actions is looking along this row, and
           * the name now answers a different question. Wordless, because the six behind it
           * have no one word between them and the glyph for "the rest" is a known one.
           *
           * Drawn only where something is behind it. Their row is read off the page and
           * arrives late, so the strip spends the first moment of a load with the tabs an
           * address can name and nothing spare.
           */}
          {rest.length === 0 ? null : (
            <div className="relative flex">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={opened === "tabs"}
                aria-label="More in this repository"
                title="More in this repository"
                onClick={() => setOpened(opened === "tabs" ? undefined : "tabs")}
                /* Nothing at rest, like the tabs it stands at the end of. A filled square
                   beside two unfilled words reads as the control that matters here, and the
                   six things behind it are the six a reader opens monthly. */
                className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
              >
                <More size={16} />
              </button>
              <Menu
                name="This repository"
                origin="top-left"
                open={opened === "tabs"}
                onShut={() => setOpened(undefined)}
                rows={rest.map((one) => ({
                  name: one.name,
                  where: one.href,
                  art: tabMark(one.name),
                }))}
              />
            </div>
          )}
        </nav>
      )}

      {onSearch === undefined ? null : (
        <button
          type="button"
          onClick={onSearch}
          /*
           * Over the reading column rather than pinned to the far right, where theirs sits at
           * x=1355 on a 1920-wide window: a reader looking for a repository is looking at the
           * left of the page, which is where the Rail's own filter is.
           */
          /*
           * Eighteen rem, which is a control rather than a column.
           *
           * It was capped at the palette's own 576 on the argument that a trigger the width of
           * the dialog reads as the same thing twice. True of the dialog, wrong about the strip:
           * at 576 this was the largest object in the bar — 37% of the width on a 1024 window —
           * for a button whose whole content is four words and a key. The reader is not aiming
           * at it anyway, they are pressing ⌘K, and the cap on the right says so.
           *
           * `flex-1` under the cap, so a narrow window shrinks it instead of pushing the tray
           * off the end.
           */
          /*
           * Two steps of the ladder down rather than one, and the hover is in the ink.
           *
           * At `bg-hover` — the tint every chip in the interface wears — a field eight
           * pixels tall and thirty-six rem wide was the faintest thing in the strip: the
           * one control here a reader has to find without being told where it is. `bg-active`
           * is the deepest fill the pack has, and it is the same in every pack, which is why
           * this is a tint rather than `bg-canvas`: on GitHub's own pack the canvas is
           * lighter than the surface it would be sunk into.
           */
          className="flex h-7 min-w-0 max-w-[18rem] flex-1 items-center gap-2 rounded-md bg-active px-2.5 text-ink-muted hover:text-ink"
        >
          <Search size={14} />
          <span className="truncate">Search anything you have</span>
          {/* The same cap every other key in this interface wears, rather than a badge
              of this button's own: two spellings of one key is how a reader stops
              believing either of them. */}
          <span className="ml-auto flex shrink-0">
            <Cap chord="⌘K" />
          </span>
        </button>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* Ahead of the inbox and the Participant, so the two controls that go
            somewhere stay together at the corner and the one that opens a sheet
            of ours does not sit between them. */}
        {corner}

        <a
          href="/notifications"
          aria-label={
            unread ? "Notifications, something is waiting" : "Notifications"
          }
          className="relative grid size-7 place-items-center rounded-md text-ink-muted no-underline hover:bg-hover hover:text-ink"
        >
          {/*
           * The glyph carries it, and never a number. Their own bar carries no count
           * and `/notifications/indicator` answers `{"mode":"global"}` — so a number
           * here would be a figure this extension invented.
           *
           * There was a dot drawn over the corner of the glyph as well. Two marks for
           * one fact, once the tray started saying it itself: the state is in the
           * drawing, and in the name on the link for anyone not looking at drawings.
           */}
          <Inbox size={16} />
        </a>

        {participant === undefined ? null : (
          <div className="relative flex">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={opened === "account"}
              onClick={() =>
                setOpened(opened === "account" ? undefined : "account")
              }
              className={`flex items-center gap-1.5 px-2 py-1 ${PRESSABLE} text-ink-muted hover:bg-active hover:text-ink`}
            >
              <Face
                faceUrl={participant.faceUrl}
                name={participant.login}
                big
              />
              <span className="max-w-32 truncate">{participant.login}</span>
              <Chevron
                size={12}
                className={`t-turn ${opened === "account" ? "is-turned" : ""}`}
              />
            </button>
            <Menu
              name="Your account"
              origin="top-right"
              open={opened === "account"}
              onShut={() => setOpened(undefined)}
              rows={participantRows({ login: participant.login })}
            />
          </div>
        )}

        {/*
         * The way out, in the strip rather than on the screen below it, and last
         * in the row.
         *
         * It was a control on the pull request card, which put the exit on one
         * of the four screens this extension draws and left the other three
         * with it buried in a menu. The bar is the one thing on every page, so
         * the way back to GitHub is in the same corner throughout — and a
         * reader who wants their page does not have to work out which part of
         * ours is offering it this time. The far corner is where a reader looks
         * for the control that leaves, and it is the one spot nothing else in
         * this row can push along when a login runs long.
         *
         * Wordless like the inbox beside it. The mark says where it goes; the
         * name is on it for a pointer and for a screen reader.
         */}
        {onStepAside === undefined ? null : (
          <button
            type="button"
            onClick={onStepAside}
            aria-label="Show GitHub's own page"
            title="Show GitHub's own page"
            className="grid size-7 place-items-center rounded-md text-ink-muted hover:bg-hover hover:text-ink"
          >
            <TheirMark size={16} />
          </button>
        )}

        {/* And past all of it, whatever is around this bar: see {@link tray}. */}
        {tray}
      </div>
    </header>
  );
};

/**
 * A thing in the strip that is an address on a page and a press in a window.
 *
 * The same statement `Ours` makes about Home, made once for the row of tabs beside it.
 * A tab is a link and belongs in an anchor: on GitHub a reader opens it in a new tab,
 * copies it, middle-clicks it, and the address is what says where it goes. In the
 * window some of those destinations are screens rather than pages — there is one
 * webview and nothing behind it — and an anchor to one of them sends the reader out to
 * a browser for something they are already looking at.
 *
 * Given no press it is the anchor it has always been, which is every page.
 */
const Chip = ({
  href,
  press,
  className,
  children,
  ...said
}: {
  readonly href: string;
  readonly press?: (() => void) | undefined;
  readonly className: string;
  readonly children: ReactNode;
} & { readonly "aria-current"?: "page" | "location" }) => {
  if (press !== undefined)
    return (
      <button type="button" onClick={press} className={className} {...said}>
        {children}
      </button>
    );

  return (
    <a href={href} className={className} {...said}>
      {children}
    </a>
  );
};

/**
 * What stands where their logo stood, on every page rather than only on Home.
 *
 * A mark and nothing else. This said "Working Set — 4 yours" until the Rail below it was drawing
 * the same word and the same number twenty pixels lower, and a crumb that repeats the navigation
 * it sits above is two claims on the same fact: one of them has to be wrong eventually. The Rail
 * keeps it, being the thing a reader presses; the strip keeps the space for the search.
 *
 * It stood on Home only, which is the one page where it goes nowhere: the Rail is beside that
 * list and Home is already what the reader is looking at. A pull request has no Rail, so the
 * whole of our navigation there pointed further into the repository, and the way out was
 * GitHub's own logo in a bar this extension hides. Home is where the Working Set is, and that
 * is the address a reader wants next more often than any other.
 */
const Ours = ({
  here,
  onHome,
}: {
  readonly here: boolean;
  readonly onHome?: (() => void) | undefined;
}) => {
  const art = useArt();
  const Mark = art.home;
  /*
   * One drawing, two kinds of control, because the two hosts mean different things by
   * Home. On a page it is an address and belongs in an anchor: a reader opens it in a
   * new tab, copies it, middle-clicks it. In the window it is a screen this one becomes,
   * there is no address to copy, and an anchor to `/` unloaded the app. See `around.ts`.
   */
  const shape =
    "flex size-7 shrink-0 items-center justify-center rounded-md text-ink-muted no-underline hover:bg-hover hover:text-ink";
  /*
   * Said aloud but not painted.
   *
   * It wore the accent fill on Home, on the reasoning that the accent is this pack's own
   * "you are here". Two things were wrong with that. The Rail is beside the list on Home
   * and already says which Destination is showing, so the fill was the third place one
   * fact was drawn; and this is the leftmost thing in the bar and the only mark of ours
   * up there, so a coloured square in that corner reads as a badge for the extension
   * rather than as the way back to the Working Set. `aria-current` still carries it for
   * anyone being read to, which is where the fact was load-bearing.
   */
  const said = {
    "aria-label": "Home",
    title: "Home",
    className: shape,
    ...(here ? { "aria-current": "page" as const } : {}),
  };

  if (onHome !== undefined)
    return (
      <button type="button" onClick={onHome} {...said}>
        <Mark size={16} />
      </button>
    );

  return (
    <a href={THE_HOME} {...said}>
      <Mark size={16} />
    </a>
  );
};
