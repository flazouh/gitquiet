import { Effect, Option } from "effect"
import type { Settling } from "../../../src/domain/Issue"
import type { Involvement, IssueRef } from "../../../src/domain/issues"
import type { PullRequestRef, RepoRef } from "../../../src/domain/PullRequestRef"
import type { Raising } from "../../../src/domain/raising"
import { GatewayError, WorkingSetError } from "../../../src/ports/GitHubGateway"
import { ask } from "./rpc"
import { foundFrom, involvedFrom, issueFrom, repositoryFrom } from "./issueSnapshot"

const refused = (reference: IssueRef | RepoRef, route: string, detail: string) =>
  new GatewayError({ reference, route, reason: "rejected", detail })

const listRefused = (route: string, detail: string) =>
  new WorkingSetError({ route, reason: "rejected", detail })

export const askForIssue = Effect.fn("askForIssue")(function* (reference: IssueRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("issue", reference),
    catch: (cause) => refused(reference, "issue", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "issue", answered.why))
  return issueFrom(answered.it)
})

export const askForInvolvedIssues = Effect.fn("askForInvolvedIssues")(function* (
  involvement: Involvement
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("involvedIssues", { involvement }),
    catch: (cause) => listRefused("involvedIssues", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(listRefused("involvedIssues", answered.why))
  return answered.it.map((one) => involvedFrom(involvement, one))
})

export const askForIssueSearch = Effect.fn("askForIssueSearch")(function* (
  query: string,
  page: number
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("issueSearch", { query, page }),
    catch: (cause) => listRefused("issueSearch", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(listRefused("issueSearch", answered.why))
  return foundFrom(answered.it)
})

export const askToSettleIssue = Effect.fn("askToSettleIssue")(function* (
  reference: IssueRef,
  id: string,
  settling: Settling
) {
  const answered = yield* Effect.tryPromise({
    try: () =>
      ask("settleIssue", {
        ...reference,
        id,
        as: settling.as,
        of: settling.as === "duplicate" ? settling.of : undefined
      }),
    catch: (cause) => refused(reference, "settleIssue", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "settleIssue", answered.why))
})

export const askToReopenIssue = Effect.fn("askToReopenIssue")(function* (
  reference: IssueRef,
  id: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("reopenIssue", { ...reference, id }),
    catch: (cause) => refused(reference, "reopenIssue", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "reopenIssue", answered.why))
})

export const askToSayOnIssue = Effect.fn("askToSayOnIssue")(function* (
  reference: IssueRef,
  body: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("sayOnIssue", { ...reference, body }),
    catch: (cause) => refused(reference, "sayOnIssue", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "sayOnIssue", answered.why))

  return {
    id: answered.it.id,
    author: {
      login: answered.it.author.login,
      isAutomated: answered.it.author.isAutomated,
      faceUrl: Option.fromNullishOr(answered.it.author.faceUrl)
    },
    body: answered.it.body,
    html: answered.it.html,
    createdAt: answered.it.createdAt
  }
})

export const askToRaise = Effect.fn("askToRaise")(function* (reference: RepoRef, draft: Raising) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("raiseIssue", { ...reference, title: draft.title, body: draft.body }),
    catch: (cause) => refused(reference, "raise", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "raise", answered.why))
  return answered.it
})

export const askForRepositories = Effect.fn("askForRepositories")(function* () {
  const answered = yield* Effect.tryPromise({
    try: () => ask("repositories", undefined),
    catch: (cause) => listRefused("repositories", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(listRefused("repositories", answered.why))
  return answered.it.map(repositoryFrom)
})

export const askToDeleteBranch = Effect.fn("askToDeleteBranch")(function* (
  reference: PullRequestRef
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("deleteBranch", reference),
    catch: (cause) => refused(reference, "deleteBranch", String(cause))
  })

  if (!answered.ok) return yield* Effect.fail(refused(reference, "deleteBranch", answered.why))
})
