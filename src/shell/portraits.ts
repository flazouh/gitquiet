import { Deferred, Effect, Option } from "effect"
import type { Portrait } from "../domain/portrait"
import { layer as gatewayLayer } from "../github/GitHubGateway"
import { GitHubGateway } from "../ports/GitHubGateway"
import { aboutRepository } from "../github/hovercard"
import type { Count, Look, Portraits } from "../ui/portraits"

/**
 * Hovercards as this extension can read them: GitHub's own card routes, from a
 * script running inside their page.
 *
 * Here rather than beside the component that draws them, because these two reads
 * are the whole of what a face knows and neither is available anywhere but on
 * github.com. They go through the gateway's live layer, which sends the session
 * cookies the routes require, and they read the page's own markup for the
 * repository the card should be about. An interface served from anywhere else has
 * to answer both questions differently, and `ui/portraits` is where it says so.
 */

/**
 * The repository this page is about, where it is about one.
 *
 * GitHub writes its numeric id into the head of every page under a repository,
 * and the id is the only handle their card accepts — a name in that parameter is
 * accepted and quietly ignored. Worth the DOM read: with it, the card's one line
 * becomes how recently this person touched *this* repository instead of a list of
 * organisations nobody was asking about.
 */
export const repositoryOnPage = (): Option.Option<string> => {
  const id = document
    .querySelector('meta[name="octolytics-dimension-repository_id"]')
    ?.getAttribute("content")
  return id === null || id === undefined || id === ""
    ? Option.none()
    : Option.some(aboutRepository(id))
}

/**
 * One read per key, however many faces ask for it.
 *
 * The answer is kept, and so is the asking: two rows by the same author hovered
 * in quick succession wait on the one request rather than sending two. A face
 * that leaves the screen mid-read interrupts nothing — the read belongs to the
 * map, not to whoever happened to ask first.
 */
const shared = <A>(
  held: Map<string, Deferred.Deferred<A>>,
  key: string,
  work: Effect.Effect<A>
): Effect.Effect<A> =>
  Effect.suspend(() => {
    const already = held.get(key)
    if (already !== undefined) return Deferred.await(already)

    const asking = Deferred.makeUnsafe<A>()
    held.set(key, asking)
    Effect.runFork(
      Effect.flatMap(work, (answer) =>
        Effect.sync(() => Deferred.doneUnsafe(asking, Effect.succeed(answer)))
      )
    )
    return Deferred.await(asking)
  })

/**
 * Everybody already looked up, so a list of twenty-five faces costs at most
 * twenty-five reads however many times the cursor crosses them.
 *
 * Module-level and never cleared: a page lives minutes, a profile changes in
 * months, and the alternative is asking GitHub the same question every time a
 * mouse passes.
 */
const looked = new Map<string, Deferred.Deferred<Option.Option<Portrait>>>()

const askGitHub: Look = (login) =>
  Effect.suspend(() => {
    const about = repositoryOnPage()
    return shared(
      looked,
      `${login}|${Option.getOrElse(about, () => "")}`,
      Effect.flatMap(GitHubGateway, (gateway) => gateway.portrait(login, about)).pipe(
        Effect.provide(gatewayLayer),
        // A card that will not load is a card that is not drawn. There is
        // nothing here worth interrupting a reader over.
        Effect.orElseSucceed(() => Option.none<Portrait>())
      )
    )
  })

/** Counts already read, remembered for the same reasons {@link looked} is. */
const counted = new Map<string, Deferred.Deferred<Option.Option<number>>>()

const countGitHub: Count = (login) =>
  shared(
    counted,
    login,
    Effect.flatMap(GitHubGateway, (gateway) => gateway.contributions(login)).pipe(
      Effect.provide(gatewayLayer),
      Effect.orElseSucceed(() => Option.none<number>())
    )
  )

/** What every interface this extension puts on a GitHub page provides. */
export const onGitHub: Portraits = { look: askGitHub, count: countGitHub }
