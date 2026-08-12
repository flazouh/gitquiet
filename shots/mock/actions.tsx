import type { CheckState } from "@/domain/PullRequest"
import type { RepoRef } from "@/domain/PullRequestRef"
import { type Listed, type Ref, type Strand, strandsIn } from "@/domain/strand"
import { StrandsScreen } from "@/ui/StrandsScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { minutesAgo } from "./when"

/**
 * A repository's Actions tab, with the runs folded into the work they belong to.
 *
 * The argument this picture has to make is the fold. GitHub's own list gives one row
 * per run, so a busy afternoon is twenty-five rows describing ten pull requests and a
 * reader hunting the red one reads the same commit title three times on the way past
 * it. Here the pull request is the row and the runs are chips on it, which is only
 * visible in a photograph if the data really has several runs per piece of work.
 *
 * So the rows carry all four shapes the fold has to survive: several workflows on one
 * head, a re-run that answered for the attempt before it, runs against a commit the
 * work has moved past, and a workflow that ran on `refs/pull/<n>/head` and therefore
 * names no branch at all. Every one of those came off a live reading of
 * `oven-sh/bun/actions`, which is also the repository here.
 *
 * The first row is the run the Run view photographs, against the pull request the
 * Pull Request view photographs. One piece of work seen from three sides reads as a
 * product; three unrelated inventions read as three mockups. Nothing here is
 * anybody's private repository.
 */

const REPO: RepoRef = { owner: "oven-sh", repo: "bun" }

/** One workflow's result against one commit, before it is given a time and an id. */
type Ran = {
  readonly workflow: string
  readonly state: CheckState
  readonly seconds: number
  /**
   * Whether this workflow ran against the pull ref rather than against the branch.
   *
   * True for the ones a repository gives `pull_request_target`, which is where the
   * second spelling of a ref comes from and the reason a Strand cannot be keyed on
   * the ref alone: one piece of work is on two of them at once.
   */
  readonly onPullRef?: boolean
}

type Work = {
  readonly pull: number | null
  /** Nothing where every run of this work named a pull ref and none named a branch. */
  readonly branch: string | null
  /** The newest commit's title, which is what the row is about. */
  readonly head: string
  readonly actor: string
  readonly trigger: string
  /** Minutes before the capture. Fixed, so two captures are the same picture. */
  readonly minutes: number
  readonly latest: ReadonlyArray<Ran>
  /** Attempts a re-run of the same workflow has already answered for. */
  readonly superseded?: ReadonlyArray<Ran>
  /** A commit this work has moved past, and what ran against it. */
  readonly earlier?: { readonly head: string; readonly runs: ReadonlyArray<Ran> }
}

/**
 * Eleven pieces of work, which is what the frame holds.
 *
 * Counted rather than guessed: a row is sixty-six pixels, and eleven of them carry the
 * list to the bottom edge of the picture with the twelfth genuinely below the fold.
 * Six rows over three hundred pixels of nothing would be a photograph of a repository
 * where nothing happens, which is the opposite of what this screen is for.
 */
const WORK: ReadonlyArray<Work> = [
  {
    pull: 23014,
    branch: "serve-abort-mid-chunk",
    head: "Decode streamed chunks with one decoder",
    actor: "jhalvorsen",
    trigger: "synchronize",
    minutes: 22,
    latest: [
      { workflow: "CI", state: "failed", seconds: 1338 },
      { workflow: "CodeQL", state: "running", seconds: 402, onPullRef: true },
      { workflow: "Comment Cop", state: "succeeded", seconds: 31 }
    ],
    superseded: [{ workflow: "CI", state: "cancelled", seconds: 96 }],
    earlier: {
      head: "Do not treat an empty send queue as an ended socket",
      runs: [
        { workflow: "CI", state: "succeeded", seconds: 1290 },
        { workflow: "CodeQL", state: "succeeded", seconds: 388, onPullRef: true }
      ]
    }
  },
  {
    pull: null,
    branch: "main",
    head: "Release 1.3.15",
    actor: "jhalvorsen",
    trigger: "push",
    minutes: 41,
    latest: [
      { workflow: "CI", state: "succeeded", seconds: 1502 },
      { workflow: "Release", state: "running", seconds: 918 },
      { workflow: "Publish canary", state: "succeeded", seconds: 264 }
    ]
  },
  {
    pull: 22996,
    branch: "zlib-brotli-windows",
    head: "Implement node:zlib brotli streams on Windows",
    actor: "mvenn",
    trigger: "synchronize",
    minutes: 58,
    latest: [
      { workflow: "CI", state: "running", seconds: 611 },
      { workflow: "Comment Cop", state: "succeeded", seconds: 28 }
    ],
    earlier: {
      head: "Wire brotli into the Windows build",
      runs: [{ workflow: "CI", state: "failed", seconds: 1104 }]
    }
  },
  {
    pull: 22990,
    branch: "dependabot/npm_and_yarn/vite-7.1.14",
    head: "Bump vite from 7.1.9 to 7.1.14 in /packages/bun-inspector-frontend",
    actor: "deps-bot",
    trigger: "synchronize",
    minutes: 76,
    latest: [
      { workflow: "CI", state: "succeeded", seconds: 1188 },
      { workflow: "CodeQL", state: "succeeded", seconds: 372, onPullRef: true }
    ]
  },
  {
    pull: 22971,
    branch: "file-stream-allocations",
    head: "Reduce Bun.file().stream() allocations on large reads",
    actor: "t-okafor",
    trigger: "synchronize",
    minutes: 94,
    latest: [
      { workflow: "CI", state: "succeeded", seconds: 1421 },
      { workflow: "Bundle size", state: "succeeded", seconds: 71 },
      { workflow: "Comment Cop", state: "succeeded", seconds: 33 }
    ]
  },
  /*
   * The one piece of work with no branch on it at all, kept where the frame can hold
   * it. Its only workflow runs on `refs/pull/22830/head`, so the row has a pull ref to
   * print and nothing else, which is the shape `Strands` draws `pull/<n>` for. Below
   * the fold it would be a case the data covers and the picture never shows.
   */
  {
    pull: 22830,
    branch: null,
    head: "Run the Comment Cop against forks as well",
    actor: "kbranch",
    trigger: "pull_request_target",
    minutes: 105,
    latest: [{ workflow: "Comment Cop", state: "succeeded", seconds: 34, onPullRef: true }]
  },
  {
    pull: 22958,
    branch: "finalization-registry-throw",
    head: "Fix a crash when a FinalizationRegistry callback throws",
    actor: "dperrault",
    trigger: "synchronize",
    minutes: 118,
    latest: [
      { workflow: "CI", state: "failed", seconds: 764 },
      { workflow: "Comment Cop", state: "succeeded", seconds: 26 }
    ],
    superseded: [
      { workflow: "CI", state: "failed", seconds: 812 },
      { workflow: "CI", state: "cancelled", seconds: 143 }
    ]
  },
  {
    pull: 22941,
    branch: "import-attributes-cjs",
    head: "Support import attributes in the CommonJS output",
    actor: "linnea-h",
    trigger: "synchronize",
    minutes: 143,
    latest: [
      { workflow: "CI", state: "succeeded", seconds: 1355 },
      { workflow: "CodeQL", state: "succeeded", seconds: 401, onPullRef: true },
      { workflow: "Comment Cop", state: "succeeded", seconds: 29 }
    ]
  },
  {
    pull: null,
    branch: "jhalvorsen/webkit-2b1c4f0",
    head: "Update WebKit to 2b1c4f0",
    actor: "jhalvorsen",
    trigger: "push",
    minutes: 167,
    latest: [
      { workflow: "CI", state: "running", seconds: 2214 },
      { workflow: "Build WebKit", state: "succeeded", seconds: 4902 }
    ]
  },
  {
    pull: 22902,
    branch: "install-peer-ranges",
    head: "bun install: keep peer dependency ranges when hoisting",
    actor: "jstahl",
    trigger: "synchronize",
    minutes: 191,
    latest: [
      { workflow: "CI", state: "succeeded", seconds: 1266 },
      { workflow: "Comment Cop", state: "succeeded", seconds: 24 }
    ],
    earlier: {
      head: "bun install: hoist peers to the closest satisfying parent",
      runs: [
        { workflow: "CI", state: "failed", seconds: 998 },
        { workflow: "Comment Cop", state: "succeeded", seconds: 22 }
      ]
    }
  },
  {
    pull: 22851,
    branch: "windows-resolve-sync",
    head: "Fix Windows path normalisation in Bun.resolveSync",
    actor: "s-almeida",
    trigger: "synchronize",
    minutes: 262,
    latest: [
      { workflow: "CI", state: "failed", seconds: 881 },
      { workflow: "CodeQL", state: "succeeded", seconds: 366, onPullRef: true },
      { workflow: "Comment Cop", state: "succeeded", seconds: 27 }
    ]
  }
]

/**
 * Which ref one run named, in the spelling the list writes it in.
 *
 * A run that named neither is not invented here. Their `Comment Cop` rows carry a
 * pull ref and their branch rows carry a branch, and a row with nothing on it is a
 * shape the parser allows rather than one their page produces.
 */
const refFor = (work: Work, ran: Ran): Ref | null => {
  if (ran.onPullRef === true && work.pull !== null) return { kind: "pull", number: `${work.pull}` }
  return work.branch === null ? null : { kind: "branch", name: work.branch }
}

/**
 * The file each of these workflows is, in the two spellings their sidebar really uses.
 *
 * Code scanning is GitHub's own and is listed under a folder rather than as a file, which is
 * the only place a folder appears on that page. Everything else is a file somebody committed.
 */
const fileFor = (workflow: string): string =>
  workflow === "CodeQL"
    ? "github-code-scanning/codeql"
    : `${workflow.toLowerCase().replaceAll(" ", "-")}.yml`

const one = (work: Work, ran: Ran, title: string, minutes: number, ticket: number): Listed => {
  const run = `${18_700_000_000 + ticket}`
  return {
    run,
    url: `https://github.com/${REPO.owner}/${REPO.repo}/actions/runs/${run}`,
    workflow: ran.workflow,
    file: fileFor(ran.workflow),
    number: `${9_400 + ticket}`,
    title,
    state: ran.state,
    seconds: ran.seconds,
    startedAt: minutesAgo(minutes),
    actor: work.actor,
    trigger: work.trigger,
    ref: refFor(work, ran),
    pullRequest: work.pull === null ? null : `${work.pull}`
  }
}

/**
 * One piece of work as the several runs their page really lists for it.
 *
 * The minute offsets are what the fold reads: a superseded attempt has to be older
 * than the re-run that answered it, and a run against an earlier commit older than
 * both, or `strandsIn` would take the wrong commit for the head and count the rest
 * against it. Forty and three hundred minutes are far enough apart that no two
 * pieces of one row can be read in the wrong order.
 */
const runsIn = (work: Work, at: number): ReadonlyArray<Listed> => {
  const ticket = (slot: number) => at * 100 + slot
  const before = work.earlier ?? { head: "", runs: [] }

  return [
    ...work.latest.map((ran, which) =>
      one(work, ran, work.head, work.minutes + which, ticket(which))
    ),
    ...(work.superseded ?? []).map((ran, which) =>
      one(work, ran, work.head, work.minutes + 40 + which, ticket(20 + which))
    ),
    ...before.runs.map((ran, which) =>
      one(work, ran, before.head, work.minutes + 300 + which, ticket(40 + which))
    )
  ]
}

/**
 * The runs as their page hands them over, and the fold applied by the real code.
 *
 * Written this way round rather than as a list of finished Strands, because the
 * grouping is the product. A hand-written `Strand` would photograph a picture of
 * what `strandsIn` is meant to do instead of a picture of it doing it, and the
 * counts on the rows would be whatever was typed rather than whatever is true.
 */
const RUNS: ReadonlyArray<Listed> = WORK.flatMap(runsIn)

export const STRANDS: ReadonlyArray<Strand> = strandsIn(RUNS)

export const ACTIONS_VIEW: View = {
  name: "actions",
  caption:
    "A repository's runs folded into the work they belong to, so an afternoon of CI reads as the handful of changes it is about",
  ...STORE,
  draw: () => (
    <StrandsScreen
      repo={REPO}
      load={settled(STRANDS)}
      preload={alreadyKnown(STRANDS)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )
}
