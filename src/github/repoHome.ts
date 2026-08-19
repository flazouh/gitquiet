/**
 * A repository's front page, in this codebase's words.
 *
 * One payload carries the whole page, and it is the same one their own code view
 * reads. What it costs is dominated by a single field: the README arrives already
 * rendered, and on a well-documented repository that is three hundred kilobytes of
 * the three hundred and thirty. Nothing in this module reads it, measures it,
 * escapes it or copies it — it is passed from the payload to the screen as the same
 * string, and the screen hands it to the browser's parser once.
 *
 * The other rule here is that nothing waits. The tree is drawn from this payload
 * and the commit column arrives from a second request behind it, so a file list is
 * on the screen in one round trip rather than two.
 */

import { Effect, Option } from "effect"
import type {
  About,
  Entry,
  Front,
  Kind,
  RepoHome,
  Starring,
  Touch,
  TouchWho,
  Welcome
} from "../domain/repoHome"
import { footingOf, inReadingOrder, repoHomeIn } from "../domain/repoHome"
import { plainText } from "./plainText"
import {
  CodeViewLocation,
  CodeViewRepository,
  LatestCommitRoute,
  RepoAbout,
  RepoFooting,
  RepoTree,
  TreeCommitInfoRoute,
  TreeListRoute
} from "./wire"
import { maybeAmong, whereverAmong, whereverItIs } from "./wherever"

/**
 * The three facts a front page is drawn from, each found on its own.
 *
 * The tree is the page and is required. The About panel and the footing are two more of
 * GitHub's payloads in the same document, and a page draws without either: no About
 * panel, and a reader treated as a Caller, which is the safe way round.
 */
export const findTheTree = whereverAmong(RepoTree)
const findTheLocation = maybeAmong(CodeViewLocation)
const findTheRepository = maybeAmong(CodeViewRepository)
export const findTheAbout = maybeAmong(RepoAbout)
export const findTheFooting = maybeAmong(RepoFooting)
export const decodeTreeCommitInfo = whereverItIs(TreeCommitInfoRoute)
export const decodeTreeList = whereverItIs(TreeListRoute)
export const decodeLatestCommit = whereverItIs(LatestCommitRoute)

type WireEntry = RepoTree["tree"]["items"][number]

/**
 * The three kinds GitHub sends, and a fourth answer for anything it starts sending.
 *
 * An unknown kind is drawn as a file rather than refused. A row for something this
 * codebase has no word for is still a row a reader can press, and a payload with one
 * new value in it should not cost the whole file list.
 */
const kindOf = (entry: WireEntry): Kind =>
  entry.contentType === "directory" || entry.contentType === "submodule"
    ? entry.contentType
    : "file"

const entryFrom = (entry: WireEntry): Entry => ({
  name: entry.name,
  path: entry.path,
  kind: kindOf(entry),
  touched: Option.none()
})

/**
 * The README, where the payload carried one.
 *
 * The first of the overview files and not a search for one. GitHub decides which
 * file is the front of a repository — README, readme.md, docs/README.rst, and the
 * precedence between them — and reproducing that rule here would be a second
 * opinion that disagrees with theirs on some repository nobody tests.
 */
const welcomeFrom = (
  overview: RepoTree["overview"]
): Option.Option<Welcome> => {
  const file = overview?.overviewFiles?.[0]
  if (file === undefined) return Option.none()

  const html = file.richText ?? ""
  // Rendered to nothing and not timed out is a payload with no README in it,
  // which is not the same as a repository whose README failed to render.
  if (html.length === 0 && file.timedOut !== true) return Option.none()

  return Option.some({
    name: file.displayName,
    path: file.path,
    html,
    timedOut: file.timedOut === true
  })
}

/**
 * Where the reader stands with the star, from the two fields GitHub sends.
 *
 * Starred wins over barred, which is the order that matters: a reader can have
 * starred something they may no longer star — an archived repository is the case
 * — and drawing that as nothing would quietly lose a star they gave.
 */
const starringFrom = (star: { viewerHasStarred?: boolean | null; canStar?: boolean | null } | null | undefined): Starring => {
  if (star?.viewerHasStarred === true) return "starred"
  return star?.canStar === true ? "unstarred" : "barred"
}

const aboutFrom = (sidebar: RepoAbout | undefined): About => ({
  description: Option.fromNullishOr(sidebar?.description),
  stars: Option.fromNullishOr(sidebar?.stargazerCount),
  forks: Option.fromNullishOr(sidebar?.forksCount),
  topics: (sidebar?.topics ?? []).map((topic) => topic.name),
  starring: starringFrom(sidebar?.star)
})

/**
 * Where the reader stands, from the one field that says so.
 *
 * Absent from every JSON answer and present in a loaded document, which is measured
 * rather than assumed — see the note on `codeViewLayoutRoute` in `wire.ts`. Absent
 * means Caller here, and that is the safe way round: a Keeper shown the welcome
 * first has to scroll past a README they wrote, and a Caller shown the file list
 * first is the page GitHub already gives everybody.
 */
const footingFrom = (layout: RepoFooting | undefined): ReturnType<typeof footingOf> =>
  footingOf(layout?.repo?.currentUserCanPush === true)

/**
 * How many commits the branch has, whichever way GitHub spelled it.
 *
 * Their payload sends `"140"` rather than `140`, and `"2,488"` once a branch has
 * more than a thousand: the field is already grouped for a reader, because their
 * own page prints it straight into the Commits button. So the separators go
 * before the number is read. Nothing where it is not a number after all — a count
 * drawn as `NaN` is worse than no count.
 */
const countFrom = (count: number | string | null | undefined): Option.Option<number> => {
  if (count === null || count === undefined) return Option.none()
  const many = typeof count === "number" ? count : Number(count.replace(/[,\s]/g, ""))
  return Number.isFinite(many) ? Option.some(many) : Option.none()
}

export const frontFrom = (
  repo: { readonly owner: string; readonly repo: string },
  payloads: ReadonlyArray<unknown>
): Effect.Effect<Front, unknown> =>
  Effect.map(findTheTree(payloads), (page) => ({
    repo,
    footing: footingFrom(Option.getOrUndefined(findTheFooting(payloads))),
    branch: page.refInfo.name,
    head: page.refInfo.currentOid,
    entries: inReadingOrder(page.tree.items.map(entryFrom)),
    welcome: welcomeFrom(page.overview),
    about: aboutFrom(Option.getOrUndefined(findTheAbout(payloads))),
    commits: countFrom(page.overview?.commitCount)
  }))

/**
 * Where their code view puts its data in a document it rendered.
 *
 * Read off the live page rather than out of its HTML, which is the difference
 * between reading one script's text and re-reading a third of a megabyte of
 * markup the browser has already parsed once.
 */
const EMBEDDED = 'react-app[app-name="code-view"] script[type="application/json"]'

const unescaped = (segment: string): string =>
  Option.getOrElse(Option.liftThrowable(decodeURIComponent)(segment), () => segment)

/**
 * A repository address with GitHub's resolved branch and path.
 *
 * The URL alone cannot separate `feat/x` from `feat` plus `x/file.ts`. GitHub
 * already resolved that choice in the code-view payload, so this reads the
 * answer from the loaded document. Nothing while GitHub still holds data for
 * the previous page, because guessing would read a different file.
 */
export const repoHomeInDocument = (url: string, doc: Document): Option.Option<RepoHome> => {
  const parsed = repoHomeIn(url)
  if (Option.isNone(parsed) || parsed.value.branch === null) return parsed

  const script = doc.querySelector(EMBEDDED)
  if (script === null) return Option.none()

  const raw = Option.liftThrowable(JSON.parse)(script.textContent ?? "")
  if (Option.isNone(raw)) return Option.none()

  const location = findTheLocation([raw.value])
  if (Option.isNone(location)) return Option.none()

  const repository = findTheRepository([raw.value])
  if (
    Option.isSome(repository) &&
    (repository.value.repo.ownerLogin.toLowerCase() !== parsed.value.repo.owner.toLowerCase() ||
      repository.value.repo.name.toLowerCase() !== parsed.value.repo.repo.toLowerCase())
  ) return Option.none()

  const address = URL.parse(url)
  if (address === null) return Option.none()

  const routeTail = address.pathname
    .split("/")
    .filter((part) => part.length > 0)
    .slice(3)
    .map(unescaped)
    .join("/")
  const resolvedPath = location.value.path === "/" ? "" : location.value.path
  const resolvedTail = [location.value.refInfo.name, resolvedPath]
    .filter((part) => part.length > 0)
    .join("/")
  if (routeTail !== resolvedTail) return Option.none()

  return Option.some({
    repo: parsed.value.repo,
    branch: location.value.refInfo.name,
    reading: resolvedPath === "" ? null : resolvedPath
  })
}

/**
 * The front page out of the document the reader is already looking at.
 *
 * The fast path, and the reason this page can cost nothing at all. A reader who
 * loaded `/owner/repo` has the whole payload in the page — the tree, the rendered
 * README, the About panel and the one field saying whether they can push — so
 * there is no request to make and nothing to wait for.
 *
 * Nothing where the document is not this repository's. GitHub navigates between
 * repositories without loading a page, so a document that once held this payload
 * may now be holding another repository's, and drawing that one under this
 * address would be worse than a blank page.
 */
export const frontInDocument = Effect.fn("repoHome.frontInDocument")(function* (
  repo: { readonly owner: string; readonly repo: string },
  branch: string | null,
  doc: Document
) {
  const script = doc.querySelector(EMBEDDED)
  if (script === null) return Option.none<Front>()

  const raw = Option.liftThrowable(JSON.parse)(script.textContent ?? "")
  if (Option.isNone(raw)) return Option.none<Front>()

  return yield* frontFrom(repo, [raw.value]).pipe(
    Effect.filterOrFail(
      (front) => branch === null || front.branch === branch,
      () => "another branch is in the document" as const
    ),
    Effect.map(Option.some),
    // Not an error worth reporting. The payload belongs to whatever page this
    // document last was, and the live read is the answer either way.
    Effect.catch(() => Effect.succeed(Option.none<Front>()))
  )
})

/**
 * A front page as the store holds it: plain data, and no README.
 *
 * Two reasons it is its own shape rather than the domain one written straight out.
 *
 * The welcome is dropped. It is three hundred kilobytes on a repository worth
 * reading, against a store that keeps twenty-four browsed routes of a couple of
 * kilobytes each — keeping it would spend seven megabytes to save one request and
 * would slow every other read from that store. The tree and the footing are what
 * make the page appear at once; the welcome arrives with the live read behind it.
 *
 * And an `Option` does not survive the round trip. It goes in as an object with a
 * tag and comes back as one, so anything reading it with `Option.isSome` is
 * reading a shape that only resembles the one it wants. Nulls go in, and the
 * `Option`s are built again on the way out where the types are checked.
 */
export type KeptFront = {
  readonly footing: Front["footing"]
  readonly branch: string
  readonly head: string
  readonly entries: ReadonlyArray<{
    readonly name: string
    readonly path: string
    readonly kind: Kind
  }>
  readonly about: {
    readonly description: string | null
    readonly stars: number | null
    readonly forks: number | null
    readonly topics: ReadonlyArray<string>
    readonly starring: Starring
  }
  readonly commits: number | null
}

export const keptFrom = (front: Front): KeptFront => ({
  footing: front.footing,
  branch: front.branch,
  head: front.head,
  entries: front.entries.map((one) => ({ name: one.name, path: one.path, kind: one.kind })),
  about: {
    description: Option.getOrNull(front.about.description),
    stars: Option.getOrNull(front.about.stars),
    forks: Option.getOrNull(front.about.forks),
    topics: front.about.topics,
    starring: front.about.starring
  },
  commits: Option.getOrNull(front.commits)
})

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * Checked rather than trusted because the store outlives the code: an entry
 * written by a version of this extension that has since been updated is exactly
 * the shape that would otherwise be handed to the screen and fail there.
 */
export const isKeptFront = (value: unknown): value is KeptFront => {
  if (typeof value !== "object" || value === null) return false
  const kept: Partial<KeptFront> = value
  return (
    (kept.footing === "keeper" || kept.footing === "caller") &&
    typeof kept.branch === "string" &&
    typeof kept.head === "string" &&
    Array.isArray(kept.entries) &&
    typeof kept.about === "object" &&
    kept.about !== null
  )
}

export const frontFromKept = (
  repo: { readonly owner: string; readonly repo: string },
  kept: KeptFront
): Front => ({
  repo,
  footing: kept.footing,
  branch: kept.branch,
  head: kept.head,
  entries: kept.entries.map((one) => ({ ...one, touched: Option.none() })),
  // Nothing, always: it was dropped on the way in, and the live read is what
  // brings it back. A page opened from the store shows its tree at once and its
  // README a moment later, which is the right way round for both readers.
  welcome: Option.none(),
  about: {
    description: Option.fromNullishOr(kept.about.description),
    stars: Option.fromNullishOr(kept.about.stars),
    forks: Option.fromNullishOr(kept.about.forks),
    topics: kept.about.topics,
    /*
     * Remembered, like everything else on this card.
     *
     * This was blanked at first, on the grounds that a reader can star something
     * in another tab and come back to a button that would unstar it. That
     * happens, and it is rare, and the price of guarding against it was paid on
     * every single load: no star at all until the live read landed. The live
     * read overwrites this a moment later either way.
     */
    starring: kept.about.starring
  },
  commits: Option.fromNullishOr(kept.commits)
})

/**
 * The headline out of the anchor GitHub sends instead of a message.
 *
 * There is no plain copy of it anywhere in the payload: the field is an `<a>` with
 * the issue and commit references already linked, and sometimes that anchor is
 * wrapped in an object with the string under `value`. The visible text is often
 * cut with an ellipsis. The `title` on the same anchor is the full headline,
 * then a blank line, then the body — so the first line of that is what a hover
 * should say, and what this returns.
 *
 * Read with the same unescaper the commit list uses rather than with a parser —
 * this runs once per row, and a thousand-entry repository would be a thousand
 * throwaway documents.
 */
const saidIn = (link: string | { readonly value: string } | null | undefined): string => {
  if (link === null || link === undefined) return ""
  const html = typeof link === "string" ? link : link.value
  const titled = html.match(/\btitle="([^"]*)"/)
  const headline = titled?.[1]?.split("\n")[0]
  if (headline !== undefined && headline !== "") return plainText(headline)
  return plainText(html)
}

/**
 * What last touched each path, ready to be written onto the tree.
 *
 * A Map rather than the record it arrived as, because the caller looks up one path
 * per row and a record lookup on a thousand-key object built by `JSON.parse` is
 * slower than a Map built once.
 */
const whoFrom = (
  author:
    | string
    | {
        readonly login?: string | null
        readonly avatarUrl?: string | null
      }
    | null
    | undefined
): Option.Option<TouchWho> => {
  if (author == null) return Option.none()
  if (typeof author === "string") {
    return author === "" ? Option.none() : Option.some({ login: author, face: Option.none() })
  }
  const login = author.login
  if (login == null || login === "") return Option.none()
  return Option.some({
    login,
    face: Option.fromNullishOr(author.avatarUrl ?? undefined)
  })
}

/**
 * Who wrote one commit, off the route that answers that and nothing else.
 *
 * The name where the email belongs to no account, rather than nobody. GitHub
 * sends a real display name and a gravatar for those commits, and a column that
 * dropped them would go blank on exactly the rows a reader cannot work out for
 * themselves.
 *
 * Nothing where the answer is about another commit. That route means "the latest
 * commit at this ref, under this path", so a path left on the end answers about
 * a different one — and a face taken from it would name the wrong person on
 * every row of the folder.
 */
export const wroteIn = (sha: string, route: LatestCommitRoute): Option.Option<TouchWho> => {
  if (route.oid != null && route.oid !== sha) return Option.none()

  const person = route.author ?? route.authors?.[0]
  if (person == null) return Option.none()

  const named = person.login ?? person.displayName
  if (named == null || named === "") return Option.none()

  return Option.some({ login: named, face: Option.fromNullishOr(person.avatarUrl ?? undefined) })
}

export const touchesFrom = (
  route: TreeCommitInfoRoute,
  folder = ""
): ReadonlyMap<string, Touch> =>
  new Map(
    Object.entries(route.entries).map(([path, entry]) => [
      folder === "" ? path : `${folder}/${path}`,
      {
        at: entry.date,
        said: saidIn(entry.shortMessageHtmlLink),
        url: entry.url,
        oid: Option.some(entry.oid),
        who: whoFrom(entry.author)
      }
    ])
  )
