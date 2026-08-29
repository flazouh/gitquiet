import { Effect, Option } from "effect"
import type { Notice, Press, PressKind, Standing } from "../../src/domain/notices"
import { NoticesScreen } from "../../src/ui/NoticesScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf, MOCK_VIEWER } from "./faces"
import { minutesAgo } from "./when"

/**
 * The reader's inbox, filed by what needs you.
 *
 * The argument this picture has to make is the proportion. On a real inbox read on
 * 2026-08-13, 15 rows carried 7 pull requests that were already merged, and across three of
 * GitHub's own reason queries 41 rows of 51 concerned something finished — all of them drawn
 * at the same height and the same weight as the work. So the rows here keep that shape: a
 * Settled Court that is the largest of the three, holding merged pull requests and closed
 * issues that their page puts at the top of the list, and a Needs You Court small enough to
 * read in one look.
 *
 * Every reason on these rows is one of GitHub's fifteen and every subject state is one of the
 * six shapes their icons were observed drawing. The repositories are the ones the other mocks
 * use, so a reader moving between the pictures sees one product rather than twelve
 * inventions. Nothing here is anybody's private inbox.
 */

/** One row, before it is given an id, a time and the six forms GitHub puts on it. */
type Told = {
  readonly repository: string
  readonly number: string | null
  readonly title: string
  readonly reason: string
  readonly standing: Standing
  readonly unread: boolean
  /** Minutes before the capture. Fixed, so two captures are the same picture. */
  readonly minutes: number
  /** Who has been in the thread lately. A leading `app/` is a machine, as their links say. */
  readonly who: ReadonlyArray<string>
  readonly subscribed?: boolean
}

/**
 * Thirteen threads, which is what the frame holds with three Court headers above them.
 *
 * Counted rather than guessed: a row is forty-four pixels and a header thirty-three, so thirteen
 * rows and three headers carry the list to the bottom edge. The split across the Courts is the
 * measured one rather than a flattering one — two the reader owes, three with somebody else,
 * eight already over.
 */
const TOLD: ReadonlyArray<Told> = [
  {
    repository: "oven-sh/bun",
    number: "23014",
    title: "Decode streamed chunks with one decoder",
    reason: "review_requested",
    standing: "open",
    unread: true,
    minutes: 14,
    who: ["jhalvorsen", MOCK_VIEWER]
  },
  {
    repository: "oven-sh/bun",
    number: "22996",
    title: "Implement node:zlib brotli streams on Windows",
    reason: "assign",
    standing: "open",
    unread: true,
    minutes: 38,
    who: ["mvenn"]
  },
  {
    repository: "oven-sh/bun",
    number: "22971",
    title: "Reduce Bun.file().stream() allocations on large reads",
    reason: "author",
    standing: "open",
    unread: true,
    minutes: 52,
    who: ["t-okafor", MOCK_VIEWER]
  },
  {
    repository: "oven-sh/bun",
    number: "24680",
    title: "bun install hangs on a workspace with a cyclic peer range",
    reason: "comment",
    standing: "open",
    unread: false,
    minutes: 96,
    who: [MOCK_VIEWER, "jstahl"]
  },
  {
    // The largest and least personal reason there is, and the one a bot is usually behind.
    repository: "oven-sh/bun",
    number: "22990",
    title: "Bump vite from 7.1.9 to 7.1.14 in /packages/bun-inspector-frontend",
    reason: "subscribed",
    standing: "open",
    unread: false,
    minutes: 121,
    who: ["app/dependabot"]
  },
  {
    /*
     * The row that is the whole point of the screen: a review was asked for, the pull request
     * was merged without the reader, and their page still draws it as work. Eleven of the
     * fifteen review requests measured were this row.
     */
    repository: "oven-sh/bun",
    number: "22941",
    title: "Support import attributes in the CommonJS output",
    reason: "review_requested",
    standing: "merged",
    unread: true,
    minutes: 168,
    who: ["linnea-h", "jhalvorsen"]
  },
  {
    repository: "oven-sh/bun",
    number: "22902",
    title: "bun install: keep peer dependency ranges when hoisting",
    reason: "mention",
    standing: "merged",
    unread: false,
    minutes: 204,
    who: ["jstahl", MOCK_VIEWER]
  },
  {
    repository: "oven-sh/bun",
    number: "22851",
    title: "Fix Windows path normalisation in Bun.resolveSync",
    reason: "state_change",
    standing: "merged",
    unread: false,
    minutes: 262,
    who: ["s-almeida"]
  },
  {
    repository: "oven-sh/bun",
    number: "22830",
    title: "Run the Comment Cop against forks as well",
    reason: "author",
    standing: "merged",
    unread: false,
    minutes: 318,
    who: [MOCK_VIEWER, "kbranch"]
  },
  {
    repository: "oven-sh/bun",
    number: "24551",
    title: "Bun.serve() aborts mid-chunk on a slow client",
    reason: "comment",
    standing: "closed",
    unread: false,
    minutes: 402,
    who: ["dperrault", MOCK_VIEWER]
  },
  {
    // A thread the reader stopped, which is the one row that offers Subscribe rather than
    // Unsubscribe. Their own page marks it and says nothing else about it.
    repository: "oven-sh/bun",
    number: "24498",
    title: "Document the Windows install path for bun upgrade",
    reason: "subscribed",
    standing: "closed",
    unread: false,
    minutes: 486,
    who: ["app/github-actions"],
    subscribed: false
  },
  {
    /*
     * The one row with no number, which is what a security advisory is: their link is
     * `/advisories/GHSA-…`, the heading stands in for the repository, and the shape of their
     * icon says nothing about a state. Kept in the picture because a row this interface draws
     * with its state unsaid is a case worth photographing rather than hiding.
     */
    repository: "GHSA-4xq7-4mgh-gp6w",
    number: null,
    title: "Prototype pollution in a transitive dependency of the inspector frontend",
    reason: "security_advisory_credit",
    standing: "unknown",
    unread: false,
    minutes: 1_440,
    who: []
  },
  {
    // The thirteenth, and it is here for the frame rather than for a case: dropping the Running
    // header freed a header's height, and a picture that ends short of the edge invites the
    // reader to wonder what was cut off. Finished work is what the inbox has most of, so that is
    // what fills it.
    repository: "vitejs/vite",
    number: "19703",
    title: "Warn once when a plugin returns a sourcemap without sources",
    reason: "mention",
    standing: "merged",
    unread: false,
    minutes: 2_160,
    who: ["patak-dev", MOCK_VIEWER]
  }
]

/** Every form GitHub puts on a row, which is all of them on all of them. */
const KINDS: ReadonlyArray<PressKind> = [
  "mark",
  "unmark",
  "archive",
  "unarchive",
  "subscribe",
  "unsubscribe",
  "star",
  "unstar"
]

/**
 * The forms as their page carries them, tokens and all.
 *
 * Written out rather than left off, because which presses a row offers is read from the forms
 * and the row's own state together — a picture with no forms on it would photograph rows with
 * no buttons, which is not the screen.
 */
const pressesFor = (id: string): ReadonlyArray<Press> =>
  KINDS.map((kind) => ({
    kind,
    route: `/notifications/beta/${kind}`,
    token: `${kind}-${id}`,
    ids: [id]
  }))

/** Their own path for the subject, which is where a press on the title goes. */
const urlOf = (told: Told): string =>
  told.number === null
    ? `https://github.com/advisories/${told.repository}`
    : `https://github.com/${told.repository}/pull/${told.number}`

const noticeOf = (told: Told, at: number): Notice => {
  const id = `NT_kwHO${(4_820_000 + at * 37).toString(36).toUpperCase()}`

  return {
    id,
    url: urlOf(told),
    repository: told.repository,
    number: told.number,
    title: told.title,
    reason: told.reason,
    standing: told.standing,
    unread: told.unread,
    subscribed: told.subscribed ?? true,
    movedAt: minutesAgo(told.minutes),
    participants: told.who.map((login) => {
      const app = login.startsWith("app/")
      const name = login.replace(/^app\//, "")
      return {
        login: name,
        isAutomated: app,
        // A machine is drawn as a glyph rather than a face, so it needs none.
        faceUrl: app ? Option.none<string>() : faceOf(name)
      }
    }),
    presses: pressesFor(id)
  }
}

export const NOTICES: ReadonlyArray<Notice> = TOLD.map(noticeOf)

export const NOTIFICATIONS_VIEW: View = {
  name: "notifications",
  caption:
    "The inbox filed by what needs you, so the work that is already merged stops looking like work",
  ...STORE,
  draw: () => (
    <NoticesScreen
      load={settled(NOTICES)}
      preload={alreadyKnown(NOTICES)}
      recallRepositories={nothingRemembered()}
      signedIn={() => true}
      onPress={() => Effect.void}
      onStepAside={() => {}}
    />
  )
}
