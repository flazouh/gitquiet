import { Effect, Option } from "effect";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Owed } from "../domain/finding";
import { showsWorkingSet } from "../domain/pages";
import { fromPathname } from "../domain/PullRequestRef";
import { type Repository, withPinToggled } from "../domain/repositories";
import { tokensOf } from "../domain/theme";
import { keepTabs, keptTabs } from "../github/repoTabs";
import { type ArtName } from "./art";
import { Bar, type BarProps } from "./Bar";
import { useAround } from "./around";
import { goBack, goBackTo, goForward, theTrail, watchTheTrail } from "./going";
import { keepTheBarSlot, theBarSlot, theBarStands } from "./barSlot";
import { keepRepositories, keptRepositories } from "./keptRepositories";
import { Palette } from "./Palette";
import { keepRefraction } from "./refraction";
import { SettingsDialog } from "./SettingsDialog";
import { paintTokens } from "./applyTheme";
import { usePaintedTheme } from "./Theme";
import { useOursToDraw } from "./useOursToDraw";
import { whenTheScreenMoves } from "./mount";
import { useSettings } from "./useSettings";
import { useScreenActivity } from "./screenActivity";
import { tabMark } from "./tabMarks";
import { participantOnPage } from "./viewer";
import { visited, visiting } from "./visited";
import { prepareTo } from "../app/intent";
import {
  readingTheCode,
  repositoryTabs,
  tabsWeCanName,
  theirRowIsFor,
  type Tab,
} from "./theirNav";

const NOTHING: ReadonlyArray<never> = [];

const prepareOnThisPage = (path: string): void => prepareTo(window, path);

/**
 * The bar, put where a bar goes, with the palette behind its search.
 *
 * A portal rather than an element inside the screen, because every screen this extension draws
 * stands in a region halfway down GitHub's document and the bar belongs above all of it. One
 * React tree either way: the bar reads the same state the screen does, so a Destination pressed
 * in the Rail and the words in the crumb can never disagree.
 *
 * See `docs/spec/top-bar.md`.
 */
export const TheBar = ({
  repositories,
  owed = NOTHING,
  recall,
  participant,
  preparedRoot,
  onPrepareRoute,
  ...props
}: Omit<
  BarProps,
  | "tabs"
  | "onSearch"
  | "corner"
  | "onBack"
  | "onPrepareBack"
  | "onForward"
  | "onPrepareForward"
  | "behind"
> & {
  /**
   * Every repository the reader has, for the palette. Left out and no search is offered at
   * all — a control that presses into an empty list is the mistake this bar exists to undo.
   */
  readonly repositories?: ReadonlyArray<Repository>;
  /** Whatever the screen is owed, so ⌘K finds a pull request by its title as well. */
  readonly owed?: ReadonlyArray<Owed>;
  /**
   * The list as the last visit to Home left it, for the screens that never read one.
   *
   * A pull request page has no reason to ask GitHub for a hundred and fifty repositories, and
   * asking anyway to fill a dialog nobody may open is how an extension earns its reputation.
   * The store already has them, so this reads the store: no request, and no search offered on a
   * reader who has not been to Home yet.
   */
  readonly recall?: () => Effect.Effect<
    Option.Option<ReadonlyArray<Repository>>
  >;
  /** A detached route root whose bar is being built before navigation. */
  readonly preparedRoot?: Element;
  /** Builds an exact history route before the reader presses Back or Forward. */
  readonly onPrepareRoute?: (path: string) => void;
}) => {
  const active = useScreenActivity();
  const prepareRoute = onPrepareRoute ?? prepareOnThisPage;
  /*
   * Whatever is around this screen, which in the extension is a page and answers none
   * of it: no element to stand in, Home an address, and nothing of its own in the
   * tray. See `around.ts` for who answers otherwise and why.
   */
  const around = useAround();
  const pageSlot = useMemo(() => theBarSlot(document, around.within), [around.within]);
  const [preparedSlot] = useState(() => {
    if (preparedRoot === undefined) return null;
    const made = document.createElement("div");
    made.style.display = "contents";
    return made;
  });
  const slot = preparedSlot ?? pageSlot;
  const drawing = useOursToDraw() && active;
  /*
   * The reader's own choices, read here so the way into them can stand in the strip.
   *
   * The button used to hang off the right end of the files band, which meant a pull request had
   * it and Home, a repository's pull requests and the history did not. Nothing about how a diff
   * is drawn belongs to one screen, and this bar is the only thing on all of them.
   */
  const { settings, change } = useSettings();
  /*
   * Their row where the document already has one, and this repository's own row as the last
   * read left it where it does not.
   *
   * The second half is the fix for a bar that said Code and Pull requests on a repository
   * whose issues the reader had been reading all week. Their row is inside the header their
   * React hydrates, so on a press it is simply not there yet, and an address can only promise
   * the two tabs every repository has. The kept row is read under this repository's own name
   * — see `repoTabs.ts` — so it can never be another repository's tabs under this one's.
   */
  const [tabs, setTabs] = useState<ReadonlyArray<Tab>>(() => {
    const theirs = repositoryTabs(document);
    if (theirs.length > 0 || props.where.kind !== "repository") return theirs;

    return keptTabs(props.where);
  });
  /*
   * Seeded with the list the last read kept, because of when this tree is built.
   *
   * Every screen here is its own bundle, so a press on a row builds a whole new bar,
   * and the read below answers a moment after it first renders. The chevron is drawn
   * only where there is a list to switch to, so an empty start was a control that
   * vanished and came back under the pointer on every press: about a tenth of a
   * second, measured on a press from a list to a card. See `keptRepositories.ts`.
   *
   * Only where there is a read to wait for. A screen that hands in neither a list nor
   * a way to recall one is a screen offering no switcher and no search, and a seed
   * would give it both out of a store it never asked to be read.
   */
  const [kept, setKept] = useState<ReadonlyArray<Repository>>(() =>
    recall === undefined ? NOTHING : keptRepositories(),
  );
  const [finding, setFinding] = useState(false);

  useEffect(() => {
    // The pane's glass is a filter, and a filter has to be in the document to be referenced from
    // one. See `refraction.ts`; the stylesheet asks for it by name in `glass.css`.
    keepRefraction(document);
    return keepTheBarSlot(document, slot, around.within);
  }, [slot, around.within]);

  /*
   * How much sky the bar takes, said where the screens can read it.
   *
   * The code column pins itself to the top of the viewport, and the bar floats
   * over that same top on its own sticky. Only the bar knows how tall it is —
   * it wraps at narrow widths — so it writes the number where the column's
   * offset reads it: see the sticky wrapper in `Shell.tsx`. Onto `<html>` like
   * the floor, and for the floor's second reason too: the screen's root is a
   * detached element while this first runs, and `getElementById` cannot see
   * it. Without this the column clamped at eight pixels while the bar covered
   * the first fifty-odd, and at full scroll the files band sat hidden under it.
   */
  useEffect(() => {
    const say = () =>
      document.documentElement.style.setProperty(
        "--gitquiet-bar-h",
        `${Math.round(slot.getBoundingClientRect().height)}px`,
      );
    say();
    if (typeof ResizeObserver === "undefined") return;
    const watching = new ResizeObserver(say);
    watching.observe(slot);
    return () => watching.disconnect();
  }, [slot]);

  /*
   * A list handed straight in is the freshest one this bar ever sees: Home and the
   * Working Set read the whole thing off GitHub, and every other screen reads the
   * store. So it is kept here rather than only where the read below answers, and the
   * card a reader presses next has it before its first render.
   */
  useEffect(() => {
    if (repositories === undefined) return;
    keepRepositories(repositories);
  }, [repositories]);

  useEffect(() => {
    if (repositories !== undefined || recall === undefined) return;

    const reading = Effect.runFork(
      Effect.match(recall(), {
        onFailure: () => undefined,
        onSuccess: (found) => {
          const list = Option.getOrElse(found, () => NOTHING);
          /*
           * An answer of nothing is not an answer. The store says nothing whenever
           * its own copy of the list has gone cold, and this bar cannot tell that
           * from a reader with no repositories — so the seed stands, here as well as
           * in the store behind it. Taken as an answer, this read put the chevron on
           * the screen off the seed and then took it away again.
           */
          if (list.length === 0) return;
          /*
           * The same list is the same state, and saying so is what stops a spin.
           * A screen is free to hand in `recall` as it likes, and one written inline
           * is a new function on every render: a fresh array through `setKept` would
           * re-render, re-run this read, and answer with another fresh array for as
           * long as the page was open. Their nav row is held the same way above.
           */
          setKept((had) => (sameList(had, list) ? had : list));
          // For the next bar built rather than for this one, which is already
          // drawing it. An answer of nothing is not kept over a list that is: the
          // store says nothing whenever its own copy has gone cold, and this bar
          // cannot tell that from a reader who has no repositories. See
          // `keepRepositories`.
          keepRepositories(list);
        },
      }),
    );
    return () => reading.interruptUnsafe();
  }, [repositories, recall]);

  /*
   * Their nav row, whenever the one for this repository turns up.
   *
   * It is inside the header their own React hydrates, so on a load it is often not there when
   * the first screen renders, and on a soft navigation it is replaced rather than updated. Read
   * once, and if there was nothing of this repository to read, watch until there is — then stop
   * watching, because this runs on every mutation of a GitHub page and there is exactly one
   * thing it wants.
   *
   * "Of this repository" is the whole of it. A row read on a switch between repositories is
   * full, valid, and about the one just left, because their address changes before their row
   * does; taken as the answer it left the reader pressing Pull requests on `hello-world` and landing
   * on `bun`. See `theirRowIsFor`.
   */
  const ours = (theirs: ReadonlyArray<Tab>) =>
    props.where.kind === "repository"
      ? theirRowIsFor(props.where, theirs)
      : theirs.length > 0;

  useEffect(() => {
    const read = () => {
      const theirs = repositoryTabs(document);
      if (!ours(theirs)) return false;
      setTabs((had) => (sameTabs(had, theirs) ? had : theirs));
      // For the next bar built over this repository rather than for this one, which is
      // drawing it already. Their counts move, so the freshest row wins the store too.
      if (props.where.kind === "repository") keepTabs(props.where, theirs);
      return true;
    };

    if (read()) return;

    const watch = new MutationObserver(() => {
      if (read()) watch.disconnect();
    });
    watch.observe(document.body, { childList: true, subtree: true });
    return () => watch.disconnect();
    // `ours` closes over `props.where` and nothing else, which is the dependency named.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.where]);

  /*
   * Theirs where there is a row of this repository to read, this repository's kept row until
   * there is, and the two an address can name where there has never been one.
   *
   * The middle one is new and it is the whole of the fix. A stored row was refused here once,
   * and rightly: one row for all of GitHub is `bun`'s tabs above `hello-world` for as long as the
   * hydration takes. Kept under the repository's own name it cannot be another's — and what
   * an address alone can name is Code and Pull requests, which on a repository with two
   * hundred issues is a bar with no way to them. See `repoTabs.ts` and `theirRowIsFor`.
   */
  const shown =
    props.where.kind !== "repository"
      ? tabs
      : theirRowIsFor(props.where, tabs)
        ? tabs
        : keptFor(props.where, tabsWeCanName(props.where, window.location.pathname));

  const findable = repositories ?? kept;
  const searchable = findable.length > 0 || owed.length > 0;

  /*
   * Whoever their own page says is here, unless the screen was told by its own read.
   *
   * Read here because thirteen of the fourteen screens never read it: `participantOnPage`
   * was called in `screens/workingSet.tsx` and nowhere else, so `/pulls` was the only page
   * in the build whose tray carried the account at all. It belongs on this component for
   * the reason the nav row above does — it is a fact about the document, and the bar is
   * the one thing standing on every page.
   *
   * Read on every render rather than once, which is how the face arrives. Their header
   * hydrates after the document, so the login is there from the start and the avatar is
   * not, and a single read at mount would leave an initial where there is a face to draw.
   */
  const reader = participant ?? participantOnPage();

  /*
   * Where the reader has been, read once for the life of this screen and then recorded.
   *
   * Read first, so that the repository being read now does not arrive as its own most recent
   * visit — it leads the list anyway, by being the one it is. Frozen rather than read on every
   * render for the sake of an open menu: a switcher whose rows changed places under the pointer
   * while somebody was aiming at one of them would be worse than the alphabet it replaces.
   */
  const [lately] = useState(visited);

  /*
   * Where the reader can go from here, read off the browser and kept fresh.
   *
   * Read again on every move rather than once at mount. Most moves build a whole
   * new bar — each screen is its own bundle — but not all of them: a list going
   * back to its own first page redraws in place, and a bar that had answered once
   * would still be saying there is nothing ahead while the reader stood on a page
   * with something ahead. See `watchTheTrail`.
   */
  const [trail, setTrail] = useState(() => theTrail(window));

  useEffect(() => {
    const update = () => {
      if (!active || (preparedRoot !== undefined && !preparedRoot.isConnected)) return;
      setTrail(theTrail(window));
    };
    update();
    const stopTrail = watchTheTrail(window, update);
    const stopScreen =
      preparedRoot === undefined ? () => {} : whenTheScreenMoves(document, update);
    return () => {
      stopTrail();
      stopScreen();
    };
  }, [active, preparedRoot]);

  useEffect(() => {
    if (preparedSlot === null || preparedRoot === undefined) {
      if (drawing) theBarStands(document);
      return;
    }

    const activate = () => {
      if (!preparedRoot.isConnected) return;
      pageSlot.append(preparedSlot);
      if (drawing) theBarStands(document);
    };
    activate();
    const stop = whenTheScreenMoves(document, activate);
    return () => {
      stop();
      preparedSlot.remove();
    };
  }, [drawing, pageSlot, preparedRoot, preparedSlot]);

  useEffect(() => {
    if (
      !active ||
      props.where.kind !== "repository" ||
      (preparedRoot !== undefined && !preparedRoot.isConnected)
    )
      return;
    visiting(`${props.where.owner}/${props.where.repo}`);
  }, [active, preparedRoot, props.where]);

  /*
   * ⌘K, and on the document rather than on the bar: the reader is looking at a list, a diff or
   * a conversation when they reach for it, and a key that only worked while the bar had focus
   * would be a key nobody could use. Captured, because GitHub binds letters of its own all
   * over the page — and left alone entirely while something of ours is already typing.
   */
  useEffect(() => {
    if (!active || !searchable) return;

    const onKey = (event: KeyboardEvent) => {
      if (preparedRoot !== undefined && !preparedRoot.isConnected) return;
      if (event.key !== "k" || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      event.stopPropagation();
      setFinding((was) => !was);
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active, preparedRoot, searchable]);

  /*
   * Nothing at all while another screen of ours has the page.
   *
   * There is one slot and there are two trees for the whole second between a press and the
   * address moving, so without this the reader gets both bars, one under the other — and keeps
   * the second one for good where the screen that drew it never arrived. See `oursToDraw`.
   */
  if (!drawing) return null;

  return createPortal(
    <>
      <PaintedSlot slot={slot} />
      <Bar
        {...props}
        participant={reader}
        tabs={shown}
        /* The same list the palette searches, so the switcher and ⌘K can never disagree. */
        repositories={findable}
        pinned={settings.pinned}
        lately={lately}
        onPin={(address) =>
          change((current) => ({
            ...current,
            pinned: withPinToggled(current.pinned, address),
          }))
        }
        atTheCode={
          props.where.kind === "repository" &&
          readingTheCode(props.where, window.location.pathname)
        }
        onSearch={searchable ? () => setFinding(true) : undefined}
        onBack={trail.back ? () => goBack(window) : undefined}
        onPrepareBack={
          trail.behind[0] === undefined
            ? undefined
            : () => prepareRoute(trail.behind[0]!.at)
        }
        onForward={trail.forward ? () => goForward(window) : undefined}
        onPrepareForward={
          trail.ahead === undefined
            ? undefined
            : () => prepareRoute(trail.ahead!)
        }
        behind={eachOnce(
          trail.behind.map((step) => ({
            ...theNameOf(step.at),
            id: `${step.back}`,
            /* The address as well as the press, so a place in the trail can be
               opened in a new tab or copied like any other link. The plain press
               goes to the entry itself, which is the page as the reader left it
               rather than a fresh load of the same address. */
            where: step.at,
            press: () => goBackTo(window, step),
          })),
        )}
        corner={<SettingsDialog settings={settings} onChange={change} />}
        /*
         * The two things the surroundings know and this does not: what Home means where
         * it is not an address, and what they keep past everything about the page. Both
         * are absent on a page, which is why they are read here rather than taken as
         * props — every screen in the extension would have had to carry two it never
         * fills. See `around.ts`.
         */
        onHome={around.home}
        tray={around.tray}
      />
      {finding ? (
        <Palette
          repositories={findable}
          inside={props.where.kind === "repository" ? props.where : undefined}
          owed={owed}
          onShut={() => setFinding(false)}
        />
      ) : null}
    </>,
    slot,
  );
};

/**
 * The slot, wearing what the page's one Theme resolved.
 *
 * The tokens are inline custom properties on `#gitquiet-root`, and the slot is
 * deliberately not inside it — a bar has to stand above a page, not within the
 * region of it we replaced. Nothing inherits across that gap, so unpainted it
 * resolves the stylesheet's light defaults and reads white over a dark page.
 *
 * It used to carry a Theme of its own here, which was a second resolver: with
 * the pack on "match" it answered `gitquiet` where the screen's answered
 * `github`, and both wrote their answer into the early-paint keys — so the pack
 * the next page's first frame wore depended on whose store read landed last,
 * and the theme changed between the pages. A surface takes the resolution from
 * above and remembers nothing.
 */
const PaintedSlot = ({ slot }: { readonly slot: HTMLElement }) => {
  const painted = usePaintedTheme();

  useLayoutEffect(() => {
    paintTokens(slot, tokensOf(painted.pack, painted.scheme), painted.scheme);
  }, [slot, painted]);

  return null;
};

/**
 * One name once, keeping the nearest place that wears it.
 *
 * `theTrail` already says one address once, and an address is not what a reader
 * reads. A pull request opened, then opened again with the diff split, is two
 * addresses and one page: `?diff=split` differs, the name does not, and the menu
 * offered "#12 in flazouh/ghpro-scratch" twice with no way to tell the rows apart.
 * Two pages of one list collapse the same way and for the same reason.
 */
const eachOnce = <One extends { readonly name: string }>(
  rows: ReadonlyArray<One>,
): ReadonlyArray<One> =>
  rows.filter((one, at) => rows.findIndex((other) => other.name === one.name) === at);

/**
 * What one place in the trail is called, and which glyph it wears.
 *
 * From the address and nothing else. The browser lists the entries a tab has been
 * through and gives their addresses; it does not give their titles, and the pages
 * are not ours to have kept a title for — half of them are GitHub's own. So this
 * says what an address can honestly say, and falls back to the path itself, which
 * is what a reader would read in an address bar anyway.
 *
 * The kinds are the ones the reader walks between: the Working Set, a pull request,
 * a repository's own lists, a repository. Their own pages fall through to the path
 * rather than being guessed at from the shape of it.
 */
const theNameOf = (at: string): { readonly name: string; readonly art: ArtName } => {
  const path = at.replace(/[?#].*$/, "");
  if (showsWorkingSet(path)) return { name: "Working Set", art: "working-set" };
  if (path === "/notifications")
    return { name: "Notifications", art: "notifications" };

  const pull = fromPathname(path);
  if (Option.isSome(pull))
    return {
      name: `#${pull.value.number} in ${pull.value.owner}/${pull.value.repo}`,
      art: "pull-request",
    };

  const parts = path.split("/").filter((one) => one !== "");
  const [owner, repo, section] = parts;
  if (owner === undefined || repo === undefined) return { name: path, art: "dot" };

  const named = `${owner}/${repo}`;
  if (section === undefined) return { name: named, art: "code" };
  if (parts.length > 3) return { name: path, art: "dot" };

  return { name: `${named}: ${section}`, art: tabMark(section) };
};

/**
 * Whether two reads of the repository list are the same list.
 *
 * By the one name that is an address, and in order. Everything a row draws beyond
 * that name is read in the same answer, so a list whose names and order match is a
 * list nothing on this bar would draw differently.
 */
const sameList = (
  left: ReadonlyArray<Repository>,
  right: ReadonlyArray<Repository>,
): boolean =>
  left.length === right.length &&
  left.every((one, at) => one.nameWithOwner === right[at]?.nameWithOwner);

/**
 * The kept row for this repository, or whatever was to be drawn without one.
 *
 * Empty is the answer for a repository never opened before, and it stays empty rather than
 * borrowing: every row here is read under one repository's name and drawn under the same.
 */
const keptFor = (
  where: { readonly owner: string; readonly repo: string },
  otherwise: ReadonlyArray<Tab>,
): ReadonlyArray<Tab> => {
  const kept = keptTabs(where);
  return kept.length > 0 ? kept : otherwise;
};

const sameTabs = (
  left: ReadonlyArray<Tab>,
  right: ReadonlyArray<Tab>,
): boolean =>
  left.length === right.length &&
  left.every((one, at) => {
    const other = right[at];
    return (
      other !== undefined &&
      one.href === other.href &&
      one.name === other.name &&
      one.count === other.count &&
      one.here === other.here
    );
  });
