export type Pain = {
  readonly said: string

  readonly at: string

  readonly weight: string

  readonly answer: string
}

export const PAINS: ReadonlyArray<Pain> = [
  {
    said: "you have to move between the 'Files changed' and 'Conversation' tabs",
    at: "https://github.com/refined-github/refined-github/issues/7255",
    weight: "reported again in 2024",
    answer: "No tabs. One screen."
  },
  {
    said: "the review comment that was associated with the line that has been modified is not shown",
    at: "https://github.com/orgs/community/discussions/23138",
    weight: "203 upvotes, 71 comments",
    answer: "Your comment stays visible, on the version of the code you wrote it about."
  },
  {
    said: "it gets very tedious marking all files as not-viewed",
    at: "https://github.com/refined-github/refined-github/issues/2444",
    weight: "26 reactions, 32 comments",
    answer: "Every file is marked read, read before the last push, or changed since you read it."
  },
  {
    said: "Many users want to by default always 'Hide whitespace changes'",
    at: "https://github.com/orgs/community/discussions/5486",
    weight: "443 upvotes, 24 comments",
    answer: "You set it once and it stays set."
  }
]

export const RECEIPT = {
  coldOurs: "3.9",
  coldTheirs: "4.8",

  warmOurs: "72ms",
  what: "to open a pull request and reach a line of the diff",
  why: "One press here, two on github.com, where the diff sits behind a second page.",
  how: "Median of seven pull requests on microsoft/vscode, signed in, each opened cold."
} as const
