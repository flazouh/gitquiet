export type Focus = {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type Feature = {
  readonly title: string

  readonly description: string
  readonly focus: Focus
  /**
   * What a phone shows instead, where the narrow crop would argue with the title.
   *
   * A phone is given a taller, narrower part of the same screen so the words stay
   * their own size. A screen whose whole point is two panes at once loses that point
   * when only the left pane is left, so those name a wide part here and are scaled
   * down rather than cut.
   */
  readonly tight?: Focus
}

const WINDOW = { x: 0, y: 0, width: 660, height: 460 } as const

/** Both panes, kept whole for a phone and shrunk to fit it. */
const PANES = { x: 0, y: 0, width: 660, height: 470 } as const

export const FEATURES: Readonly<Record<string, Feature>> = {
  "working-set": {
    title: "The first group is what needs you",
    description: "Every pull request you are in, from every repository, in one list.",
    focus: WINDOW
  },

  "pull-request": {
    title: "Everything still unresolved, above the diff",
    description:
      "Review threads, failing checks, bot comments and the commits pushed since you last looked.",
    focus: WINDOW
  },

  commit: {
    title: "A commit, read like a pull request",
    description: "The file tree beside the code, and the next file one key away.",
    focus: WINDOW,
    tight: PANES
  },

  "repo-pulls": {
    title: "One repository, grouped the same way",
    description: "Seven pull requests that build on each other show as one row.",
    focus: WINDOW
  },

  issue: {
    title: "An issue in the order you read it",
    description: "What it is, then what was written, then what everybody said about it.",
    focus: WINDOW,

    /* The claim is an order, read downwards, so a phone is given all three parts
       rather than the top of the first one. */
    tight: { x: 0, y: 60, width: 430, height: 1000 }
  },

  issues: {
    title: "Every issue you were given",
    description: "From every repository, on one page rather than three tabs of a dashboard.",
    focus: WINDOW,

    /* The repository stands at 743, so a crop from the left edge proves nothing
       about every repository. This one starts at the titles' end. */
    tight: { x: 480, y: 120, width: 430, height: 470 }
  },

  "repo-issues": {
    title: "Three thousand issues, filtered",
    description: "The filter sits above the list, on a repository with three thousand of them.",
    focus: WINDOW
  },

  commits: {
    title: "History, one line per commit",
    description: "Each commit shows its message and the size of its change on one line.",

    /*
     * A phone keeps the left of this one, with no crop of its own.
     *
     * The size stands at 796 and the message truncates near 420, so every crop that
     * reaches the numbers opens with a blank half, and one that holds both reads at
     * 38 per cent, where the letters go to grey. The messages are worth more.
     */
    focus: WINDOW
  },

  "repo-home": {
    title: "The README and the file tree at once",
    description: "Both on one screen, so neither one buries the other.",

    /* The README runs to 887 and the tree stands to its right, so a crop from the
       left edge shows one pane and calls it two. This one straddles the seam.
       A phone gets the same seam read downwards, where the screen puts it. */
    focus: { x: 580, y: 0, width: 660, height: 460 },
    tight: { x: 0, y: 300, width: 430, height: 900 }
  },

  run: {
    title: "Opens on the line that broke",
    description: "The failing assertion, instead of a log to scroll. The eleven passing jobs show as a count.",
    focus: WINDOW
  },

  actions: {
    title: "Runs grouped by the work they belong to",
    description:
      "One page of oven-sh/bun showed twenty-five runs for two branches. This lists the two.",
    focus: WINDOW
  },

  raise: {
    title: "Two fields, not eight",
    description: "A title and a body. Labels and assignees wait until the issue exists.",
    focus: WINDOW
  }
}
