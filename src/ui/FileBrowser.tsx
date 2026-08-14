import type { Uploaded } from "../domain/attaching";
import type { Suggesting } from "../domain/suggesting";
import { Effect, Option } from "effect";
import { useCallback, useEffect, useMemo, useState } from "react";
import { diffLibrary, type DiffFetcher } from "../domain/library";
import { railOrder } from "../domain/railOrder";
import { readingOrder } from "../domain/readingOrder";
import { acted, footingOf, markOf } from "../domain/reviewPass";
import { stepping } from "../domain/stepping";
import type { DiffChoices, TreeChoices } from "../domain/choices";
import type { Settings } from "../domain/Settings";
import type {
  ChangedFile,
  FileDiff,
  ReviewThread,
} from "../domain/PullRequest";
import type { DiffSide } from "../ports/Renderer";
import { chordFor, DEFAULT_PROFILE, type Profile } from "../keys/commands";
import { Cap } from "./Cap";
import { draftsIn, dropDraft, saveDraft, type Draft } from "./drafts";
import { FileDiffPane, FileTreePane } from "./Files";
import { FileHeading } from "./FileHeading";
import { keepPass, passOf } from "./passes";
import { seenFiles } from "./rowMarks";
import { SettingsMenu } from "./SettingsMenu";
import type { Answering } from "./ThreadView";
import { useKeys } from "./useKeys";
import { type Way, Ways } from "./Ways";

export type FileBrowserProps = {
  readonly files: ReadonlyArray<ChangedFile>;
  readonly fetchDiffs: DiffFetcher;
  readonly diff: DiffChoices;
  readonly tree: TreeChoices;
  /** Markdown files open as documents unless the reader turned that off. */
  readonly proseAsDocument?: boolean;
  /** Whose keys move between files, and reach the tree's filter. */
  readonly keys?: Profile;
  /**
   * A file somewhere else asked for, such as one named in a failing log.
   *
   * Carried as a whole object rather than a path so that asking twice for the
   * same file still counts as asking: a reader who clicks the same line in a
   * log again means it, and a path compared against itself would ignore them.
   */
  readonly wanted?: { readonly path: string };
  /** Everything said on the pull request, so a remark can sit on its own line. */
  readonly threads?: ReadonlyArray<ReviewThread>;
  /** What can be done to a thread hung off a line here. See `ThreadView`. */
  readonly answering?: Answering;
  /** Sends a remark on some lines of a file to GitHub. */
  readonly onPost?: (note: {
    readonly path: string;
    /** Which half of the diff the lines were marked on, since the two are numbered apart. */
    readonly side: DiffSide;
    readonly from: number;
    readonly to: number;
    readonly body: string;
  }) => Effect.Effect<void, unknown>;
  /** Whoever is writing, so the box is signed the way the remark will be. */
  readonly viewer?: { readonly login: string; readonly faceUrl?: string };
  /** Who can be mentioned and what can be referred to, for a box on a line. See `Writing`. */
  readonly suggest?: () => Effect.Effect<Suggesting, unknown>;
  /**
   * A file pasted or dropped into a box here, put where GitHub keeps them.
   *
   * Handed down beside `suggest` and for the same reason: the box is the only thing that knows
   * a file arrived in it. See `attaching.ts`.
   */
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>;
  /**
   * Gives the files the full viewport without replacing this component.
   *
   * Keeping the same component preserves the open file, its scroll position,
   * the warmed diffs, and every draft while the reader enters or leaves.
   */
  readonly review?: {
    readonly active: boolean;
    readonly subject: string;
    readonly head: string;
    readonly onChange: (active: boolean) => void;
  };
  /**
   * The knobs the diff and the rail are drawn by, and the way to change them.
   *
   * Handed in rather than read here, because the screen above reads them once
   * and hands the settled answers down: a second reader of the store on the same
   * page is a second copy that can disagree with the first. Absent on a screen
   * that has no way to write them, where the band simply has no button.
   */
  readonly display?: {
    readonly settings: Settings;
    readonly onChange: (settings: Settings) => void;
  };
};

/**
 * How far ahead to read. A pull request of nine hundred files is not going to
 * be read to the end, and fetching all of it to find that out is rude to
 * whoever's connection it is.
 */
const WARM_LIMIT = 120;

/**
 * Drawing a file the reader has not asked for yet, once they have stopped
 * asking for things.
 *
 * Opening a file costs a parse, a highlight and a few thousand elements — a
 * third of a second on a pull request of any size, and every millisecond of it
 * inside the keypress that asked for the file, where it is felt as the page
 * going away for a moment. The work does not get smaller by being moved, it
 * gets invisible: done while the reader is reading, `j` has nothing left to do
 * but show what is already there.
 *
 * Idle time rather than a timer, so it never competes with the reader; the
 * deadline is there because a page that is never idle would otherwise never
 * read ahead at all.
 */
const whenIdle = (act: () => void): (() => void) => {
  const later = globalThis.requestIdleCallback;
  if (later === undefined) {
    const soon = setTimeout(act, 200);
    return () => clearTimeout(soon);
  }

  const asked = later(() => act(), { timeout: 1_000 });
  return () => globalThis.cancelIdleCallback?.(asked);
};

/** The files worth holding drawn: the one being read, and the two a key reaches. */
const withinReach = (
  paths: ReadonlyArray<string | undefined>,
): ReadonlyArray<string> => [
  ...new Set(paths.filter((path): path is string => path !== undefined)),
];

const total = (
  files: ReadonlyArray<ChangedFile>,
  of: "linesAdded" | "linesDeleted",
): number => files.reduce((sum, file) => sum + file[of], 0);

const isProse = (path: string): boolean => /\.(md|mdx|markdown)$/i.test(path);

/**
 * The patch, or the document the patch makes.
 *
 * `code` and not `diff` for the left half, though a patch is what it shows. The
 * `diff` glyph is a row of sliders in both sets, drawn for the settings group of
 * that name, and beside an eye it reads as a control panel rather than as the
 * text this file is made of. `code` is the same mark the repository's file pane
 * wears for Source, and it is the same question there: the thing as it is
 * written, or the thing as it reads.
 */
const WAYS = [
  { name: "diff", said: "Diff", art: "code" },
  { name: "preview", said: "Preview", art: "eye" },
] as const satisfies ReadonlyArray<Way<"diff" | "preview">>;

/**
 * The changed files, as two cards of the same shape.
 *
 * The tree is one card and the open file is the other. Same height, same
 * corners, same fill, tops flush — choosing on the left changes the right, and
 * the shared chrome that used to sit above both made the left card start lower
 * than the right and read as a slip.
 */
export const FileBrowser = ({
  files,
  fetchDiffs,
  diff,
  tree,
  proseAsDocument = true,
  keys = DEFAULT_PROFILE,
  wanted,
  threads = [],
  answering,
  onPost,
  viewer,
  suggest,
  onUpload,
  review,
  display,
}: FileBrowserProps) => {
  // The same files, in the order the rail draws them.
  //
  // GitHub sends its own order and the tree does not keep it: folders go above
  // the loose files, and everything is sorted by name. Everything that steps
  // through the files reads this one and not the other, because the rail is
  // what the reader can see. Next and Previous used to step through what GitHub
  // sent, so on a commit with a folder in it the highlight jumped about the
  // rail instead of walking down it — five presses over five files in an order
  // nothing on the screen accounted for.
  const walk = useMemo(() => {
    const held = new Map(files.map((one) => [one.path, one]));
    return railOrder([...held.keys()])
      .map((path) => held.get(path))
      .filter((one): one is ChangedFile => one !== undefined);
  }, [files]);

  // The top of the rail, which is where a reader starts reading and where a
  // held `j` walks down from.
  const first = walk[0];

  const [chosen, setChosen] = useState<string | undefined>(first?.path);
  // A README opens as the document it is; a source file opens as a diff. Both
  // are what the file is normally read as, and either can be switched.
  const [reading, setReading] = useState(
    proseAsDocument && isProse(first?.path ?? ""),
  );

  // Opening a file is what counts as having looked at it. Nothing subtler —
  // dwell time, how far it was scrolled — because the reader can already see
  // which files they opened, and a mark that disagrees with that is a mark
  // nobody trusts twice.
  const [opened, setOpened] = useState<ReadonlySet<string>>(() =>
    first === undefined ? new Set() : new Set([first.path]),
  );

  /**
   * The files the reader has said they are not finished with.
   *
   * Above both halves of the mark: GitHub's own tick and the fact of having
   * opened it here. Which is the point — the mark exists to be trusted, and one
   * that cannot be taken off is one a reader has to keep a note beside.
   *
   * A file leaves this set by being opened again, because opening a file is what
   * counts as looking at it everywhere else in this component and a second rule
   * for the same act would be a mark that disagrees with the screen.
   */
  const [putBack, setPutBack] = useState<ReadonlySet<string>>(new Set());
  const [pass, setPass] = useState(() =>
    review === undefined ? Option.none() : passOf(review.subject),
  );
  const [fetchedMarks, setFetchedMarks] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );

  useEffect(() => {
    setPass(review === undefined ? Option.none() : passOf(review.subject));
    setFetchedMarks(new Map());
  }, [review?.subject]);

  // Which files are drawn, whether or not they are the one on screen. The one
  // being read is always among them; the rest are how Next and Previous become
  // a change of what is visible rather than a file built from scratch.
  const [drawn, setDrawn] = useState<ReadonlyArray<string>>(() =>
    first === undefined ? [] : [first.path],
  );

  const onSelect = useCallback(
    (path: string) => {
      setChosen(path);
      setReading(proseAsDocument && isProse(path));
      setOpened((held) => (held.has(path) ? held : new Set([...held, path])));
      setPutBack((held) => {
        if (!held.has(path)) return held;
        const left = new Set(held);
        left.delete(path);
        return left;
      });
    },
    [proseAsDocument],
  );

  useEffect(() => {
    if (wanted === undefined) return;
    if (files.some((file) => file.path === wanted.path)) onSelect(wanted.path);
  }, [files, onSelect, wanted]);

  const seen = useMemo(
    () => seenFiles(files, opened, putBack),
    [files, opened, putBack],
  );
  const currentMarks = useMemo(() => {
    const marks = new Map(fetchedMarks);
    for (const file of files) {
      if (Option.isSome(file.diff))
        marks.set(file.path, markOf(file.diff.value));
    }
    return marks;
  }, [fetchedMarks, files]);
  const read = useMemo(() => {
    if (Option.isNone(pass)) return new Set<string>();

    return new Set(
      files
        .filter(
          (file) =>
            footingOf(
              pass.value,
              file.path,
              Option.fromNullishOr(currentMarks.get(file.path)),
            ) === "read",
        )
        .map((file) => file.path),
    );
  }, [currentMarks, files, pass]);
  const progress = review?.active === true ? read : seen;

  const library = useMemo(() => diffLibrary(fetchDiffs), [fetchDiffs]);

  // Held here rather than in the pane: the pane is torn down and built again
  // every time another file is opened, and a comment half-written in one file
  // has to still be there after a look at the next.
  const [drafts, setDrafts] = useState<ReadonlyArray<Draft>>([]);
  const onSaveDraft = useCallback((draft: Draft) => {
    setDrafts((held) => saveDraft(held, draft));
  }, []);
  const onDropDraft = useCallback((key: string) => {
    setDrafts((held) => dropDraft(held, key));
  }, []);
  const mine = useMemo(() => draftsIn(drafts, chosen ?? ""), [drafts, chosen]);

  // Where the reader is, which is the first file until they say otherwise.
  //
  // Not "whatever was chosen", because on a page whose files arrived after the
  // panel did nothing was ever chosen: the first file is shown because it is
  // what a panel with nothing chosen shows. Reading the position off the choice
  // alone made the file after the chosen one the first file itself, so the
  // first press of Next moved from the file on screen to the file on screen and
  // the reader pressed it again.
  const chose = walk.findIndex((candidate) => candidate.path === chosen);
  const index = chose === -1 ? 0 : chose;
  const file = walk[index];

  const rememberRead = (readFile: ChangedFile): void => {
    if (review === undefined) return;

    const keep = (diff: FileDiff) => {
      const mark = markOf(diff);
      setFetchedMarks((held) => new Map(held).set(readFile.path, mark));
      setPass((before) => {
        const after = acted(
          before,
          { kind: "read", path: readFile.path, mark },
          { head: review.head, at: Date.now() },
        );
        keepPass(review.subject, after);
        return Option.some(after);
      });
    };

    if (Option.isSome(readFile.diff)) {
      keep(readFile.diff.value);
      return;
    }

    Effect.runFork(
      library.ask(readFile.path).pipe(
        Effect.tap((found) =>
          Effect.sync(() => {
            if (Option.isSome(found)) keep(found.value);
          }),
        ),
      ),
    );
  };

  // Read ahead of the reader. Only the files GitHub held back are worth asking
  // for, in the order they are likely to be opened; the library skips whatever
  // it already holds, so moving through the list costs one request per batch
  // rather than one per file, and Next rarely waits for anything.
  useEffect(() => {
    const held = new Set(
      walk
        .filter((candidate) => Option.isSome(candidate.diff))
        .map((candidate) => candidate.path),
    );
    const order = readingOrder(
      walk.map((candidate) => candidate.path),
      index,
    ).filter((path) => !held.has(path));

    library.warm(order.slice(0, WARM_LIMIT));
  }, [library, walk, index]);
  // A loop rather than a line, so the file after the last is the first again.
  // The two neighbours are also what gets drawn and asked for ahead of the
  // reader, which is why the wrap belongs here rather than in the two handlers:
  // the file on the far side of the end is warm by the time a held key reaches
  // it.
  const previous = walk[stepping(walk.length, index, -1)];
  const next = walk[stepping(walk.length, index, 1)];

  /**
   * The first file still waiting to be read, in the order the rail draws them.
   *
   * From the rail's order rather than GitHub's, for the same reason Next and
   * Previous are: the reader can see the rail, and being sent to a row above the
   * one they were on would read as the highlight jumping about.
   *
   * The file on screen counts as read the moment it opens, so this is never the
   * file already open — which is what makes one press of it always progress.
   */
  const waiting = walk.find((one) => !progress.has(one.path));

  // Two passes, and the order of them is the point. The file asked for joins
  // whatever is already drawn, immediately, so that arriving somewhere never
  // waits; then, once the page is idle, the set is cut back to what a key can
  // reach and the file on the other side of the reader is drawn as well.
  const here = file?.path;
  useEffect(() => {
    if (here === undefined) return;
    setDrawn((held) => (held.includes(here) ? held : [...held, here]));
    // And counted as read. Opening a file is what counts as having looked at
    // it, and the file a panel shows because nothing was chosen has been looked
    // at as much as any other — on a page whose files arrived late, the count
    // said none of them had while one was on the screen.
    setOpened((held) => (held.has(here) ? held : new Set([...held, here])));
  }, [here]);

  useEffect(() => {
    if (here === undefined) return;
    return whenIdle(() =>
      setDrawn(withinReach([previous?.path, here, next?.path])),
    );
  }, [here, previous?.path, next?.path]);

  // A file that has since been dropped from the pull request cannot be drawn.
  const showing = useMemo(
    () =>
      withinReach([here, ...drawn])
        .map((path) => files.find((one) => one.path === path))
        .filter((one): one is ChangedFile => one !== undefined),
    [drawn, files, here],
  );
  const on = chordFor(keys, "nextFile");
  const back = chordFor(keys, "previousFile");
  const mark = chordFor(keys, "markFile");
  const dismiss = chordFor(keys, "dismiss");

  /**
   * The open file's mark, turned over.
   *
   * Both directions from one place, because the reader is answering one question
   * about one file and a pair of buttons for it would be two ways of saying the
   * same thing. Putting a file back is the direction that was missing; marking
   * one seen without opening it is the direction that falls out for free, and it
   * is worth having on a file whose whole change can be read from the tree.
   */
  const turnOver = (): void => {
    if (file === undefined) return;
    const path = file.path;
    const wasSeen = seen.has(path);

    setPutBack((held) => {
      const next = new Set(held);
      if (wasSeen) next.add(path);
      else next.delete(path);
      return next;
    });
    if (!wasSeen)
      setOpened((held) => (held.has(path) ? held : new Set([...held, path])));
  };

  /**
   * Every file back to unread, which is the whole of the complaint this answers.
   *
   * GitHub's checkboxes survive the tab closing, which is what makes them worth
   * having and what makes a second review of the same pull request a hundred
   * clicks. One press here, and walking the list marks them off again as it goes.
   */
  const putAllBack = (): void => {
    setPutBack(new Set(files.map((one) => one.path)));
  };

  // Review Mode changes only the box around this component. The page stays
  // mounted under it, and its scroll position remains ready for the return.
  useEffect(() => {
    if (review?.active !== true) return;

    const before = document.body.style.overflow;
    const left = window.scrollX;
    const top = window.scrollY;
    document.documentElement.setAttribute("data-gitquiet-reviewing", "");
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.removeAttribute("data-gitquiet-reviewing");
      document.body.style.overflow = before;
      window.scrollTo(left, top);
    };
  }, [review?.active]);

  const onward = (to: ChangedFile | undefined): void => {
    if (review?.active === true && file !== undefined) rememberRead(file);
    if (to !== undefined) onSelect(to.path);
  };

  // The review loop, off the keyboard, and it is a loop in both senses: a reader
  // holding `j` down spins through the list and comes back round to the top.
  // Stopping dead at the last file was the earlier answer, on the grounds that
  // wrapping leaves a reader unsure where they are — but the name of the file is
  // on the screen the whole way past, so it does not.
  useKeys(keys, {
    nextFile: () => onward(next),
    previousFile: () => onward(previous),
    markFile: turnOver,
    dismiss: review?.active === true ? () => review.onChange(false) : undefined,
  });

  if (files.length === 0) {
    return (
      <section
        aria-label="Files"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-canvas"
      >
        <p className="px-3 py-3 text-sm text-ink-muted">No files changed</p>
      </section>
    );
  }

  return (
    <section
      aria-label="Files"
      className={
        review?.active === true
          ? "fixed inset-0 flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface p-2"
          : "t-panel-fade flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-surface"
      }
      style={review?.active === true ? { zIndex: 2_147_483_646 } : undefined}
    >
      {/* One header for the pair. What it says — how many files, how far in —
          is a fact about the whole set, so it belongs to the card that holds
          both halves rather than to either half.

          Wrapping, because this row does not get the window: it gets whatever is
          left of it after the conversation beside it, and a reader can make that
          narrower still. Everything in here was `shrink-0` and nothing wrapped,
          so a band wider than its card simply ran off the end of a card that
          hides what overflows — and the thing that went was whatever was last.
          A second line is worth twenty pixels; a control nobody can reach is
          not. See `Merge`, whose own band wraps for the same reason. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        {/* No heading: the card is the files, and the counts say so in the same
            breath as saying how many. The section keeps its name for anyone
            arriving by landmark. */}
        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
          {`${files.length} changed`}{" "}
          <span className="text-pass">+{total(files, "linesAdded")}</span>{" "}
          <span className="text-fail">−{total(files, "linesDeleted")}</span>
        </span>
        {/* How much of the review is behind you. A pull request of forty files
            is read over an afternoon and in three sittings, and the question on
            coming back to it is always the same one. */}
        {/* And the way to the next one that has not been. Clicking a progress
            bar to be taken to the work it is counting is what a reader tries
            anyway, and the alternative was hunting the rail for the first row
            without a tick on it. A plain reading of the number once there is
            nothing left to go to, rather than a button that does nothing. */}
        {(() => {
          const count = `${progress.size} of ${files.length} ${review?.active === true ? "read" : "seen"}`;
          const bar = (
            <>
              <span
                aria-hidden
                className="h-1 w-12 overflow-hidden rounded-full bg-canvas ring-1 ring-line"
              >
                <span
                  className="block h-full bg-pass-emphasis"
                  style={{
                    width: `${Math.round((progress.size / files.length) * 100)}%`,
                  }}
                />
              </span>
              {count}
            </>
          );
          const held =
            review?.active === true
              ? `${progress.size} of ${files.length} file patches read in this Review Pass`
              : `${progress.size} of ${files.length} files opened or ticked as viewed on GitHub`;

          return waiting === undefined ? (
            <span
              className="flex shrink-0 items-center gap-1.5 text-xs text-ink-muted tabular-nums"
              title={held}
            >
              {bar}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onward(waiting)}
              title={`${held}. Go to the first that has not been: ${waiting.path}`}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-ink-muted tabular-nums hover:bg-hover hover:text-ink"
            >
              {bar}
            </button>
          );
        })()}
        {/* Only while there is something to put back, and never during a Review
            Pass: that pass counts patches read against the commit they were read
            on, which is a record of what happened rather than a set of marks to
            be turned over. */}
        {review?.active !== true && seen.size > 0 ? (
          <button
            type="button"
            onClick={putAllBack}
            title="Every file back to unread, so the whole pull request can be read again"
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-ink-muted hover:bg-hover hover:text-ink"
          >
            Put all back
          </button>
        ) : null}
        {/* The open file is named directly above its diff, not here. This band
            belongs to the whole set of files; a name in it spends the width
            that pushed everything else to the right, and repeats what the
            heading below already says.

            Everything that acts, in one group at the right end. Held together
            rather than left loose in the band, so that when the band wraps they
            go onto the next line as a set and stay in the same order, instead of
            two of them being stranded above the other three. `ml-auto` rather
            than a spacer for the same reason: a spacer only pushes on the line it
            is on, and on a wrapped band it is the wrong line. */}
        <span className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
          {/* A README arrives as a wall of pipes and hashes, and the change it
              makes is to a document. Only for prose, and only when there is
              something to render: offering it on a TypeScript file would be a
              switch that does nothing. */}
          {file !== undefined && isProse(file.path) ? (
            <Ways
              ways={WAYS}
              on={reading ? "preview" : "diff"}
              onPick={(way) => setReading(way === "preview")}
              label="How to read this file"
            />
          ) : null}
          {/* Both directions, side by side: reading a review is as much going
              back over a file as moving on from one, and a lone Next makes the
              way back a hunt through the tree.

              Each wears its key. The two buttons are pressed dozens of times in
              one review, which is exactly the place to be told there is a letter
              that does the same thing without the trip to the pointer.

              Neither greys out at an end, there being no ends: the list is a loop
              and both directions always lead somewhere. A pull request of one file
              is the one place they cannot, and they say so. */}
          <span className="flex flex-wrap items-center justify-end gap-1.5">
            {/* This one file's mark, beside the keys that walk past it. Wearing its
              letter for the same reason Next and Previous wear theirs: it is
              pressed once per file for the length of a review. */}
            {file === undefined || review?.active === true ? null : (
              <button
                type="button"
                aria-pressed={seen.has(file.path)}
                aria-keyshortcuts={mark ?? undefined}
                onClick={turnOver}
                title={
                  seen.has(file.path)
                    ? "Put this file back to unread"
                    : "Mark this file as read without opening the rest of it"
                }
                className="flex items-center gap-1.5 rounded-md bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink"
              >
                {seen.has(file.path) ? "Seen" : "Not seen"}
                {mark === null ? null : <Cap chord={mark} />}
              </button>
            )}
            {review === undefined ? null : (
              <button
                type="button"
                aria-pressed={review.active}
                aria-keyshortcuts={
                  review.active ? (dismiss ?? undefined) : undefined
                }
                onClick={() => review.onChange(!review.active)}
                className="flex items-center gap-1.5 rounded-md bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-muted hover:bg-hover hover:text-ink"
              >
                {review.active ? "Exit review" : "Review mode"}
                {review.active && dismiss !== null ? (
                  <Cap chord={dismiss} />
                ) : null}
              </button>
            )}
            <button
              type="button"
              disabled={files.length < 2}
              aria-keyshortcuts={back ?? undefined}
              onClick={() => onward(previous)}
              className="flex items-center gap-1.5 rounded-md bg-canvas px-2.5 py-1 text-xs font-semibold text-ink-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40"
            >
              Previous
              {back === null ? null : <Cap chord={back} />}
            </button>
            <button
              type="button"
              disabled={files.length < 2}
              aria-keyshortcuts={on ?? undefined}
              onClick={() => onward(next)}
              className="flex items-center gap-1.5 rounded-md bg-pass-emphasis px-2.5 py-1 text-xs font-semibold text-ink-on-emphasis enabled:hover:opacity-90 disabled:opacity-40"
            >
              Next file
              {on === null ? null : <Cap chord={on} tone="onEmphasis" />}
            </button>
          </span>
          {/* Last, and out of the cluster: Previous and Next are pressed dozens
              of times in one review and keep the corner the hand has learned,
              while this is opened rarely and never in that rhythm. It is here at
              all because the answer to a diff drawn the wrong way is above the
              diff, not in the bar at the top of the page and two screens away
              from what it changes. The sheet up there is still the place to read
              what each knob does; this is the place to turn one. */}
          {display === undefined ? null : (
            <SettingsMenu
              settings={display.settings}
              onChange={display.onChange}
              label="How the files are drawn"
            />
          )}
        </span>
      </div>

      {/* What the rail's width is a share of. Named as a container so the tree
          can be told to take a fifth of the room the files have rather than a
          fifth of the window: the window also holds a pull request's
          conversation, and a commit's page does not. */}
      {/* Two subcards inside the one card: same fill, same corners, same
          height, tops flush, with the card's own fill showing in the gap. The
          fill is the floor colour rather than `bg-inset`, because several packs
          give `inset` and `surface` the same value — on those, a subcard painted
          `bg-inset` was invisible against the card holding it. */}
      <div className="@container flex min-h-0 flex-1 items-stretch gap-1 p-1 pt-0">
        {/* Wide enough that a nested path still reads: every level of nesting
            spends indentation, and a repository's files are five deep before
            the name even starts.

            The four pixels above the first row are the four the tree already
            keeps at each side — `--trees-padding-inline-override` in
            `Files.tsx`. Without them the top row sat against the subcard's
            edge while being inset from both sides, so a card with one file in
            it read as a row that had slipped out of its frame. */}
        <div
          className={`${tree.width} flex min-h-0 shrink-0 flex-col overflow-hidden rounded-md bg-canvas pt-1`}
        >
          {/* Built again when one of these changes: the tree reads them once,
              when it is constructed, and hands back no way to change its mind.
              Everything else — icons, the marks on a row — it will redraw in
              place, so this key deliberately does not mention them.

              A direct flex child of the subcard: the tree is virtualised and
              sizes itself to its box, and a wrapper that ate the `flex-1` left
              that box at no height, so the rows existed and drew nothing. */}
          <FileTreePane
            key={`${tree.density}|${tree.flatten}|${tree.folders}|${tree.search}|${tree.sticky}`}
            files={files}
            selected={
              chosen === undefined ? Option.none() : Option.some(chosen)
            }
            onSelect={onSelect}
            seen={progress}
            choices={tree}
            keys={keys}
          />
        </div>
        {/* One heading above the stack rather than one per drawing: which file
            is open is a fact about this subcard, and it was already pinned to
            the top of the scroll while the code moved under it. */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-canvas">
          {file === undefined ? null : (
            <FileHeading file={file} icons={tree.icons} />
          )}
          {/* The drawings sit on top of one another, all of them laid out and
              only one of them visible. Laid out matters: a diff built inside a
              hidden box has no width to measure and draws nothing, so the ones
              waiting their turn are merely invisible — and, incidentally, keep
              their own scroll, so going back to a file returns to the part of
              it that was being read. */}
          <div className="relative min-h-0 flex-1">
            {showing.map((one) => {
              const open = one.path === file?.path;
              return (
                <div
                  key={one.path}
                  data-file={one.path}
                  aria-hidden={open ? "false" : "true"}
                  className="absolute inset-0 overflow-auto"
                  style={
                    open
                      ? undefined
                      : { visibility: "hidden", pointerEvents: "none" }
                  }
                >
                  <FileDiffPane
                    file={one}
                    ask={library.ask}
                    reading={
                      open ? reading : proseAsDocument && isProse(one.path)
                    }
                    choices={diff}
                    drafts={open ? mine : draftsIn(drafts, one.path)}
                    onSaveDraft={onSaveDraft}
                    onDropDraft={onDropDraft}
                    threads={threads}
                    answering={answering}
                    viewer={viewer}
                    onPost={
                      onPost === undefined
                        ? undefined
                        : (note) => onPost({ path: one.path, ...note })
                    }
                    suggest={suggest}
                    onUpload={onUpload}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
