import { Effect, Option } from "effect"
import type {
  Check,
  CheckNote,
  CheckState,
  JobStep,
  LogLine,
  LogTone,
  MergeMethod,
  Participant
} from "../../../src/domain/PullRequest"
import type { Happening } from "../../../src/domain/activity"
import type { Listing } from "../../../src/domain/life"
import type { Notice, Press } from "../../../src/domain/notices"
import type { Person } from "../../../src/domain/person"
import type { Touch } from "../../../src/domain/repoHome"
import type { RunOpening, RunRef } from "../../../src/domain/run"
import type { CommitList, History, Landed } from "../../../src/domain/commitList"
import type { Blamed } from "../../../src/domain/blame"
import type { Opened, TouchWho } from "../../../src/domain/repoHome"
import type { PullRequestRef, RepoRef } from "../../../src/domain/PullRequestRef"
import { GatewayError, WorkingSetError } from "../../../src/ports/GitHubGateway"
import type { CheckFacts, FaceFacts } from "../shared/wire"
import { ask } from "./rpc"
import { frontFrom, marksFrom, standingFrom, suggestingFrom, tabsFrom } from "./front"

const refused = (reference: RepoRef, route: string, detail: string) =>
  new GatewayError({ reference, route, reason: "rejected", detail })

const listRefused = (route: string, detail: string) =>
  new WorkingSetError({ route, reason: "rejected", detail })

const faceOf = (face: FaceFacts): Participant => ({
  login: face.login,
  isAutomated: face.isAutomated,
  faceUrl: Option.fromNullishOr(face.faceUrl)
})

const landedOf = (one: {
  readonly sha: string
  readonly abbreviatedSha: string
  readonly headline: string
  readonly bodyHtml: string | null
  readonly authors: ReadonlyArray<FaceFacts>
  readonly committer: FaceFacts | null
  readonly pullRequest: number | null
  readonly createdAt: string
}): Landed => ({
  sha: one.sha,
  abbreviatedSha: one.abbreviatedSha,
  headline: one.headline,
  bodyHtml: Option.fromNullishOr(one.bodyHtml),
  authors: one.authors.map(faceOf),
  committer: Option.fromNullishOr(one.committer === null ? undefined : faceOf(one.committer)),
  pullRequest: Option.fromNullishOr(one.pullRequest),
  createdAt: one.createdAt,
  mark: Option.none(),
  stat: Option.none()
})

const asFacts = (check: Check): CheckFacts => ({
  ...check,
  state: check.state === "tolerated" ? "failed" : check.state
})

const lineOf = (one: { readonly at: number; readonly text: string; readonly tone: string }): LogLine => ({
  at: one.at,
  text: one.text,
  tone: (one.tone as LogTone) ?? "plain",
  pieces: [{ text: one.text, colour: Option.none(), file: Option.none() }]
})

export const askForSearch = Effect.fn("askForSearch")(function* (query: string, page: number) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("searchPulls", { query, page }),
    catch: (cause) => listRefused("search", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(listRefused("search", answered.why))
  return answered.it
})

export const askToStar = Effect.fn("askToStar")(function* (
  reference: RepoRef,
  to: "starred" | "unstarred" | "barred"
) {
  if (to === "barred") {
    return yield* Effect.fail(refused(reference, "star", "This account cannot star that repository."))
  }
  const answered = yield* Effect.tryPromise({
    try: () => ask("starRepo", { ...reference, to }),
    catch: (cause) => refused(reference, "star", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "star", answered.why))
})

export const askForTreePaths = Effect.fn("askForTreePaths")(function* (reference: RepoRef, sha: string) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("treePaths", { ...reference, sha }),
    catch: (cause) => refused(reference, "treePaths", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "treePaths", answered.why))
  return answered.it
})

export const askForFileAt = Effect.fn("askForFileAt")(function* (
  reference: RepoRef,
  branch: string,
  path: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("fileAt", { ...reference, branch, path }),
    catch: (cause) => refused(reference, "fileAt", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "fileAt", answered.why))
  const opened: Opened = {
    path: answered.it.path,
    lines: answered.it.lines,
    rendered: Option.fromNullishOr(answered.it.rendered)
  }
  return opened
})

export const askForRawFileAt = Effect.fn("askForRawFileAt")(function* (
  reference: RepoRef,
  branch: string,
  path: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("rawFileAt", { ...reference, branch, path }),
    catch: (cause) => refused(reference, "rawFileAt", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "rawFileAt", answered.why))
  return answered.it
})

export const askForBlameAt = Effect.fn("askForBlameAt")(function* (
  reference: RepoRef,
  branch: string,
  path: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("blameAt", { ...reference, branch, path }),
    catch: (cause) => refused(reference, "blameAt", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "blameAt", answered.why))
  const blamed: Blamed = {
    ranges: answered.it.ranges,
    commits: new Map(answered.it.commits.map((one) => [one.oid, one])),
    ignoreRevsPresent: false,
    lines: answered.it.lines
  }
  return blamed
})

export const askForBranches = Effect.fn("askForBranches")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("branchesOf", reference),
    catch: (cause) => refused(reference, "branchesOf", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "branchesOf", answered.why))
  return answered.it
})

export const askForAuthors = Effect.fn("askForAuthors")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("authorsOf", reference),
    catch: (cause) => refused(reference, "authorsOf", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "authorsOf", answered.why))
  return answered.it.map(faceOf)
})

export const askForReleases = Effect.fn("askForReleases")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("releases", reference),
    catch: (cause) => refused(reference, "releases", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "releases", answered.why))
  return answered.it
})

export const askForBuilds = Effect.fn("askForBuilds")(function* (reference: RepoRef, tag: string) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("builds", { ...reference, tag }),
    catch: (cause) => refused(reference, "builds", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "builds", answered.why))
  return answered.it
})

export const askForCommits = Effect.fn("askForCommits")(function* (list: CommitList) {
  const answered = yield* Effect.tryPromise({
    try: () =>
      ask("commits", {
        owner: list.repo.owner,
        repo: list.repo.repo,
        branch: Option.getOrNull(list.branch),
        search: list.search
      }),
    catch: (cause) => refused(list.repo, "commits", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(list.repo, "commits", answered.why))
  const history: History = {
    branch: answered.it.branch,
    days: answered.it.days.map((day) => ({ title: day.title, commits: day.commits.map(landedOf) })),
    older: Option.fromNullishOr(answered.it.older),
    newer: Option.fromNullishOr(answered.it.newer),
    rest: Option.fromNullishOr(answered.it.rest)
  }
  return history
})

export const askForCommitStat = Effect.fn("askForCommitStat")(function* (
  reference: RepoRef,
  sha: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("commitStat", { ...reference, sha }),
    catch: (cause) => refused(reference, "commitStat", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "commitStat", answered.why))
  return Option.fromNullishOr(answered.it)
})

export const askForWhoTouched = Effect.fn("askForWhoTouched")(function* (
  reference: RepoRef,
  sha: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("whoTouched", { ...reference, sha }),
    catch: (cause) => refused(reference, "whoTouched", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "whoTouched", answered.why))
  if (answered.it === null) return Option.none<TouchWho>()
  const who: TouchWho = { login: answered.it.login, face: Option.fromNullishOr(answered.it.face) }
  return Option.some(who)
})

export const askForNotes = Effect.fn("askForNotes")(function* (
  reference: PullRequestRef,
  check: Check
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("notes", { ...reference, check: asFacts(check) }),
    catch: (cause) => refused(reference, "notes", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "notes", answered.why))
  return answered.it.map(
    (one): CheckNote => ({
      level: one.level,
      where: one.where,
      message: one.message,
      at: Option.fromNullishOr(one.at)
    })
  )
})

export const askForLog = Effect.fn("askForLog")(function* (
  reference: PullRequestRef,
  sha: string,
  check: Check,
  step: number
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("logLines", { ...reference, sha, check: asFacts(check), step }),
    catch: (cause) => refused(reference, "log", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "log", answered.why))
  return answered.it.map(lineOf)
})

export const askForTail = Effect.fn("askForTail")(function* (
  reference: PullRequestRef,
  sha: string,
  check: Check,
  keep: number
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("tailLines", { ...reference, sha, check: asFacts(check), keep }),
    catch: (cause) => refused(reference, "tail", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "tail", answered.why))
  return answered.it.map(lineOf)
})

const asState = (state: string): CheckState => {
  switch (state) {
    case "succeeded":
    case "failed":
    case "running":
    case "queued":
    case "cancelled":
    case "skipped":
    case "neutral":
    case "tolerated":
      return state
    default:
      return "neutral"
  }
}

export const askForRun = Effect.fn("askForRun")(function* (reference: RunRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("run", { owner: reference.repo.owner, repo: reference.repo.repo, run: reference.run }),
    catch: (cause) => refused(reference.repo, "run", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference.repo, "run", answered.why))
  const opening: RunOpening = {
    run: { ...answered.it.run, state: asState(answered.it.run.state) },
    jobs: answered.it.jobs.map((one) => ({ ...one, state: asState(one.state) })),
    notes: answered.it.notes.map((one) => ({
      level: one.level,
      where: one.where,
      message: one.message,
      at: Option.fromNullishOr(one.at)
    })),
    gathering: answered.it.gathering.map((one) => ({
      level: one.level,
      headline: one.headline,
      message: one.message,
      where: one.where,
      count: one.count,
      at: Option.fromNullishOr(one.at)
    })),
    presses: answered.it.presses
  }
  return opening
})

export const askToRerun = Effect.fn("askToRerun")(function* (
  reference: RunRef,
  which: "all" | "failed"
) {
  const answered = yield* Effect.tryPromise({
    try: () =>
      ask("rerunRun", {
        owner: reference.repo.owner,
        repo: reference.repo.repo,
        run: reference.run,
        which
      }),
    catch: (cause) => refused(reference.repo, "rerunRun", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference.repo, "rerunRun", answered.why))
})

export const askToCancelRun = Effect.fn("askToCancelRun")(function* (reference: RunRef) {
  const answered = yield* Effect.tryPromise({
    try: () =>
      ask("cancelRun", { owner: reference.repo.owner, repo: reference.repo.repo, run: reference.run }),
    catch: (cause) => refused(reference.repo, "cancelRun", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference.repo, "cancelRun", answered.why))
})

export const askForStrands = Effect.fn("askForStrands")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("strands", reference),
    catch: (cause) => refused(reference, "strands", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "strands", answered.why))
  return answered.it
})

export const askForNotices = Effect.fn("askForNotices")(function* (query: string) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("notices", { query }),
    catch: (cause) => listRefused("notices", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(listRefused("notices", answered.why))
  return answered.it as ReadonlyArray<Notice>
})

export const askToPressNotice = Effect.fn("askToPressNotice")(function* (press: Press) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("pressNotice", press),
    catch: (cause) => listRefused("pressNotice", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(listRefused("pressNotice", answered.why))
})

export const askForPerson = Effect.fn("askForPerson")(function* (login: string) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("person", { login }),
    catch: (cause) => listRefused("person", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(listRefused("person", answered.why))
  if (answered.it === null) return Option.none<Person>()
  const who = answered.it
  const person: Person = {
    login: who.login,
    name: Option.fromNullishOr(who.name),
    bio: Option.fromNullishOr(who.bio),
    faceUrl: Option.fromNullishOr(who.faceUrl),
    company: Option.fromNullishOr(who.company),
    location: Option.fromNullishOr(who.location),
    followers: Option.some(who.followers),
    following: Option.some(who.following),
    site: Option.fromNullishOr(who.site === null ? undefined : { label: who.site, href: who.site }),
    ways: [],
    sponsorAt: Option.none(),
    tally: {
      repositories: Option.some(who.tally.repositories),
      stars: Option.fromNullishOr(who.tally.stars)
    }
  }
  return Option.some(person)
})

export const askForPersonRepositories = Effect.fn("askForPersonRepositories")(function* (
  login: string,
  page: number
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("personRepositories", { login, page }),
    catch: (cause) => listRefused("personRepositories", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(listRefused("personRepositories", answered.why))
  const listing: Listing = {
    more: answered.it.more,
    rows: answered.it.rows.map((one) => ({
      owner: one.owner,
      repo: one.repo,
      nameWithOwner: one.nameWithOwner,
      description: Option.fromNullishOr(one.description),
      topics: one.topics,
      language: Option.fromNullishOr(one.language),
      stars: one.stars,
      forks: one.forks,
      pushedAt: Option.fromNullishOr(one.pushedAt),
      isArchived: one.isArchived,
      isFork: one.isFork,
      forkedFrom: Option.fromNullishOr(one.forkedFrom),
      isPrivate: one.isPrivate
    }))
  }
  return listing
})

const happeningKind = (kind: string): Happening["kind"] => {
  switch (kind) {
    case "pushed":
    case "opened":
    case "merged":
    case "closed":
    case "reopened":
    case "commented":
    case "reviewed":
    case "raised":
    case "settled":
    case "starred":
    case "branched":
    case "deleted":
      return kind
    default:
      return "commented"
  }
}

export const askForActivity = Effect.fn("askForActivity")(function* (login: string) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("activity", { login }),
    catch: (cause) => listRefused("activity", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(listRefused("activity", answered.why))
  return answered.it.map(
    (one): Happening => ({
      kind: happeningKind(one.kind),
      at: one.at,
      by: one.by.map((who) => ({ login: who.login, faceUrl: Option.fromNullishOr(who.faceUrl) })),
      repo: one.repo,
      ref: Option.fromNullishOr(one.ref),
      howMany: Option.fromNullishOr(one.howMany),
      howOften: one.howOften,
      number: Option.fromNullishOr(one.number),
      title: Option.fromNullishOr(one.title),
      url: one.url
    })
  )
})

export const askForTreeCommits = Effect.fn("askForTreeCommits")(function* (
  reference: RepoRef,
  sha: string,
  folder?: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("treeCommits", { ...reference, sha, folder }),
    catch: (cause) => refused(reference, "treeCommits", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "treeCommits", answered.why))
  return new Map(
    answered.it.map(([name, touch]): [string, Touch] => [
      name,
      {
        at: touch.at,
        said: touch.said,
        url: touch.url,
        oid: Option.some(touch.oid),
        who:
          touch.who === null
            ? Option.none()
            : Option.some({ login: touch.who.login, face: Option.fromNullishOr(touch.who.face) })
      }
    ])
  )
})

export const askForCommitMarks = Effect.fn("askForCommitMarks")(function* (
  reference: RepoRef,
  rest: string
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("commitMarks", { ...reference, rest }),
    catch: (cause) => refused(reference, "commitMarks", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "commitMarks", answered.why))
  return marksFrom(answered.it)
})

export const askForRepoHome = Effect.fn("askForRepoHome")(function* (
  reference: RepoRef,
  branch: string | null
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("repoHome", { ...reference, branch }),
    catch: (cause) => refused(reference, "repoHome", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "repoHome", answered.why))
  return frontFrom(answered.it)
})

export const askForStanding = Effect.fn("askForStanding")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("standing", reference),
    catch: (cause) => refused(reference, "standing", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "standing", answered.why))
  return standingFrom(answered.it)
})

export const askForTabs = Effect.fn("askForTabs")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("tabs", reference),
    catch: (cause) => refused(reference, "tabs", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "tabs", answered.why))
  return tabsFrom(answered.it)
})

export const askForSuggesting = Effect.fn("askForSuggesting")(function* (reference: RepoRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("suggesting", reference),
    catch: (cause) => refused(reference, "suggesting", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "suggesting", answered.why))
  return suggestingFrom(answered.it)
})

export const askToUpload = Effect.fn("askToUpload")(function* (reference: RepoRef, file: File) {
  const bytes = yield* Effect.tryPromise({
    try: async () => {
      const raw = new Uint8Array(await file.arrayBuffer())
      let binary = ""
      for (const byte of raw) binary += String.fromCharCode(byte)
      return btoa(binary)
    },
    catch: (cause) => refused(reference, "upload", String(cause))
  })
  const answered = yield* Effect.tryPromise({
    try: () =>
      ask("upload", {
        ...reference,
        name: file.name,
        type: file.type,
        bytes
      }),
    catch: (cause) => refused(reference, "upload", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "upload", answered.why))
  return answered.it
})

export const askToMergeStack = Effect.fn("askToMergeStack")(function* (
  reference: PullRequestRef,
  method: MergeMethod
) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("mergeStack", { ...reference, method }),
    catch: (cause) => refused(reference, "mergeStack", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "mergeStack", answered.why))
})

export const askToMakeStack = Effect.fn("askToMakeStack")(function* (reference: PullRequestRef) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("makeStack", reference),
    catch: (cause) => refused(reference, "makeStack", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "makeStack", answered.why))
})

export const askForSteps = Effect.fn("askForSteps")(function* (reference: PullRequestRef, check: Check) {
  const answered = yield* Effect.tryPromise({
    try: () => ask("jobSteps", { ...reference, check: asFacts(check) }),
    catch: (cause) => refused(reference, "steps", String(cause))
  })
  if (!answered.ok) return yield* Effect.fail(refused(reference, "steps", answered.why))
  return answered.it.map(
    (one): JobStep => ({
      number: one.number,
      name: one.name,
      state: one.state,
      seconds: Option.fromNullishOr(one.seconds)
    })
  )
})
