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
}

const WINDOW = { x: 0, y: 0, width: 660, height: 460 } as const

export const FEATURES: Readonly<Record<string, Feature>> = {
  "working-set": {
    title: "Sorted by whose move it is",
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
    focus: WINDOW
  },

  "repo-pulls": {
    title: "One repository, grouped the same way",
    description: "Seven pull requests that build on each other show as one row.",
    focus: WINDOW
  },

  issue: {
    title: "An issue in the order you read it",
    description: "What it is, then what was written, then what everybody said about it.",
    focus: WINDOW
  },

  issues: {
    title: "Every issue you were given",
    description: "From every repository, on one page rather than three tabs of a dashboard.",
    focus: WINDOW
  },

  "repo-issues": {
    title: "Three thousand issues, filtered",
    description: "The filter sits above the list, on a repository with three thousand of them.",
    focus: WINDOW
  },

  commits: {
    title: "History, one line per commit",
    description: "Each commit shows its message and the size of its change on one line.",
    focus: WINDOW
  },

  "repo-home": {
    title: "The README and the file tree at once",
    description: "Both on one screen, so neither one buries the other.",
    focus: WINDOW
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
