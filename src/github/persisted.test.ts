import { describe, expect, test } from "bun:test"
import { Effect, Option } from "effect"
import {
  askedFor,
  hashIn,
  hashOfMutation,
  hashOfMutationIn,
  nonceOn,
  releaseOn,
  whenAsked
} from "./persisted"

/** One resource entry as the browser records it, which is a name and nothing else. */
const asked = (name: string, hash: string, variables: Record<string, unknown> = {}): string =>
  `https://github.com/_graphql?body=${encodeURIComponent(
    JSON.stringify({ persistedQueryName: name, query: hash, variables })
  )}`

const timings = (...names: ReadonlyArray<string>) => ({
  getEntriesByType: () => names.map((name) => ({ name }))
})

describe("the hashes GitHub's own page asks its GraphQL route by", () => {
  test("reads a query's name and the hash beside it", () => {
    const asks = askedFor(timings(asked("IssueViewerViewQuery", "bd6422dd")))

    expect(asks.get("IssueViewerViewQuery")).toBe("bd6422dd")
  })

  test("ignores everything that is not that route", () => {
    const asks = askedFor(
      timings(
        "https://github.com/react/react/issues/35000",
        "https://github.githubassets.com/assets/chunk.js",
        asked("IssueViewerViewQuery", "bd6422dd")
      )
    )

    expect([...asks.keys()]).toEqual(["IssueViewerViewQuery"])
  })

  test("ignores a body that will not read, rather than losing the ones that will", () => {
    // Their route is theirs and the shape of it is not promised. A single entry
    // this cannot parse is one query gone, never the whole harvest.
    const asks = askedFor(
      timings(
        "https://github.com/_graphql?body=not-json",
        "https://github.com/_graphql",
        asked("IssueViewerViewQuery", "bd6422dd")
      )
    )

    expect(asks.get("IssueViewerViewQuery")).toBe("bd6422dd")
  })

  test("the last answer wins, which is the one a deploy left behind", () => {
    // Entries are in the order they happened. GitHub deploying while a tab is
    // open changes every hash, and the stale one 404s with `unknownQuery`.
    const asks = askedFor(
      timings(asked("IssueViewerViewQuery", "older"), asked("IssueViewerViewQuery", "newer"))
    )

    expect(asks.get("IssueViewerViewQuery")).toBe("newer")
  })

  test("says nothing about a query this page never asked for", () => {
    expect(hashIn(timings(), "IssueViewerViewQuery")).toEqual(Option.none())
  })

  test("answers with the hash where the page did ask", () => {
    expect(hashIn(timings(asked("IssueViewerViewQuery", "bd6422dd")), "IssueViewerViewQuery")).toEqual(
      Option.some("bd6422dd")
    )
  })
})

describe("waiting for a hash the page has not asked by yet", () => {
  /**
   * A page that records nothing until it is told to, which is the shape of the
   * fault this covers: our screen starts at `document_start` and GitHub's own
   * app asks its route some hundreds of milliseconds later.
   */
  const recording = () => {
    const names: Array<string> = []
    const listeners = new Set<(seen: ReadonlyArray<string>) => void>()

    return {
      timings: { getEntriesByType: () => names.map((name) => ({ name })) },
      watch: (onSeen: (seen: ReadonlyArray<string>) => void) => {
        listeners.add(onSeen)
        return () => listeners.delete(onSeen)
      },
      record: (name: string) => {
        names.push(name)
        for (const listener of listeners) listener([name])
      }
    }
  }

  test("answers at once where the page already asked", async () => {
    const page = recording()
    page.record(asked("IssueViewerViewQuery", "bd6422dd"))

    const found = await Effect.runPromise(
      whenAsked(page.timings, page.watch, "IssueViewerViewQuery", "1 second")
    )

    expect(found).toEqual(Option.some("bd6422dd"))
  })

  test("answers when the page asks, which is after this was called", async () => {
    const page = recording()

    const waiting = Effect.runPromise(
      whenAsked(page.timings, page.watch, "IssueViewerViewQuery", "1 second")
    )
    // A turn later, as GitHub's own app is: the wait has to be listening by now.
    await Promise.resolve()
    page.record(asked("IssueViewerViewQuery", "bd6422dd"))

    expect(await waiting).toEqual(Option.some("bd6422dd"))
  })

  test("ignores the other queries their page asks on the way", () => {
    // Their issue page fires three, and two of them are not this one. Waiting
    // has to keep waiting through those rather than give up on the first entry.
    const page = recording()

    const waiting = Effect.runPromise(
      whenAsked(page.timings, page.watch, "IssueViewerViewQuery", "1 second")
    )
    page.record(asked("IssueViewerSecondaryViewQuery", "99f020ca"))

    return Promise.resolve().then(() => {
      page.record(asked("IssueViewerViewQuery", "bd6422dd"))
      return expect(waiting).resolves.toEqual(Option.some("bd6422dd"))
    })
  })

  test("gives up rather than hanging, where the page never asks", async () => {
    // The read then fails the way it failed before this existed, which the
    // screen already answers by handing the page back to GitHub.
    const page = recording()

    expect(
      await Effect.runPromise(whenAsked(page.timings, page.watch, "IssueViewerViewQuery", "10 millis"))
    ).toEqual(Option.none())
  })

  test("stops listening once it has an answer", async () => {
    const page = recording()
    page.record(asked("IssueViewerViewQuery", "bd6422dd"))

    await Effect.runPromise(whenAsked(page.timings, page.watch, "IssueViewerViewQuery", "1 second"))
    // Nothing left behind on a page this extension does not own. Recording
    // again would throw if the listener had been dropped rather than removed.
    page.record(asked("IssueViewerViewQuery", "newer"))
  })
})

describe("what the page says about itself", () => {
  const page = (name: string, content: string) => ({
    querySelector: (selector: string) =>
      selector.includes(name) ? { getAttribute: () => content } : null
  })

  test("reads the nonce their route refuses to answer without", () => {
    expect(nonceOn(page("fetch-nonce", "v2:6bf077cd") as never)).toEqual(Option.some("v2:6bf077cd"))
  })

  test("reads the deploy the hashes belong to", () => {
    // What a remembered hash is filed under. GitHub ships many times a day and
    // a hash outlives its deploy by nothing at all.
    expect(releaseOn(page("release", "e9c0afb3") as never)).toEqual(Option.some("e9c0afb3"))
  })

  test("says nothing where the page carries neither", () => {
    const bare = { querySelector: () => null } as never
    expect(nonceOn(bare)).toEqual(Option.none())
    expect(releaseOn(bare)).toEqual(Option.none())
  })
})

describe("the hash of a mutation, which their page never says out loud", () => {
  /** One operation as Relay writes it into a chunk. */
  const written = (name: string, hash: string, kind = "mutation"): string =>
    `params:{id:"${hash}",metadata:{},name:"${name}",operationKind:"${kind}",text:null}}`

  const HASH = "59355b9ba02eb93a5090ead97e4236e9"

  test("reads the id Relay wrote beside the name", () => {
    expect(hashOfMutation(written("createIssueMutation", HASH), "createIssueMutation")).toEqual(
      Option.some(HASH)
    )
  })

  test("takes the id of the operation asked about, not of the one before it", () => {
    // A chunk holds dozens of these end to end, all the same shape.
    const chunk = [
      written("addCommentMutation", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
      written("createIssueMutation", HASH),
      written("closeIssueMutation", "cccccccccccccccccccccccccccccccc")
    ].join("")

    expect(hashOfMutation(chunk, "createIssueMutation")).toEqual(Option.some(HASH))
  })

  test("still finds it where their metadata stops being empty", () => {
    const moved = `params:{id:"${HASH}",metadata:{connection:[{count:null}]},name:"createIssueMutation",operationKind:"mutation"`

    expect(hashOfMutation(moved, "createIssueMutation")).toEqual(Option.some(HASH))
  })

  test("is nothing for a name the chunk does not carry", () => {
    expect(hashOfMutation(written("addCommentMutation", HASH), "createIssueMutation")).toEqual(
      Option.none()
    )
  })

  test("is nothing where the name is a query rather than a mutation", () => {
    // Their fragment and their operation carry the same name as the request does,
    // and neither of those has a hash beside it.
    const query = written("createIssueMutation", HASH, "query")

    expect(hashOfMutation(query, "createIssueMutation")).toEqual(Option.none())
  })
})

describe("finding that hash in the scripts a page has loaded", () => {
  const HASH = "59355b9ba02eb93a5090ead97e4236e9"

  const chunk = `params:{id:"${HASH}",metadata:{},name:"createIssueMutation",operationKind:"mutation"`

  const reading = (held: Record<string, string>) => {
    const read: Array<string> = []
    return {
      read,
      reading: (at: string) => {
        read.push(at)
        return Effect.succeed(Option.fromNullishOr(held[at]))
      }
    }
  }

  const scripts = (...names: ReadonlyArray<string>) => timings(...names)

  test("hands back the hash out of whichever chunk carries it", async () => {
    const { reading: read } = reading({ "https://assets/b.js": chunk })

    const found = await Effect.runPromise(
      hashOfMutationIn(
        scripts("https://assets/a.js", "https://assets/b.js"),
        read,
        "createIssueMutation"
      )
    )

    expect(found).toEqual(Option.some(HASH))
  })

  test("reads nothing that is not a script, which is most of what a page loads", async () => {
    const { read, reading: reader } = reading({ "https://assets/a.js": chunk })

    await Effect.runPromise(
      hashOfMutationIn(
        scripts("https://assets/style.css", "https://assets/face.png", "https://assets/a.js"),
        reader,
        "createIssueMutation"
      )
    )

    expect(read).toEqual(["https://assets/a.js"])
  })

  test("stops once it has the hash rather than reading the rest", async () => {
    // Eleven, so that the twelfth is in a batch after the one that answers.
    const names = Array.from({ length: 12 }, (_, at) => `https://assets/${at}.js`)
    const { read, reading: reader } = reading({ "https://assets/0.js": chunk })

    await Effect.runPromise(hashOfMutationIn(scripts(...names), reader, "createIssueMutation"))

    expect(read).toHaveLength(10)
  })

  test("is nothing where no chunk names it, rather than a failure", async () => {
    // Their bundle is theirs and they reshuffle it weekly. A shape that has moved
    // has to be an answer, because the caller has GitHub's own form to fall back on.
    const { reading: reader } = reading({ "https://assets/a.js": "no operations here" })

    const found = await Effect.runPromise(
      hashOfMutationIn(scripts("https://assets/a.js"), reader, "createIssueMutation")
    )

    expect(found).toEqual(Option.none())
  })

  test("goes on past a chunk that would not read", async () => {
    const { reading: reader } = reading({ "https://assets/b.js": chunk })

    const found = await Effect.runPromise(
      hashOfMutationIn(
        scripts("https://assets/gone.js", "https://assets/b.js"),
        reader,
        "createIssueMutation"
      )
    )

    expect(found).toEqual(Option.some(HASH))
  })
})
