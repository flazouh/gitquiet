import { Option } from "effect"

/**
 * A repository's front page — `/owner/repo`.
 *
 * The page the rest of GitHub links to, and the one its own readers have argued
 * about for thirteen years. The argument is in `docs/spec/repo-home.md` with the
 * counts; the short of it is that two people arrive here wanting opposite things
 * and GitHub serves them the same page. A stranger came to find out what this is
 * and meets a list of dotfiles. Somebody who works here came to reach a file and
 * would have to scroll a README they wrote to get to it.
 *
 * Every attempt to settle that by reordering the page for everybody has failed,
 * including Refined GitHub's, which had a hundred thousand readers and was
 * withdrawn. They all failed the same way, because an extension can only guess
 * which reader it has. This one does not have to guess: GitHub says whether the
 * reader can push, in the payload the page already carries.
 */
export type RepoHome = {
  readonly repo: { readonly owner: string; readonly repo: string }
  /**
   * The branch the address named, or nothing on the front page itself.
   *
   * Nothing rather than "main": which branch the front page is of is GitHub's
   * answer to give, in the payload, and a default guessed here would be wrong on
   * every repository that renamed its trunk.
   */
  readonly branch: string | null
  /**
   * The file or folder the address asked for, or nothing for the whole tree.
   *
   * Unescaped, because it is a path and not a URL: a file with a space in its
   * name is read by that name everywhere else in this codebase.
   */
  readonly reading: string | null
}

/**
 * Where the reader stands with the repository in front of them.
 *
 * A **Keeper** can push to it. A **Caller** cannot. The whole of the distinction is
 * `currentUserCanPush`, which is one field of the payload GitHub already sends, so
 * this costs nothing to know and is never a guess about somebody's intent.
 *
 * Not a permission and not used as one. Nothing is withheld from a Caller and
 * nothing is unlocked for a Keeper: it decides the order of two things that are
 * both on the page either way.
 *
 * _Avoid_: owner, collaborator, visitor, guest.
 */
export type Footing = "keeper" | "caller"

/**
 * What the page puts first.
 *
 * The **welcome** is the README: what this is, why it exists, how to start. The
 * **work** is the file list and whatever of the reader's own is open here.
 *
 * Both are on the page under either Lead. This is the order, not the contents,
 * which is the distinction six earlier attempts got wrong — a file list that
 * disappears is reported as a broken page, and was, repeatedly.
 */
export type Lead = "welcome" | "work"

/**
 * Reads where the reader stands out of what GitHub said about them.
 *
 * Written against the flag rather than taking it as a parameter shape, so that the
 * one place that knows GitHub's field name is the decoder and not this.
 */
export const footingOf = (canPush: boolean): Footing => (canPush ? "keeper" : "caller")

/**
 * What to lead with, given where the reader stands.
 *
 * A Caller gets the welcome. They came from a search result, a link in a post, or
 * a package page, and the question they are holding is whether this is the thing
 * they want. "I see a lot of developers get really confused because the README is
 * below the fold. You're immediately presented with a directory structure that you
 * don't care about."
 *
 * A Keeper gets the work. They know what the repository is, because they write it.
 * "As a developer, the README is useless, I am usually on a Github repo to start
 * looking at code, and I don't want to have to first scroll through a README."
 *
 * Both quotations are from the same thread, eight comments apart. Neither reader is
 * wrong, which is why this is a function of who is asking rather than a preference
 * somebody has to find in a settings pane.
 */
export const leadFor = (footing: Footing): Lead => (footing === "keeper" ? "work" : "welcome")

/** What one row of the file list is. */
export type Kind = "directory" | "file" | "submodule"

/**
 * What last touched one entry of the tree.
 *
 * Both halves, because the argument about this column has two sides and each is
 * right about one half. The date is what their readers defend and the message is
 * what they attack: one whitespace commit overwrites the headline of a large
 * refactor, so the message alone lies about a file and the date beside it does
 * not. Shown together, a reader can see when the message is not worth believing.
 */
/**
 * Who wrote the commit that last touched a row, when that is known.
 *
 * Optional on the first paint of the column: the tree-commit route names the
 * commit and not always the person, and a later read of unique SHAs fills this
 * in. A row that never learns a login still shows the message, the age and the
 * link.
 */
export type TouchWho = {
  readonly login: string
  /** GitHub's own URL for the face, when the payload carried one. */
  readonly face: Option.Option<string>
}

export type Touch = {
  /** ISO 8601, as GitHub sends it. Formatted by `ageOf` at the last moment. */
  readonly at: string
  readonly said: string
  /** The commit itself, so the row's date is a way into the history. */
  readonly url: string
  /** The SHA, so one later read can name the author of many rows at once. */
  readonly oid: Option.Option<string>
  readonly who: Option.Option<TouchWho>
}

export type Entry = {
  readonly name: string
  readonly path: string
  readonly kind: Kind
  /**
   * Nothing until the second request lands, and nothing ever for a repository
   * whose history is too large for GitHub to answer about.
   *
   * Optional on purpose rather than waited for. The rows are drawn from the first
   * payload and this column fills in behind them, because holding a file list back
   * for a quarter of a second to avoid one reflow is a quarter of a second the
   * reader spends looking at nothing.
   */
  readonly touched: Option.Option<Touch>
}

/**
 * The README: where to read it, and GitHub's rendering of it until it is read.
 *
 * Two forms, and the source is the one this interface draws. A README is markdown
 * like a description and a comment are, and those are parsed here, so a README
 * taken as GitHub's HTML is their table, their headings and their fences on the
 * one page most readers meet first.
 *
 * Their rendering is kept because it is already in hand. It comes with the
 * payload at no request and no wait, and it is most of that payload — three
 * hundred kilobytes of three hundred and thirty for a well-documented repository
 * — which is why nothing here reads it, measures it or copies it. It stands on
 * the page while the source is read, and stays where the source cannot be.
 */
export type Welcome = {
  readonly name: string
  /** Where the file is, from the root, so the source can be asked for. */
  readonly path: string
  readonly html: string
  /** True where GitHub gave up rendering it. The screen says so rather than showing a blank. */
  readonly timedOut: boolean
}

/**
 * Where the reader stands with a repository's star.
 *
 * Three states rather than a flag, because "not starred" and "cannot star" are
 * different things and only one of them is worth drawing a button for. A signed
 * out reader is `barred`, and the button they must not press is not shown at all.
 */
export type Starring = "starred" | "unstarred" | "barred"

/** What the About panel says, where GitHub said anything. */
export type About = {
  readonly description: Option.Option<string>
  readonly stars: Option.Option<number>
  readonly forks: Option.Option<number>
  readonly topics: ReadonlyArray<string>
  readonly starring: Starring
}

/** One person who wrote some of this, drawn as a face. */
export type Hand = {
  readonly login: string
  /** Their real name where they gave one, for the title on the face. */
  readonly called: string
  readonly url: string
  readonly face: string
}

/**
 * One language, and how much of the repository is written in it.
 *
 * The colour comes from GitHub rather than from us. It is the one they have used
 * on every repository page for a decade, readers know Go's teal from Rust's
 * orange without reading the word, and inventing our own would throw that away.
 */
export type Tongue = {
  readonly name: string
  readonly share: number
  readonly colour: string
  readonly url: string
}

/** Where a build of this went, and how that went. */
export type Landing = {
  readonly name: string
  readonly state: string
  readonly url: string
}

/**
 * The last thing shipped, where anything was.
 *
 * A repository with tags and no release has none of this, and so does one that
 * has never been tagged. Both are common and neither is worth a heading saying
 * the section is empty.
 */
export type Shipped = {
  readonly name: string
  readonly at: string
  readonly url: string
}

/**
 * Everything about a repository that is neither its files nor its README.
 *
 * Read separately from the page, and drawn when it lands. GitHub's own page
 * works the same way and for the same reason: none of this is in the document,
 * it is four kilobytes off `/owner/repo/_sidebar`, and a file list held back
 * until a language bar is ready is a file list arriving late for no one's
 * benefit.
 *
 * Every part is optional because every part is genuinely absent somewhere. A
 * private repository nobody depends on has no dependents, a repository with one
 * author still has a contributor list, and a repository that has never shipped
 * has releases with nothing in them. Measured against `react/react`, which has
 * all of it, and a repository of ours, which has three of the seven.
 */
export type Standing = {
  readonly hands: ReadonlyArray<Hand>
  readonly handCount: Option.Option<number>
  readonly handsUrl: Option.Option<string>
  readonly tongues: ReadonlyArray<Tongue>
  readonly shipped: Option.Option<Shipped>
  readonly shippedUrl: Option.Option<string>
  readonly landings: ReadonlyArray<Landing>
  readonly landingsUrl: Option.Option<string>
  /** How many other repositories depend on this, which is GitHub's Used by. */
  readonly leaning: Option.Option<number>
  readonly leaningFaces: ReadonlyArray<string>
  readonly leaningUrl: Option.Option<string>
  readonly parcels: Option.Option<number>
  readonly parcelsUrl: Option.Option<string>
}

/** A repository's front page, as this interface draws it. */
export type Front = {
  readonly repo: { readonly owner: string; readonly repo: string }
  readonly footing: Footing
  readonly branch: string
  /** The commit the tree was read at, which is what the second request is asked about. */
  readonly head: string
  readonly entries: ReadonlyArray<Entry>
  readonly welcome: Option.Option<Welcome>
  readonly about: About
  readonly commits: Option.Option<number>
}

/**
 * The tree in the order a reader expects: folders first, then files, each by name.
 *
 * GitHub sends it in this order already. Sorted here anyway because the order is
 * part of what the page means rather than a property of their payload, and a
 * payload that arrives unsorted one day should not scatter the file list.
 *
 * Case-insensitive, so that `README.md` does not sort above `src` in one
 * repository and below it in the next. `localeCompare` with `numeric` so that
 * `v10` follows `v9` rather than preceding it.
 */
export const inReadingOrder = (entries: ReadonlyArray<Entry>): ReadonlyArray<Entry> =>
  [...entries].sort((one, two) => {
    const folder = (entry: Entry) => (entry.kind === "directory" ? 0 : 1)
    const first = folder(one) - folder(two)
    return first !== 0
      ? first
      : one.name.localeCompare(two.name, undefined, { numeric: true, sensitivity: "base" })
  })

/**
 * The tree with the commit column written onto it.
 *
 * Keyed by path rather than by position, because the two answers are separate
 * requests and nothing promises they describe the same rows in the same order. An
 * entry the second answer said nothing about keeps whatever it had, which is how a
 * column that half-arrived stays half-drawn rather than half-erased.
 */
export const touchedBy = (
  entries: ReadonlyArray<Entry>,
  touches: ReadonlyMap<string, Touch>
): ReadonlyArray<Entry> =>
  entries.map((entry) => {
    const found = touches.get(entry.path)
    return found === undefined ? entry : { ...entry, touched: Option.some(found) }
  })

/**
 * The SHAs still missing a face, unique, so one commit is one later read.
 *
 * A SHA already named is left out: the tree-commit route sometimes carries the
 * author, and asking again would be a request for a fact already in hand.
 */
export const shasOf = (touches: ReadonlyMap<string, Touch>): ReadonlyArray<string> => {
  const seen = new Set<string>()
  const shas: Array<string> = []
  for (const touch of touches.values()) {
    if (Option.isSome(touch.who)) continue
    const oid = Option.getOrUndefined(touch.oid)
    if (oid === undefined || seen.has(oid)) continue
    seen.add(oid)
    shas.push(oid)
  }
  return shas
}

/**
 * The same column, with faces written onto the commits they belong to.
 *
 * Keyed by SHA rather than by path, because many rows share one commit and the
 * later read answers once per commit. A row whose SHA is missing from `who`
 * keeps the message it already had.
 */
export const namedBy = (
  touches: ReadonlyMap<string, Touch>,
  who: ReadonlyMap<string, TouchWho>
): ReadonlyMap<string, Touch> =>
  new Map(
    [...touches].map(([path, touch]) => {
      if (Option.isSome(touch.who)) return [path, touch]
      const oid = Option.getOrUndefined(touch.oid)
      const found = oid === undefined ? undefined : who.get(oid)
      return [path, found === undefined ? touch : { ...touch, who: Option.some(found) }]
    })
  )

/**
 * The site's own two-segment addresses, which are not repositories.
 *
 * Every other page this extension stands on is told apart by a segment GitHub owns
 * — `pulls`, `commits`, `issues` — so its parser can refuse everything else by
 * looking for that segment. This page is told apart by the absence of one, so
 * `/settings/profile` and `/issues/assigned` reach it looking exactly like a
 * repository.
 *
 * Only first segments that really host a second one. `/features` and `/pricing`
 * are pages in their own right and never have anything after them, so they cannot
 * be mistaken for an owner and are not worth listing. The cost of a name missing
 * from here is one page of GitHub's replaced by an interface that then finds no
 * repository, so the list is deliberately longer than the addresses seen in
 * practice.
 *
 * Exported because a person's own three pages are one segment, so their parser has
 * the same problem and a worse version of it — see `NOT_A_PERSON` in
 * `./person.ts`, which reads this and adds the pages that never host a second
 * segment. One list, extended, rather than two lists that drift.
 */
export const NOT_AN_OWNER: ReadonlySet<string> = new Set([
  "about",
  "account",
  "apps",
  "codespaces",
  "collections",
  "contact",
  "dashboard",
  "discussions",
  "enterprise",
  "events",
  "explore",
  "issues",
  "login",
  "logout",
  "marketplace",
  "new",
  "notifications",
  "organizations",
  "orgs",
  "pulls",
  "search",
  "security",
  "sessions",
  "settings",
  "sponsors",
  "stars",
  "topics",
  "trending",
  "users",
  "watching"
])

/**
 * One file of the repository, open in the pane where the README usually is.
 *
 * Two forms of the same file, and which one is drawn is the reader's to choose.
 * A markdown file has both: GitHub renders it on their side and sends the
 * article, and the source is what the file actually says. Everything else has
 * only the source, and `rendered` is nothing.
 */
export type Opened = {
  readonly path: string
  /** The file, a line per entry, exactly as GitHub sent it. */
  readonly lines: ReadonlyArray<string>
  /** GitHub's own rendering, for the file kinds they render. */
  readonly rendered: Option.Option<string>
}

/** What the pane is showing: the README, or a file, or a file being read. */
export type Showing = "welcome" | "file"

/**
 * Reads a repository's front page out of an address, or nothing where the address
 * is not one.
 *
 * Written against the whole URL rather than a pathname because it has to reject
 * other hosts: this runs on every page a content script is matched into, and a
 * page that happens to have two path segments on some other site is not a GitHub
 * repository.
 *
 * The query is read and thrown away rather than kept. GitHub writes
 * `?tab=readme-ov-file` into the address on any press inside a README —
 * [discussion 70577](https://github.com/orgs/community/discussions/70577), 69
 * upvotes of people asking them to stop — and an address that gained it is still
 * this page. Nothing else in the query changes what is shown here.
 */
export const repoHomeIn = (url: string): Option.Option<RepoHome> => {
  // `URL.parse` rather than the constructor: an address that is not one is an
  // ordinary answer here, not an exception to be caught.
  const address = URL.parse(url)
  if (address === null || address.hostname !== "github.com") return Option.none()

  const segments = address.pathname.split("/").filter((part) => part.length > 0)
  const [owner, repo, kind, branch, ...rest] = segments
  if (owner === undefined || repo === undefined) return Option.none()
  if (NOT_AN_OWNER.has(owner.toLowerCase())) return Option.none()

  const here = { owner, repo }

  // Two segments is the front page, and every other tab of the repository —
  // `pulls`, `issues`, `commits` — is somebody else's screen.
  if (kind === undefined) return Option.some({ repo: here, branch: null, reading: null })
  if (kind !== "tree" && kind !== "blob") return Option.none()

  // A branchless tree or blob is an address GitHub itself does not serve.
  if (branch === undefined) return Option.none()

  /*
   * The path, back the way it was written.
   *
   * GitHub escapes each segment on its own, so a file with a `#` or a space in
   * it arrives in pieces and each piece is escaped separately. Decoding after
   * the join would turn an escaped slash inside one name into a folder that does
   * not exist, so each piece is decoded and then they are joined.
   */
  const reading = rest.length === 0 ? null : rest.map(unescaped).join("/")

  return Option.some({ repo: here, branch, reading })
}

/**
 * A path segment as it was written, or as it arrived where it is not escaped.
 *
 * A lone `%` in a file name is a segment `decodeURIComponent` throws on, and a
 * file named that way is a file, not an address this refuses to read.
 */
export const unescaped = (segment: string): string =>
  Option.getOrElse(Option.liftThrowable(decodeURIComponent)(segment), () => segment)
