export type Shot = {
  readonly name: string
  readonly caption: string
  readonly width: number
  readonly height: number
}

export const SHOTS: ReadonlyArray<Shot> = [
  {
    "name": "working-set",
    "caption": "Every pull request you are in, filed by whose move it is rather than by which repository it came from",
    "width": 1280,
    "height": 800
  },
  {
    "name": "pull-request",
    "caption": "One pull request with what is owed on it at the top, so a reviewer reads a list instead of assembling one",
    "width": 1280,
    "height": 800
  },
  {
    "name": "commit",
    "caption": "One commit read the way a pull request is read, with the tree beside the code and the next file a key away",
    "width": 1280,
    "height": 800
  },
  {
    "name": "repo-pulls",
    "caption": "One repository's pull requests, filed by whose move it is, with a seven-deep stack folded into one row",
    "width": 1280,
    "height": 800
  },
  {
    "name": "issue",
    "caption": "One issue in the order anybody asks in: what it is, what was written, and what everybody said about it",
    "width": 1280,
    "height": 800
  },
  {
    "name": "issues",
    "caption": "Every issue you were given, from every repository, on one page instead of three tabs of somebody else's dashboard",
    "width": 1280,
    "height": 800
  },
  {
    "name": "repo-issues",
    "caption": "One repository's issues with the filter above them, on a repository that has three thousand of them",
    "width": 1280,
    "height": 800
  },
  {
    "name": "commits",
    "caption": "A branch's history on one line per commit, with the size of each change beside the sentence somebody wrote",
    "width": 1280,
    "height": 800
  },
  {
    "name": "repo-home",
    "caption": "A repository's README and its whole file tree on one screen, so neither reader has to scroll past the other one's page",
    "width": 1280,
    "height": 800
  },
  {
    "name": "run",
    "caption": "A failed run opening on the assertion that broke it, with the eleven green jobs counted instead of drawn",
    "width": 1280,
    "height": 800
  },
  {
    "name": "actions",
    "caption": "A repository's runs folded into the work they belong to, so an afternoon of CI reads as the handful of changes it is about",
    "width": 1280,
    "height": 800
  },
  {
    "name": "raise",
    "caption": "Raising an issue in two boxes rather than eight controls, none of which can be filled in until the issue exists",
    "width": 1280,
    "height": 800
  }
]
