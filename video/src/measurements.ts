/**
 * What this video is allowed to claim.
 *
 * Medians of four pull requests taken from the second page of `microsoft/vscode`'s
 * list, signed in, so neither side is answering from something the profile fetched
 * earlier in the run. Reproduce with:
 *
 *     ego-browser nodejs < scripts/benchmark-diff-flow.js
 *
 * Measured from the press on the row, which is how a pull request is opened. Both
 * sides were hovered for 1.5s before the press, and that dwell is the whole reason
 * these numbers differ as much as they do: ours reads the pull request ahead once
 * the pointer has spent enough time in and around the row, and GitHub does not.
 * Checked directly — two seconds of dwell on their list fires exactly one request,
 * `/hovercard`, which is the tooltip and has nothing to do with the page about to
 * be opened.
 *
 * 1.5s is far past the point ours reads at, so the figures below are what a reader
 * who has clearly settled on a row gets. See `src/ui/lingering.ts` for how much
 * less than that is actually needed.
 *
 * So the gap is a feature difference rather than a warm cache, and the video has to
 * say so; a viewer who assumes both sides were prefetched is being misled by
 * omission.
 *
 * Not yet measured: the same flow clicked cold, with no dwell at all. Until that
 * exists, nothing here may be described as the time to open a pull request in
 * general — only as the time when a reader rests on the row first.
 */
export const MEASURED = {
  github: {
    /** Their page is up. The conversation, not the diff. */
    page: 2010,
    /** "Files changed" pressed the instant it is pressable, which is faster than a person. */
    secondPress: 2085,
    /** First diff line painted. */
    diff: 4603,
  },
  ours: {
    /** GitHub's own page is hidden from here on, so none of it is ever painted. */
    gate: 63,
    /** The diff is readable, on the page the press opened. */
    diff: 1336,
  },
} as const;
