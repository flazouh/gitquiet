import { afterEach, beforeEach, describe, expect, it, test } from "bun:test"
import { Effect, Option } from "effect"
import { draftWithBotFindings, loadFixture } from "../../tests/fixtures"
import { forgetEverything, installStorage, place, stored } from "../../tests/storage"
import { rememberedPullRequest } from "../app/pullRequest"
import { loadRepoList, rememberedRepoList } from "../app/repoList"
import { loadWorkingSet, rememberedWorkingSet } from "../app/workingSet"
import type { PullRequestRef } from "../domain/PullRequestRef"
import type { RepoList } from "../domain/repoList"
import { recall, remember, rememberRoute } from "./cache"
import { layer } from "./GitHubGateway"
import type { RawPayloads } from "./snapshot"

installStorage()
beforeEach(forgetEverything)

const mergeBox = loadFixture("merge-box") as { readonly pullRequest: Record<string, unknown> }

const ref = (number: number): PullRequestRef => ({ owner: "microsoft", repo: "vscode", number })

const payloadsFor = (number: number): RawPayloads => ({
  changes: { pull: number },
  statusChecks: {},
  mergeBox: {},
  description: {},
  header: {},
  issueComments: []
})

const recalled = (reference: PullRequestRef) => Effect.runPromise(recall(reference))

const kept = (reference: PullRequestRef, payloads: RawPayloads) =>
  Effect.runPromise(remember(reference, payloads))

/**
 * Reading through the gateway, which is the only seam: what the interface asks
 * for and what it gets back, with the store where it actually is.
 */
const readAgain = (reference: PullRequestRef) =>
  Effect.runPromise(rememberedPullRequest(reference).pipe(Effect.provide(layer)))

describe("keeping a pull request to open again", () => {
  it("has nothing to say about one never read", async () => {
    expect(await recalled(ref(1))).toEqual(Option.none())
  })

  it("gives GitHub's payloads back exactly as they arrived", async () => {
    await kept(ref(1), payloadsFor(1))

    expect(await recalled(ref(1))).toEqual(Option.some(payloadsFor(1)))
  })

  it("keeps pull requests apart", async () => {
    await kept(ref(1), payloadsFor(1))
    await kept(ref(2), payloadsFor(2))

    expect(await recalled(ref(1))).toEqual(Option.some(payloadsFor(1)))
    expect(await recalled(ref(2))).toEqual(Option.some(payloadsFor(2)))
  })

  it("replaces what it held when the same pull request is read again", async () => {
    await kept(ref(1), payloadsFor(1))
    await kept(ref(1), { ...payloadsFor(1), changes: { pull: "newer" } })

    expect(await recalled(ref(1))).toEqual(Option.some({ ...payloadsFor(1), changes: { pull: "newer" } }))
  })

  it("forgets the least recently read once it is full, and nothing before that", async () => {
    for (let number = 1; number <= 41; number += 1) await kept(ref(number), payloadsFor(number))

    expect(await recalled(ref(1))).toEqual(Option.none())
    expect(await recalled(ref(2))).toEqual(Option.some(payloadsFor(2)))
    expect(await recalled(ref(41))).toEqual(Option.some(payloadsFor(41)))
  })

  it("counts reading one again as recent, so it is not the one dropped", async () => {
    for (let number = 1; number <= 40; number += 1) await kept(ref(number), payloadsFor(number))
    await kept(ref(1), payloadsFor(1))
    await kept(ref(99), payloadsFor(99))

    expect(await recalled(ref(1))).toEqual(Option.some(payloadsFor(1)))
    expect(await recalled(ref(2))).toEqual(Option.none())
  })
})

describe("reading a remembered pull request back through the gateway", () => {
  it("decodes it the same way a live read would", async () => {
    await kept(ref(1), draftWithBotFindings)

    const read = await readAgain(ref(1))

    expect(Option.isSome(read)).toBe(true)
    // Decoded, not handed back as JSON: a snapshot with the domain on it.
    expect(Option.getOrThrow(read).snapshot.reference).toEqual(ref(1))
    expect(Option.getOrThrow(read).snapshot.files.length).toBeGreaterThan(0)
  })

  it("says nothing about a pull request never read", async () => {
    expect(await readAgain(ref(404))).toEqual(Option.none())
  })

  it("treats a payload it can no longer decode as never having been read", async () => {
    // What a build from before a GitHub schema change leaves behind. Kept the
    // way anything else is; refused by the decoder rather than half-read.
    await kept(ref(1), payloadsFor(1))

    expect(await readAgain(ref(1))).toEqual(Option.none())
  })

  it("treats an entry written in some older shape as never having been read", async () => {
    place("pr:microsoft/vscode/1", { payloads: draftWithBotFindings, written: "no `at` field" })

    expect(await recalled(ref(1))).toEqual(Option.none())
    expect(await readAgain(ref(1))).toEqual(Option.none())
  })

  it("remembers what a live read decoded, so the next visit has it waiting", async () => {
    await kept(ref(1), draftWithBotFindings)

    // The shape the gateway writes, rather than whatever a test felt like
    // putting there: a timestamp beside the payloads GitHub actually sent.
    const entry = stored("pr:microsoft/vscode/1")
    expect(entry).toMatchObject({ payloads: draftWithBotFindings })
    expect(Option.isSome(await readAgain(ref(1)))).toBe(true)
  })
})

/**
 * The two lists, which are read the same way a pull request is: from what the
 * last visit left behind, while GitHub is asked what is true now.
 *
 * GitHub is taken away between the two halves of every test here. A list that
 * still answers with the network unplugged is a list that came out of the
 * store, and there is no other way to be sure of that from the outside.
 */
const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

const asGitHub = (respond: (url: string) => Response | Promise<Response>): void => {
  globalThis.fetch = Object.assign(
    (input: RequestInfo | URL): Promise<Response> => Promise.resolve(respond(String(input))),
    { preconnect: realFetch.preconnect }
  )
}

/** GitHub, gone. Anything asked of it from here is the test failing, not the network. */
const offline = (): void => {
  asGitHub((url) => {
    throw new Error(`Nothing should be asked of GitHub now, and this asked for ${url}`)
  })
}

const aRow = (number: number, over: Record<string, unknown> = {}) => ({
  id: `PR_${4_000_000 + number}`,
  number,
  title: `something number ${number}`,
  repoNameWithOwner: "microsoft/vscode",
  permalink: `https://github.com/microsoft/vscode/pull/${number}`,
  author: { displayLogin: "someone" },
  state: "OPEN",
  isDraft: false,
  isReadByCurrentUser: true,
  commentCount: 0,
  createdAt: "2026-07-28T19:43:33+02:00",
  updatedAt: "2026-07-29T04:19:41+02:00",
  headSha: "0f95bb9db765f8134a8c33b4f6ecbdb21666e32e",
  category: "CI_FAILING",
  labels: [],
  assignees: [],
  ...over
})

const shelfPayload = (rows: ReadonlyArray<unknown>) => ({
  payload: { pullsInboxSurfaceContentRoute: { results: rows } }
})

const queryPayload = (rows: ReadonlyArray<unknown>) => ({
  payload: {
    pullsDashboardSurfaceContentRoute: {
      results: rows,
      pageInfo: { currentPage: 1, totalPages: 3, totalCount: 61 }
    }
  }
})

const deferredPayload = (results: ReadonlyArray<unknown>) => ({
  payload: { pullsInboxSurfaceContentDeferredData: { results } }
})

/** One row on the first shelf and nothing anywhere else, which is a Working Set of one. */
const oneShelved = (url: string): Response => {
  if (url.includes("/pulls/inbox/deferred")) {
    return Response.json(
      deferredPayload([
        { id: "PR_4000001", statusCheckRollup: { state: "SUCCESS", totalCount: 2, successCount: 2 } }
      ])
    )
  }
  return Response.json(shelfPayload(url.includes("filter=needs-action") ? [aRow(1)] : []))
}

/**
 * One row on the shelf where the rollup is what decides the Court.
 *
 * `waiting-for-review` means nobody has answered yet, which on a repository requiring
 * no approval is not a wait at all: passing checks and no review required is a live
 * merge button, and `courtOf` calls it Needs You. Read the same row without its rollup
 * and it is Waiting. One row, two headings, decided by a fact the store either kept or
 * did not.
 */
const oneAwaitingReview = (url: string): Response => {
  if (url.includes("/pulls/inbox/deferred")) {
    return Response.json(
      deferredPayload([
        { id: "PR_4000001", statusCheckRollup: { state: "SUCCESS", totalCount: 2, successCount: 2 } }
      ])
    )
  }
  return Response.json(
    shelfPayload(url.includes("filter=waiting-for-review") ? [aRow(1)] : [])
  )
}

/**
 * Two rows on the first shelf, one stacked on the other, both measured.
 *
 * Enough of GitHub to exercise the two reads a list needs beyond its own route:
 * a merge box each, which is how a stack is found at all — number two is based on
 * number one's branch — and a diffstat each, which is how big it is.
 */
const twoShelvedAndMeasured = (url: string): Response => {
  if (url.includes("/pulls/inbox/deferred")) return Response.json(deferredPayload([]))

  if (url.includes("/page_data/diffstat")) {
    return Response.json({ diffstat: { linesAdded: 40, linesDeleted: 4 } })
  }

  if (url.includes("/page_data/merge_box")) {
    // Their own recorded merge box with the two branch names replaced, because
    // this route is enormous and the decoder means it: a hand-written pair of
    // refs is refused for the fifty fields around them that are missing.
    const stacked = url.includes("/pull/2/")
    return Response.json({
      ...mergeBox,
      pullRequest: {
        ...mergeBox.pullRequest,
        baseRefName: stacked ? "feature-one" : "main",
        headRefName: stacked ? "feature-two" : "feature-one"
      }
    })
  }

  return Response.json(
    shelfPayload(url.includes("filter=needs-action") ? [aRow(1), aRow(2)] : [])
  )
}

/**
 * A read, and then the moment after it.
 *
 * The store is written by a fiber the read does not wait for — the list is on
 * the screen either way, and only the next visit is affected — so a test that
 * asks what was remembered the instant the read answers is asking too early.
 */
const settle = (): Promise<void> => new Promise((done) => setTimeout(done, 0))

const readWorkingSet = async () => {
  await Effect.runPromise(loadWorkingSet().pipe(Effect.provide(layer)))
  await settle()
}

/** The same read, with what it answered, for a test comparing the two lists. */
const readWorkingSetAnswering = async () => {
  const live = await Effect.runPromise(loadWorkingSet().pipe(Effect.provide(layer)))
  await settle()
  return live
}

const workingSetAgain = () =>
  Effect.runPromise(rememberedWorkingSet().pipe(Effect.provide(layer)))

const rowsIn = (sittings: ReadonlyArray<{ readonly count: number }>): number =>
  sittings.reduce((sum, sitting) => sum + sitting.count, 0)

describe("keeping the Working Set to open again", () => {
  test("has nothing to say about one never read", async () => {
    offline()

    expect(await workingSetAgain()).toEqual(Option.none())
  })

  test("gives the shelves back without asking GitHub a second time", async () => {
    asGitHub(oneShelved)
    await readWorkingSet()

    offline()
    const remembered = await workingSetAgain()

    expect(Option.isSome(remembered)).toBe(true)
    expect(rowsIn(Option.getOrThrow(remembered))).toBe(1)
  })

  test("keeps which shelf each arrived on, since that is the whole Court", async () => {
    asGitHub(oneShelved)
    await readWorkingSet()

    offline()
    const sittings = Option.getOrThrow(await workingSetAgain())

    // `needs-action` is Needs You, and a row that came back without its shelf
    // would be drawn as somebody else's problem.
    expect(sittings[0]?.court).toBe("needs-you")
    expect(sittings[0]?.piles[0]?.one.shelf).toEqual(Option.some("needs-action"))
  })

  test("says nothing at all when a shelf is missing, rather than most of it", async () => {
    // A shelf that would not load is the one case where part of a Working Set
    // is on hand, and part of one is indistinguishable from the whole of one:
    // the reader has no way to see that the pull request they should be looking
    // at is the one that did not come back.
    asGitHub((url) =>
      url.includes("filter=merge-queue")
        ? new Response("not acceptable", { status: 406 })
        : oneShelved(url)
    )
    await readWorkingSet().catch(() => {})

    offline()

    expect(await workingSetAgain()).toEqual(Option.none())
  })

  test("gives back what each row changes, which is a read per row to find out", async () => {
    // Counting the lines is one request per pull request and about a second for a
    // page of them. Kept, the list opens with its sizes already on it; not kept,
    // every row spends that second without the one number that says how much
    // work it is.
    asGitHub(twoShelvedAndMeasured)
    await readWorkingSet()

    offline()
    const sittings = Option.getOrThrow(await workingSetAgain())

    expect(sittings[0]?.piles[0]?.one.size).toEqual(Option.some({ added: 40, deleted: 4 }))
  })

  test("gives back which rows are stacked, since that takes a merge box each", async () => {
    // Two pull requests where one is based on the other's branch. Finding that out
    // is a whole merge box per row, six rounds of them for a busy list, and it is
    // the difference between two rows and one row with another on top of it — so a
    // list drawn without it visibly rearranges itself a few seconds later.
    asGitHub(twoShelvedAndMeasured)
    await readWorkingSet()

    offline()
    const sittings = Option.getOrThrow(await workingSetAgain())

    expect(sittings[0]?.piles).toHaveLength(1)
    expect(sittings[0]?.piles[0]?.above).toHaveLength(1)
  })

  test("gives back how the checks stood, which is half of what decides the Court", async () => {
    /*
     * This used to be kept out, on the grounds that a rollup from half an hour ago is
     * drawn identically to one from a second ago. True, and the wrong trade: the rollup
     * is not only drawn, it is read — `courtOf` puts a green pull request nobody is
     * required to review under Needs You and a row with no rollup at all under Waiting.
     *
     * So a Working Set opened from memory sorted one way and re-sorted the moment the
     * live read landed, two seconds later, with rows crossing between headings. The
     * reader saw the list twice and neither time was wrong, which is worse than a
     * rollup that is a minute old under a toast that says it is being checked.
     */
    asGitHub(oneAwaitingReview)
    await readWorkingSet()

    offline()
    const sittings = Option.getOrThrow(await workingSetAgain())

    expect(sittings[0]?.piles[0]?.one.checks).toEqual(
      Option.some({ state: "passing", total: 2, passed: 2 })
    )
  })

  test("survives a reader browsing, which is what filled the store in the first place", async () => {
    /*
     * Eleven routes make up this page: six shelves, three kinds of involved issue, the
     * repository list the Rail draws and the activity feed. Every one of them has to be
     * on hand, because a Working Set missing a shelf is not shown at all.
     *
     * They used to share one index of twenty-four with every route a reader browses —
     * a repository's list page, a page of commits, a branch picker, an author picker,
     * four of them written per repository visited. So an afternoon of reading pushed
     * the shelves out one at a time, and the next visit to Home opened blank and sat
     * there for the two seconds the live read takes. Which is the flicker, and it came
     * and went with what the reader had been looking at.
     *
     * These eleven rewrite themselves rather than accumulating, so they cost a fixed
     * eleven slots forever. The browsing routes are the ones that grow without limit,
     * and they are the ones that should be evicting each other.
     */
    asGitHub(oneShelved)
    await readWorkingSet()

    for (let page = 1; page <= 40; page += 1) {
      await Effect.runPromise(rememberRoute(`/microsoft/vscode/commits/main?page=${page}`, { page }))
    }

    offline()

    expect(Option.isSome(await workingSetAgain())).toBe(true)
  })

  test("sorts it into the Court the live read puts it in, so nothing moves after", async () => {
    // The whole reason the rollup is kept. Passing checks on a shelf that means
    // nobody has answered yet is a live merge button, and without them the same
    // row reads as somebody else's problem.
    asGitHub(oneAwaitingReview)
    const live = await readWorkingSetAnswering()

    offline()
    const remembered = Option.getOrThrow(await workingSetAgain())

    expect(live[0]?.court).toBe("needs-you")
    expect(remembered.map((sitting) => sitting.court)).toEqual(
      live.map((sitting) => sitting.court)
    )
  })
})

const list: RepoList = { repo: { owner: "microsoft", repo: "vscode" }, query: "", page: 1 }

const readRepoList = async () => {
  await Effect.runPromise(loadRepoList(list).pipe(Effect.provide(layer)))
  await settle()
}

const repoListAgain = () =>
  Effect.runPromise(rememberedRepoList(list).pipe(Effect.provide(layer)))

describe("keeping a repository's list to open again", () => {
  test("has nothing to say about a page never read", async () => {
    offline()

    expect(await repoListAgain()).toEqual(Option.none())
  })

  test("gives the page back, pager and all, without asking GitHub again", async () => {
    asGitHub((url) => (url.includes("/pulls?q=") ? Response.json(queryPayload([aRow(1), aRow(2)])) : oneShelved(url)))
    await readRepoList()

    offline()
    const remembered = Option.getOrThrow(await repoListAgain())

    expect(rowsIn(remembered.sittings)).toBe(2)
    expect(remembered.pages).toEqual(Option.some({ current: 1, total: 3, count: 61 }))
  })

  test("still knows which of them are the reader's own", async () => {
    // The rows come from a plain query, which shelves nothing. Crossing them
    // with the shelves is what puts the reader's own pull requests in Needs You,
    // and a remembered page that skipped it would open with every row in the
    // wrong Court for the second before the live read lands.
    asGitHub((url) => (url.includes("/pulls?q=") ? Response.json(queryPayload([aRow(1), aRow(2)])) : oneShelved(url)))
    await readRepoList()

    offline()
    const remembered = Option.getOrThrow(await repoListAgain())

    expect(remembered.sittings[0]?.court).toBe("needs-you")
    expect(remembered.sittings[0]?.count).toBe(1)
  })

  test("opens with its stacks and its sizes, as the dashboard does", async () => {
    // The same two reads and the same argument: a page per row of merge boxes and
    // diffstats takes seconds, and without them a page opened again is the page
    // that was just there with its stacks flattened and its sizes gone.
    asGitHub((url) =>
      url.includes("/pulls?q=")
        ? Response.json(queryPayload([aRow(1), aRow(2)]))
        : twoShelvedAndMeasured(url)
    )
    await readRepoList()

    offline()
    const remembered = Option.getOrThrow(await repoListAgain())

    const piles = remembered.sittings.flatMap((sitting) => sitting.piles)
    expect(piles).toHaveLength(1)
    expect(piles[0]?.above).toHaveLength(1)
    expect(piles[0]?.one.size).toEqual(Option.some({ added: 40, deleted: 4 }))
  })

  test("keeps every page the complete read collected", async () => {
    asGitHub((url) => {
      if (!url.includes("/pulls?q=")) return oneShelved(url)
      const page = Number(new URL(url).searchParams.get("page") ?? "1")
      return Response.json(queryPayload([aRow(page)]))
    })
    await readRepoList()

    offline()
    const remembered = Option.getOrThrow(
      await Effect.runPromise(rememberedRepoList({ ...list, page: 2 }).pipe(Effect.provide(layer)))
    )

    expect(remembered.sittings[0]?.piles[0]?.one.reference.number).toBe(2)
  })
})
