import { Effect } from "effect"
import type { PullRequestRef } from "../domain/PullRequestRef"
import { GatewayError } from "../ports/GitHubGateway"
import { askingOnce } from "./flight"
import type { RawPayloads } from "./snapshot"

/**
 * Asking GitHub for a pull request, with no page underneath.
 *
 * Everything here is a GET of one of their JSON routes carrying the reader's own
 * cookies, and nothing here touches a `document`, a `window` or a token read off
 * their markup. That is the whole point of the file: the same seven reads run in
 * the content script on the page and in the service worker before the page
 * exists, and the worker cannot have a page.
 *
 * The rest of {@link GitHubGateway} stays where it is. Most of it parses their
 * HTML or signs a write with a nonce out of their `<head>`, and none of that can
 * leave the page.
 */

// GitHub answers 406 to these routes without the XMLHttpRequest header.
export const REQUIRED_HEADERS = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest"
}

/**
 * What one of GitHub's JSON routes said, as a value rather than as a failure.
 *
 * Every read of theirs goes wrong in one of these ways, and the reason has to
 * survive being carried between bundles by the promise several readers are sharing —
 * which is why it is here in the answer rather than beside it as a failure. Each
 * caller turns it back into its own kind of failure, which is where the difference
 * between them belongs.
 */
export type Said =
  | { readonly ok: true; readonly payload: unknown }
  | {
      readonly ok: false
      readonly why: "unreachable" | "rejected" | "down" | "undecodable" | "sign-on"
      readonly detail: string
    }

/**
 * Which of the three ways an answer that is not 200 can be not 200.
 *
 * GitHub answers 401 to their own JSON routes for a repository in an organisation
 * the reader has not signed on to, whether or not anybody is signed in — measured
 * on `/octo-org/octo-repo/pulls`, which answered 401 with an empty body to a
 * signed-in reader while the same route on a repository beside it answered 200.
 * The reader can walk through that one, so it is not filed with the rest.
 *
 * A 5xx is filed apart for a different reason: it is the only one of the three that
 * may be untrue a second later. Their crash page arrives as HTML under a 503 or a
 * 504 — `Unicorn! · GitHub` — and during the incident of 2026-08-17 it arrived on
 * about a fifth of every request made. That is the status {@link worthAnotherAsk}
 * asks again on, and the only one it does.
 */
export const refusedBy = (response: Response): "rejected" | "sign-on" | "down" => {
  if (response.status === 401) return "sign-on"
  return response.status >= 500 ? "down" : "rejected"
}

/**
 * Whether asking the same question again could get a different answer.
 *
 * The whole of the retry policy, and it is deliberately two cases. A 403, a 404 and a
 * payload in a shape nothing here can read are all facts that hold still: asking three
 * times costs the reader three round trips and tells them what the first one did. A
 * 5xx and a connection that never opened are the two that do not hold still.
 */
const worthAnotherAsk = (said: Said): boolean =>
  !said.ok && (said.why === "down" || said.why === "unreachable")

/**
 * How long to wait before asking again, in milliseconds, one entry per retry.
 *
 * Short, because a reader is watching. Two waits and three asks in total puts a
 * route's own odds of never answering during a one-in-five incident at about one in a
 * hundred and twenty-five, and the five required routes together at about 96%, for a
 * worst case of 900ms added to a read that was going to fail anyway.
 *
 * Rising rather than flat because the second ask is worth more the further it is from
 * the first: an incident that is going to clear in the next second clears during the
 * longer wait, and one that is not is not worth a third ask a fifth of a second later.
 *
 * No spreading, deliberately. A retry policy usually scatters its waits so a service
 * is not hit by every client at once; this is one reader's browser making a few dozen
 * requests, and it is not the crowd anybody would be protecting GitHub from.
 */
const WAITS = [200, 700] as const

/**
 * One GET of one of their JSON routes, asked again where that could help, folded
 * together with any identical GET already in the air.
 *
 * A read ahead and the press that follows it want the same six routes, and this is
 * where they become one set of requests rather than two. The retries are inside that
 * folding on purpose: everybody waiting on the address waits through them and gets
 * the answer, rather than each caller starting a run of asks of its own.
 */
export const saidAt = (url: string): Effect.Effect<Said> =>
  askingOnce(
    url,
    Effect.gen(function* () {
      let said = yield* asking(url)

      for (const wait of WAITS) {
        if (!worthAnotherAsk(said)) return said
        yield* Effect.sleep(wait)
        said = yield* asking(url)
      }

      return said
    })
  )

/** The ask itself, once, with every way it can go wrong in the answer. */
const asking = (url: string): Effect.Effect<Said> =>
  Effect.gen(function* () {
    const response = yield* Effect.tryPromise({
      try: () => fetch(url, { headers: REQUIRED_HEADERS, credentials: "include" }),
      catch: (cause): Said => ({ ok: false, why: "unreachable", detail: String(cause) })
    })

    if (!response.ok) {
      return yield* Effect.fail<Said>({
        ok: false,
        why: refusedBy(response),
        detail: `HTTP ${response.status}`
      })
    }

    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause): Said => ({ ok: false, why: "undecodable", detail: String(cause) })
    })

    return { ok: true, payload } satisfies Said
  }).pipe(Effect.catch(Effect.succeed))

export const CHANGES = "/changes"
const STATUS_CHECKS = "/page_data/status_checks"
/**
 * The merge box, asked without naming a way of merging.
 *
 * The method is not ours to choose here, and naming one was read as a question
 * about that method: GitHub weighs every rule against whatever is in this
 * parameter, so `merge_method=MERGE` on a squash-only repository came back with
 * two separate conditions refusing a merge commit — the repository setting and
 * the base branch ruleset — over a button that squashes. Ahmed reported the pair
 * of them on `OpenRouterInternal/ori`.
 *
 * Left out, GitHub weighs the repository's own default, which is what their page
 * opens on. Measured on `flazouh/ghpro-scratch#12` with merge commits turned
 * off: `MERGE` answers `UNMERGEABLE` with one failed condition, `SQUASH` and no
 * method at all both answer `MERGEABLE` with none. A method GitHub cannot read
 * is not ignored the way the auto-merge route ignores one — `merge_method=NOT_A_METHOD`
 * answers 500 — so this parameter is either right or absent.
 *
 * Which method a press then sends is read out of the answer, off the direct
 * merge's own list of allowed methods. See `landingMethod` in `snapshot.ts`.
 */
export const MERGE_BOX = "/page_data/merge_box?bypass_requirements=false"
// The stack GitHub would make out of this pull request, which is the only place
// that state is knowable from — their merge box says the same thing about a pull
// request that can be stacked and one with nothing to stack. A few hundred bytes,
// and `null` where there is nothing to offer. See `PreviewStackRoute`.
export const PREVIEW_STACK = "/page_data/preview_stack"
const DESCRIPTION = "/page_data/description"
const HEADER = "/page_data/header"
// The only route that carries the bodies of what was said on the timeline. Its
// neighbour `page_data/timeline` lists the same items by id and type with no
// text, which is why reading the conversation needs this one and not that.
export const ISSUE_COMMENTS = "/page_data/issue_comments"

const routeFor = (reference: PullRequestRef, route: string): string =>
  `https://github.com/${reference.owner}/${reference.repo}/pull/${reference.number}${route}`

export const fetchRoute = Effect.fn("fetchRoute")(function* (
  reference: PullRequestRef,
  route: string
) {
  const said = yield* saidAt(routeFor(reference, route))
  if (!said.ok) {
    return yield* new GatewayError({ reference, route, reason: said.why, detail: said.detail })
  }

  return said.payload
})

/**
 * The same GET, for a route whose answer the pull request can do without.
 *
 * A refusal, an unreachable network and a body nothing can read all arrive here as
 * nothing, and the mapper draws the pull request with that region absent.
 *
 * Three routes are asked this way. `preview_stack` carries a strip above the header
 * saying that these two pull requests could be one stack, and refusing the whole page
 * over it would trade the pull request for a decoration. `header` carries three
 * moments — opened, closed, landed — which are already an Option apiece on the
 * snapshot, because the age beside a badge is worth less than the pull request under
 * it. `merge_box` carries the card, and its absence is the one the reader is told
 * about in words rather than by a line going missing.
 *
 * `changes` is the counter-example and stays required: it is the title, the state, the
 * files, the commits and the threads, so there is no page to draw without it.
 *
 * What decides which list a route belongs to is whether a reader could act on a wrong
 * answer, not how much the route carries. A missing check or a missing thread is a
 * pull request that looks finished, which is a lie in the right shape and stays a
 * refusal. A missing merge box carries more than either and is still safe here,
 * because the snapshot holds it as None and nothing downstream can read an answer out
 * of that.
 */
const whateverIsAt = Effect.fn("whateverIsAt")(function* (
  reference: PullRequestRef,
  route: string
) {
  const said = yield* saidAt(routeFor(reference, route))

  return said.ok ? said.payload : null
})

/**
 * One pull request as GitHub's own page asks for it: seven routes at once.
 *
 * The only read in the extension that runs in two places. In the service worker it
 * runs the moment the tab starts navigating, which is a second or more before their
 * HTML answers and before any content script of ours exists to run it; on the page
 * it is what `GitHubGateway.snapshot` falls back on when there is no worker to ask.
 * `askingOnce` folds them into one set of requests where two overlap in one context.
 *
 * Payloads rather than a snapshot, because a snapshot is full of `Option`s that no
 * structured clone would survive and the store keeps payloads for the same reason.
 * Decoding is the caller's, on the page, where a failure has a reader to tell.
 */
export const payloadsFor = (
  reference: PullRequestRef
): Effect.Effect<RawPayloads, GatewayError> =>
  Effect.all(
    {
      changes: fetchRoute(reference, CHANGES),
      statusChecks: fetchRoute(reference, STATUS_CHECKS),
      mergeBox: whateverIsAt(reference, MERGE_BOX),
      description: fetchRoute(reference, DESCRIPTION),
      header: whateverIsAt(reference, HEADER),
      issueComments: fetchRoute(reference, ISSUE_COMMENTS),
      preview: whateverIsAt(reference, PREVIEW_STACK)
    },
    { concurrency: "unbounded" }
  )
