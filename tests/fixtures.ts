import { readFileSync } from "node:fs"

export type FixtureName =
  | "changes"
  | "status-checks"
  | "merge-box"
  | "description"
  | "no-description"
  | "commit"
  | "commit-extra-diffs"
  | "approved-changes"
  | "approved-status-checks"
  | "approved-description"
  | "merge-box-approved"
  | "header"
  | "approved-header"
  | "issue-comments"
  | "approved-issue-comments"
  // The two the home page's other Destinations are read from, both recorded from a live
  // account: their repository filter's answer, and received events across the seven kinds
  // one afternoon produced.
  | "filtered-repositories"
  | "received-events"
  // Their issue search's answer to `assignee:@me is:issue is:open`, recorded from the
  // same account: three issues across two repositories, one of them with four labels
  // and one with none.
  | "involved-issues"
  // The first page of `flazouh/githubpro`'s own `main`, trimmed to three commits of each
  // of the three days it covered. Every commit on it has two authors, which is what a
  // repository written with an agent looks like, and their paging says there are older
  // ones and none newer.
  | "branch-commits"
  // The same route on `react/react`, where every commit landed as a pull request
  // and so carries the `(#123)` a squash writes. Two days, seven commits, chosen
  // to include one GitHub has never tested and one it only partly verified.
  | "branch-commits-landed"
  // And what their deferred route answered about exactly those seven: the check
  // rollups, the signatures and the comment counts their own list holds back.
  | "deferred-commit-data"
  // One whole issue as their own page reads it, recorded off `react/react` #35000:
  // a closed one with a reason, a label with a colour, eleven reactions, and a
  // twelve-item timeline holding three comments among nine events.
  | "issue-view"
  // One three-deep stack read from each seat in it, recorded off
  // `flazouh/stack-probe` while GitHub's stacked pull requests were in public
  // preview. The merge box is where a stack arrives, and `position` is the field
  // that differs between the three: the same three pull requests are BEFORE,
  // CURRENT and AFTER different things depending on which one is being read.
  | "merge-box-stacked-bottom"
  | "merge-box-stacked-middle"
  | "merge-box-stacked-top"
  // The top of that stack again, with the middle layer converted to a draft. The
  // case the interface exists to catch: GitHub still answers `MERGEABLE` with the
  // stack condition `PASSED`, and merging would still be refused, because a press
  // here lands the draft underneath as well.
  | "merge-box-stacked-draft-below"
  // What `page_data/preview_stack` answers on a pull request GitHub would stack
  // and has not: `flazouh/stack-probe` #16 on #15 on `main`, newest first, with
  // `stackId` and `stackNumber` null because nobody has made one. The base
  // branch on each entry is what the stack condition's own entries never carry,
  // and it is what names the branch the chain would land on.
  | "preview-stack"

/**
 * Fixtures are returned as `unknown` on purpose: decoders must earn their
 * types from the payload rather than being handed them by the loader.
 */
const loadFixtureText = (name: FixtureName): string =>
  readFileSync(new URL(`../fixtures/github/${name}.json`, import.meta.url), "utf8")

export const loadFixture = (name: FixtureName): unknown => JSON.parse(loadFixtureText(name))

/**
 * A pull request among the issues.
 *
 * GitHub models a pull request as an issue with a pull request hanging off it, and
 * their search answers with both unless the query says `is:issue`. Every recorded
 * row has `pull_request_id` null because the query that recorded them did say it,
 * so the one row that must be dropped has to be made here. Textual, because
 * fixtures are deliberately `unknown`: reaching into one to change a field would
 * mean asserting the shape the decoder is supposed to establish.
 */
export const involvedIssuesWithAPullRequest: unknown = JSON.parse(
  loadFixtureText("involved-issues").replace(
    '"issue":{"issue":{"pull_request_id":null}}',
    '"issue":{"issue":{"pull_request_id":4488708222}}'
  )
)

/**
 * The same recording, moved to where their search now puts it.
 *
 * Measured against the live route on 2026-08-14: `/search?type=issues` answers with
 * `payload.blackbirdSearchRoute` holding what `payload` used to hold directly, and the
 * rows and the three paging numbers inside it are unchanged. Made from the recording
 * rather than recorded again, because the move is the whole difference and a second
 * recording would only be able to say the same rows twice.
 *
 * The one field asserted here is `payload`, which the file is a recording of and the
 * loader is already named for. Nothing inside it is read, so the decoder still has to
 * establish every shape it claims.
 */
export const involvedIssuesAsNested: unknown = {
  payload: {
    blackbirdSearchRoute: (loadFixture("involved-issues") as { readonly payload: unknown }).payload
  }
}

export const draftWithBotFindings = {
  changes: loadFixture("changes"),
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box"),
  description: loadFixture("description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments")
}

export const mergedWithApproval = {
  changes: loadFixture("approved-changes"),
  statusChecks: loadFixture("approved-status-checks"),
  mergeBox: loadFixture("merge-box-approved"),
  description: loadFixture("approved-description"),
  header: loadFixture("approved-header"),
  issueComments: loadFixture("approved-issue-comments")
}

/**
 * A pull request that deletes a file.
 *
 * GitHub calls that `REMOVED` on this route. Both recordings happen to contain
 * only modifications, so neither says so — the case was found on a real private
 * pull request whose payload had three hundred and eight of them and not one
 * `DELETED`, the value we had guessed at. The rewrite is textual because
 * fixtures are deliberately `unknown`: reaching into one to change a field would
 * mean asserting the shape the decoder is supposed to establish.
 */
export const withADeletedFile = {
  changes: JSON.parse(
    loadFixtureText("changes").replace('"changeType":"MODIFIED"', '"changeType":"REMOVED"')
  ) as unknown,
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box"),
  description: loadFixture("description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments")
}

/**
 * One line of a diff that GitHub says it put there itself.
 *
 * `INJECTED_CONTEXT`, with a `~` where every other line carries its marker —
 * space, `+` or `-`. It arrives in hunks whose every line is one of these, both
 * numbers equal, and GitHub's own HTML for it draws a space: an unchanged line,
 * shown for company. Found on `octo-org/octo-repo#1533`, which had eighteen
 * of them and reached the failure screen on the first.
 */
export const withInjectedContext = {
  changes: JSON.parse(
    loadFixtureText("changes").replace(
      '{"type":"CONTEXT","blobLineNumber":39,"position":9,"displayNoNewLineWarning":false,"text":" \\t\\t\\tthis._workbenchUIElementFactory,"',
      '{"type":"INJECTED_CONTEXT","blobLineNumber":39,"position":9,"displayNoNewLineWarning":false,"text":"~\\t\\t\\tthis._workbenchUIElementFactory,"'
    )
  ) as unknown,
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box"),
  description: loadFixture("description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments")
}

/**
 * A pull request opened without a word of description.
 *
 * `"body": null`, with `bodyHtml` empty beside it — GitHub does not send an
 * unwritten description as an empty string. Recorded from `microsoft/vscode#328450`
 * rather than written by hand, because insisting on a string here failed the read of
 * every pull request in that repository: most changes there are a line, and nobody
 * writes a paragraph about a line.
 */
export const withNoDescription = {
  changes: loadFixture("changes"),
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box"),
  description: loadFixture("no-description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments")
}

/**
 * One pull request of a stack, read from a given seat in it.
 *
 * Only the merge box is recorded per seat, because the merge box is the only
 * route that says a stack exists: the other five describe one pull request and
 * would be the same payload three times. The draft's recordings stand in for
 * them, which makes these composites a stack around a pull request from another
 * repository entirely — fine here, since nothing being tested reads both.
 */
const stackedAt = (seat: "bottom" | "middle" | "top" | "draft-below") => ({
  changes: loadFixture("changes"),
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture(`merge-box-stacked-${seat}`),
  description: loadFixture("description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments")
})

/** The foundation: nothing below it, two pull requests standing on it. */
export const stackedAtTheBottom = stackedAt("bottom")

/** One below, one above, which is the only seat that has both. */
export const stackedInTheMiddle = stackedAt("middle")

/** The top: a press here lands all three. */
export const stackedOnTop = stackedAt("top")

/** The top again, with a draft in the middle of what a press would land. */
export const stackedOverADraft = stackedAt("draft-below")

/**
 * A pull request GitHub would stack and has not, read from either seat in it.
 *
 * The merge box is the ordinary one, and that is the point: it cannot tell this
 * state from a pull request with nothing to stack. Recorded off
 * `flazouh/stack-probe` #15 and #16, a branch off a branch nobody has pressed
 * their button on, where `page_data/preview_stack` answers with the pair and
 * their base branches. The other five routes are the draft's again, for the
 * reason the stack fixtures give.
 */
export const couldBeStacked = {
  changes: loadFixture("changes"),
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box"),
  description: loadFixture("description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments"),
  preview: loadFixture("preview-stack")
}

/**
 * A pull request standing in the merge queue.
 *
 * GitHub calls that `QUEUED` on this route, which is a fifth value in an enum
 * their GraphQL only ever spells `OPEN`, `CLOSED` or `MERGED` — the merge box
 * for the same pull request says `OPEN` in the same second. Found on
 * `octo-org/octo-repo#1533`, where a real queued pull request reached the
 * failure screen: refusing the value cost the whole Control Center, and being
 * in the line is something the merge state already says.
 */
export const queuedToMerge = {
  changes: JSON.parse(
    loadFixtureText("changes").replace('"state":"DRAFT"', '"state":"QUEUED"')
  ) as unknown,
  statusChecks: loadFixture("status-checks"),
  mergeBox: loadFixture("merge-box"),
  description: loadFixture("description"),
  header: loadFixture("header"),
  issueComments: loadFixture("issue-comments")
}
