/**
 * What this video is allowed to claim.
 *
 * Re-measured 2026-08-16, after the two benchmarks were found to be reporting
 * nothing at all. Every cell of `benchmark-click-flow.js` had been reading `—`,
 * on both sides, because it uninstalled one hard-coded extension id while the
 * profile carried two copies of the interface. The baseline therefore ran with
 * the interface still drawing GitHub's page, and the numbers that used to sit in
 * this file could not be reproduced from the script that claimed to produce them.
 *
 * Reproduce, with every copy of the extension disabled in `chrome://extensions`
 * first, because a store-installed copy does not come out over the protocol:
 *
 *     ego-browser nodejs < scripts/benchmark-click-flow.js
 *     ego-browser nodejs < scripts/benchmark-diff-flow.js
 *
 * Both scripts now refuse to run rather than report a baseline the interface is
 * still drawing.
 *
 * Measured from the press on the row, which is how a pull request is opened. Both
 * sides were hovered for 1.5s before the press, and that dwell is the whole reason
 * these numbers differ as much as they do: ours reads the pull request ahead once
 * the pointer has spent enough time in and around the row, and GitHub does not.
 * Checked directly, two seconds of dwell on their list fires exactly one request,
 * `/hovercard`, which is the tooltip and has nothing to do with the page about to
 * be opened.
 *
 * 1.5s is far past the point ours reads at, so the figures below are what a reader
 * who has clearly settled on a row gets. See `src/ui/lingering.ts` for how much
 * less than that is actually needed.
 *
 * Two flows, because they answer different questions and are not interchangeable.
 */

/**
 * Pressing a row on the list, to a readable pull request.
 *
 * Medians of four pull requests per column, `microsoft/vscode`, signed in. Warm
 * and cold press *different* pull requests: pressing the same one twice reads it
 * out of the interface's own cache the second time, and the cold column comes
 * back at warm speed having measured nothing. Two runs disagreed by a factor of
 * twenty-five before that was fixed.
 *
 * Warm is a reader who rests on the row for 1.5s, which is past the 150ms the
 * prefetch waits for. Cold is a reader who presses the moment the pointer
 * arrives. GitHub is flat across the two because they do not read ahead on dwell
 * at all: two seconds of rest on their list fires one request, `/hovercard`,
 * which is the tooltip.
 *
 * Neither column may be quoted without saying which one it is.
 */
export const PRESS = {
  /** Rested on the row first. Ours 55, 65, 67, 91. Theirs 1844, 2119, 2132, 2140. */
  warm: {
    github: 2132,
    ours: 67,
  },
  /** Pressed at once, so nothing was read ahead. Ours 1528, 1584, 1635, 1832. */
  cold: {
    github: 2138,
    ours: 1635,
  },
} as const

/**
 * Opening the pull request by URL, to a diff on the screen.
 *
 * Medians of seven, `microsoft/vscode`. Both halves open the URL cold, so the
 * prefetch never fires and this is the conservative comparison. Theirs takes two
 * presses to reach a diff, ours one. Every run of the fourteen reached what it
 * was waiting for.
 *
 * `secondPress` is the one number here that was not re-measured. It positions the
 * "Files changed" press in the video and nothing is claimed about it.
 */
export const MEASURED = {
  github: {
    /** Their page is up. The conversation, not the diff. */
    page: 1276,
    /** "Files changed" pressed the instant it is pressable, which is faster than a person. Not re-measured. */
    secondPress: 2085,
    /** First diff line painted. 2443, 2889, 3652, 3999, 4573, 4610, 4826. */
    diff: 3999,
  },
  ours: {
    /** The diff is readable, on the page the press opened. 2093, 2295, 2545, 2922, 3240, 3273, 3381. */
    diff: 2922,
  },
} as const

/**
 * The sentence the numbers support, and the one they do not.
 *
 * Supported: rest on a row and the pull request opens in about 70ms, against
 * about two seconds on GitHub. Also supported, and weaker: press without resting
 * and it is about half a second quicker than theirs, not thirty times.
 *
 * Not supported: any sentence about the time to open a pull request that does not
 * say whether the reader rested on the row. The whole gap is the prefetch.
 */
export const CLAIM = {
  warmMultiple: Math.round(PRESS.warm.github / PRESS.warm.ours),
  coldSaving: PRESS.cold.github - PRESS.cold.ours,
} as const
