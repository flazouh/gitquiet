import { Option } from "effect"
import type { CommitList, History, Landed, Mark, Stat } from "@/domain/commitList"
import { proposalIn } from "@/domain/commitList"
import type { Participant } from "@/domain/PullRequest"
import type { CheckRollup } from "@/domain/workingSet"
import { HistoryScreen } from "@/ui/HistoryScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf } from "./faces"
import { hoursAgo } from "./when"

/**
 * A branch's commits, which is the page GitHub serves at `/owner/repo/commits/main`.
 *
 * The case this picture makes is the width of a row. Their own list spends two lines
 * on each commit and most of the second one on logins, and it leaves out the one fact
 * that separates a typo from a rewrite: how much of the repository the commit moved.
 * So the row here is one line, it carries the size, and it fits twice as many commits
 * on a screen.
 *
 * `microsoft/vscode` because it is a repository with real traffic on its default
 * branch: machines committing beside people, squashed pull requests beside commits
 * pushed straight to the branch, and a day's worth of work that fills the frame
 * without anything being invented to pad it. Nothing here is anybody's private
 * repository.
 */

const REPOSITORY = { owner: "microsoft", repo: "vscode" } as const

const LIST: CommitList = {
  repo: REPOSITORY,
  branch: Option.some("main"),
  search: ""
}

const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: faceOf(login)
})

const machine = (login: string): Participant => ({
  login,
  isAutomated: true,
  faceUrl: faceOf(login)
})

/**
 * The marks and the sizes are put on the rows here rather than read for.
 *
 * On a live page both arrive behind the list: the checks and the signature come from
 * GitHub's second request, and each size is a request of its own. A capture has no
 * second moment, so a photograph of the page mid-fill would be a photograph of a page
 * with three empty columns, and every column this screen adds to theirs would be
 * missing from the one picture of it.
 */
type Rollup = { readonly state: CheckRollup["state"]; readonly said: string }

const mark = (checks: Rollup, verified = true, comments = 0): Option.Option<Mark> =>
  Option.some({ checks: Option.some(checks), verified, comments })

/** GitHub's own summary carried verbatim, which is what the row's label reads out. */
const green = (said: string): Rollup => ({ state: "passing", said })
const red = (said: string): Rollup => ({ state: "failing", said })
const turning = (said: string): Rollup => ({ state: "running", said })

const size = (files: number, added: number, removed: number): Option.Option<Stat> =>
  Option.some({ files, added, removed })

type Row = {
  readonly sha: string
  readonly headline: string
  readonly authors: ReadonlyArray<Participant>
  /** Somebody other than the author, which on this branch is a rebase or a patch. */
  readonly committer?: Participant
  readonly body?: string
  readonly mark: Option.Option<Mark>
  readonly stat: Option.Option<Stat>
  /** Hours before the capture. Fixed, so two captures are the same picture. */
  readonly hours: number
}

const landed = (row: Row): Landed => ({
  sha: row.sha,
  abbreviatedSha: row.sha.slice(0, 7),
  headline: row.headline,
  bodyHtml: row.body === undefined ? Option.none() : Option.some(`<p>${row.body}</p>`),
  authors: row.authors,
  committer: Option.fromNullishOr(row.committer),
  // Read out of the message rather than written down, exactly as the row reads it:
  // a number typed in beside a headline that did not carry one is the one thing on
  // this page that could disagree with itself.
  pullRequest: proposalIn(row.headline),
  createdAt: hoursAgo(row.hours),
  mark: row.mark,
  stat: row.stat
})

const TODAY: ReadonlyArray<Row> = [
  {
    sha: "4b91f0c7d2a85e6413cf9b02d7e5a18c36049fbe",
    headline: "Debounce the explorer's file watcher on very large workspaces (#327442)",
    authors: [person("kbranch")],
    body: "Recursive watching on a monorepo of 40k files spent the first eight seconds of every window on change events nobody had asked for.",
    mark: mark(turning("18 / 24 checks running")),
    stat: size(9, 274, 91),
    hours: 1
  },
  {
    sha: "e2c58a41b93d7f60cc1584e9a207db3f65081cd2",
    headline: "engineering: bump distro to 8f21c04",
    authors: [machine("distro-bot")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(1, 2, 2),
    hours: 2
  },
  {
    sha: "7a3f1de904c8b25f61e07da3b849c50f2d63be18",
    headline: "Restore the terminal's scrollback when a profile is reloaded (#327301)",
    authors: [person("t-okafor"), machine("ci-runner[bot]")],
    mark: mark(green("24 / 24 checks OK"), true, 3),
    stat: size(6, 188, 42),
    hours: 4
  },
  {
    sha: "c0198bd7e46a2f8351db90c7f2e6a4b1580937ca",
    headline: "Fix quick pick keeping focus after the widget is disposed (#327288)",
    authors: [person("c-deleon")],
    mark: mark(red("22 / 24 checks OK")),
    stat: size(3, 41, 17),
    hours: 6
  },
  {
    sha: "9d47ea20c1358bf6047a92db8e1c05f7346b8210",
    headline: "Move the notebook find widget behind a contribution point",
    authors: [person("r-bloom")],
    committer: person("mbirkner"),
    body: "Applied on rebornix's behalf so the release branch can take it without the rest of the notebook work.",
    mark: mark(green("24 / 24 checks OK")),
    stat: size(14, 512, 338),
    hours: 8
  },
  {
    sha: "1f8ba60d295e74c3a0b16fd8e5307c94b2ad6e5f",
    headline: "chore: update grammars for TypeScript 6.0",
    authors: [machine("distro-bot")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(4, 1204, 1187),
    hours: 9
  },
  {
    sha: "5c72b48e0a91df36b7250ce4831f0a6d97148bb3",
    headline: "Do not restore an editor group whose workspace folder is gone (#327190)",
    authors: [person("kbranch")],
    mark: mark(green("24 / 24 checks OK"), true, 1),
    stat: size(5, 96, 34),
    hours: 11
  }
]

const YESTERDAY: ReadonlyArray<Row> = [
  {
    sha: "a61c3f0d8b57e924cf1d0a736b5e82940c7fd1b6",
    headline: "Merge pull request #327104 from microsoft/tyriar/shell-integration-vi",
    authors: [person("t-okafor")],
    committer: machine("web-flow"),
    mark: mark(green("24 / 24 checks OK")),
    stat: size(11, 403, 76),
    hours: 27
  },
  {
    sha: "b83d40f217ce6a95801bdf3e07a4c261598ba7d0",
    headline: "Report the language server's own memory in the process explorer (#327088)",
    authors: [person("e-haugen")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(7, 231, 58),
    hours: 29
  },
  {
    sha: "3e0f7c91da248b56037e1cb9a4f0d2586b17ce49",
    headline: "Fix settings search dropping the last word of a multi-word query (#327041)",
    authors: [person("nvasquez")],
    body: "The tokenizer treated a trailing space as the end of input, so `font size ` matched nothing.",
    mark: mark(green("24 / 24 checks OK"), true, 2),
    stat: size(2, 63, 21),
    hours: 31
  },
  {
    sha: "f47a20be6c1d5398407bfa2e19c0d63b8a5417ef",
    headline: "engineering: pin the macOS runner to sonoma",
    authors: [person("i-novak")],
    mark: mark(red("21 / 24 checks OK")),
    stat: size(3, 18, 9),
    hours: 34
  },
  {
    sha: "6ba05e19c837f24d1096be0a7d3f5c841b29e0da",
    headline: "Draw the diff editor's inline decorations from the same model (#326914)",
    authors: [person("pvandal")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(22, 887, 641),
    hours: 37
  },
  {
    sha: "2f9e15c07a63bd48e0187ca5d3f9b26074cd8a1b",
    headline: "chore: update vscode-ripgrep to 1.15.11",
    authors: [machine("deps-bot")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(1, 4, 4),
    hours: 40
  }
]

const BEFORE: ReadonlyArray<Row> = [
  {
    sha: "8c14be05a7d3f0619ba28cd4e7503fb1962ad84c",
    headline: "Keep the extension host alive across a reload of a single extension",
    authors: [person("h-baumann")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(18, 641, 402),
    hours: 51
  },
  {
    sha: "0d5a7f38c19be6420a8dc1f507b3e964821cd7fa",
    headline: "Fix the walkthrough not marking a step done on a keyboard press (#326740)",
    authors: [person("f-lepage")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(4, 72, 26),
    hours: 55
  },
  {
    sha: "cb2e94017df6a35801e2bc4f9d0a7361584be2c9",
    headline: "Stop the search view re-sorting while results are still arriving (#326688)",
    authors: [person("nvasquez"), machine("ci-runner[bot]")],
    mark: mark(green("24 / 24 checks OK"), true, 4),
    stat: size(8, 214, 97),
    hours: 58
  },
  {
    sha: "7e6041cb28da95f307b1de4a0c8f52691bd34a07",
    headline: "engineering: bump distro to 4a70dc1",
    authors: [machine("distro-bot")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(1, 2, 2),
    hours: 61
  },
  {
    sha: "d938ac710e5b264f0a17cd8b3e60912756fabc47",
    headline: "Give the comment thread widget its own scroll (#326612)",
    authors: [person("g-takacs")],
    mark: mark(green("24 / 24 checks OK")),
    stat: size(6, 148, 71),
    hours: 64
  }
]

/**
 * The day headings, worked out from the same clock the rows are.
 *
 * GitHub writes these itself, in the reader's own time zone, and the domain keeps
 * them verbatim for that reason. There is no GitHub here to write them, and a date
 * typed in by hand would be right on the day this was written and a fortnight stale
 * by the time somebody reads the store listing. So the heading is formatted from the
 * first commit under it, which is what their server does with the same instant.
 */
const dayOf = (when: string): string =>
  new Date(when).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })

const dayFrom = (rows: ReadonlyArray<Row>) => ({
  title: dayOf(hoursAgo(rows[0]?.hours ?? 0)),
  commits: rows.map(landed)
})

export const HISTORY: History = {
  branch: "main",
  days: [dayFrom(TODAY), dayFrom(YESTERDAY), dayFrom(BEFORE)],
  /*
   * Older only. Their paging is a cursor rather than a page number, and the first
   * page of a branch has nothing newer than itself to go back to, so a picture with
   * both controls on it would be a picture of a page nobody arrives at first.
   */
  older: Option.some(`${TODAY[0]?.sha ?? ""} 35`),
  newer: Option.none(),
  rest: Option.none()
}

/**
 * Every branch of the repository, and everybody who has committed to it.
 *
 * Both are read only once the control they fill is opened, so neither is on the
 * screen in the capture. They are wired anyway, because a picker drawn without a
 * loader behind it is a control the reader would press for nothing, and somebody
 * opening the stage by hand is a reader.
 */
const BRANCHES = [
  "main",
  "release/1.108",
  "release/1.107",
  "kbranch/watcher-debounce",
  "t-okafor/shell-integration-vi",
  "pvandal/diff-inline-decorations",
  "distro"
]

const AUTHORS = [
  person("kbranch"),
  person("t-okafor"),
  person("c-deleon"),
  person("h-baumann"),
  person("e-haugen"),
  person("nvasquez"),
  person("pvandal"),
  machine("distro-bot")
]

export const COMMITS_VIEW: View = {
  name: "commits",
  caption:
    "A branch's history on one line per commit, with the size of each change beside the sentence somebody wrote",
  ...STORE,
  draw: () => (
    <HistoryScreen
      list={LIST}
      load={settled(HISTORY)}
      preload={alreadyKnown(HISTORY)}
      recallRepositories={nothingRemembered()}
      branches={settled(BRANCHES)}
      authors={settled(AUTHORS)}
      onGo={() => {}}
      onStepAside={() => {}}
      signedIn={() => true}
    />
  )
}
