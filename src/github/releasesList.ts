/**
 * The releases list page, read for every Version on it, and the asset fragment beside it.
 *
 * Scraping, and here it is not a preference. Their list page carries the notes complete: read on
 * 2026-08-14, `oven-sh/bun` ships a 3,719 character notes body in the served document and the
 * string "Read more" appears nowhere in it, so the truncation eight readers called misleading in
 * [#5962](https://github.com/orgs/community/discussions/5962) is a CSS rule over content GitHub
 * already sent. Drawing it whole costs nothing.
 *
 * The files are the opposite. The same document is 389,330 bytes for ten Versions and names not
 * one file: every asset list sits behind an `include-fragment` at
 * `/{owner}/{repo}/releases/expanded_assets/{tag}`. So `buildsOnPage` reads that fragment, and
 * only the newest Version needs it, because Yours is about the newest Version.
 *
 * Written to come back empty rather than wrong, as `actionsList.ts` is. A section whose tag
 * cannot be read is skipped rather than guessed at, so a page that has stopped looking like this
 * yields nothing and the screen hands the document back to GitHub.
 *
 * Measured against `tests/fixtures/releasesList.html` and `tests/fixtures/releaseAssets.html`,
 * which are `zeronsh/comet` as GitHub served it on 2026-08-14.
 */

import type { Attached, Build, Change, SourceArchive, Version } from "../domain/release"
import { formIn, platformIn } from "../domain/release"
import { text } from "./outcome"

const TAG = /\/releases\/tag\/([^/?#]+)/

/** "… by @who in #123", which is the shape every generated note's bullet has. */
const SAID = /^(.*?)\s+by\s+@[^\s]+\s+in\s+#\d+\s*$/

const PULL = /\/pull\/(\d+)/

const parse = (html: string): Document => new DOMParser().parseFromString(html, "text/html")

/**
 * One Change out of one bullet of their notes, where the bullet is one.
 *
 * A bullet has to name a pull request to be a Change, because a Change is a pull request. A
 * hand-written bullet that names none is left in the notes and read as prose by
 * {@link remarkIn}, which is what keeps a repository whose maintainer writes their own notes
 * from reading as a repository that says nothing.
 */
const changeIn = (item: Element): ReadonlyArray<Change> => {
  const pull = item.querySelector('a[data-hovercard-type="pull_request"][href]')
  const url = pull?.getAttribute("href") ?? ""
  const number = PULL.exec(url)?.[1] ?? ""
  if (number === "") return []

  const who = item.querySelector('a[data-hovercard-type="user"]')
  const author = text(who).replace(/^@/, "")
  if (author === "") return []

  /*
   * Their own sentence with the two links taken off the end, matched rather than sliced: the
   * title is the part before "by", and a title with the word "by" in it is common enough that
   * the pattern is anchored to the end of the string and made lazy at the front.
   */
  const said = text(item).replace(/\s+/g, " ").trim()
  const title = SAID.exec(said)?.[1] ?? ""
  if (title === "") return []

  return [{ title, author, pullRequest: number, url }]
}

/**
 * What the notes said past their Changes and their link to the comparison.
 *
 * Read by taking away rather than by matching, so anything GitHub or a maintainer puts in a
 * release body that this code has never seen survives into the Version rather than being
 * dropped. What is taken away is the three things a generated note is made of: the "What's
 * Changed" heading, the bullets that parsed as Changes, and the "Full Changelog" line.
 */
const remarkIn = (body: Element | null): string => {
  if (body === null) return ""

  const copy = body.cloneNode(true) as Element
  for (const item of [...copy.querySelectorAll("li")]) {
    if (changeIn(item).length > 0) item.remove()
  }
  for (const one of [...copy.querySelectorAll("h1, h2, h3, h4, p")]) {
    const said = text(one).replace(/\s+/g, " ").trim()
    if (said === "What's Changed" || said.startsWith("Full Changelog")) one.remove()
  }
  // Lists their bullets have all left, and the headings of sections whose body has gone.
  for (const list of [...copy.querySelectorAll("ul, ol")]) {
    if (list.querySelector("li") === null) list.remove()
  }

  return text(copy).replace(/\s+/g, " ").trim()
}

/** Whether one of their labels on this Version says the given word. */
const labelled = (section: Element, said: string): boolean =>
  [...section.querySelectorAll("span.Label")].some((one) => text(one) === said)

const versionIn = (section: Element): ReadonlyArray<Version> => {
  const link = section.querySelector('a[href*="/releases/tag/"]')
  const url = link?.getAttribute("href") ?? ""
  const tag = TAG.exec(url)?.[1] ?? ""
  if (tag === "") return []

  const when = section.querySelector("relative-time[datetime]")
  const body = section.querySelector('[data-test-selector="body-content"]')

  return [
    {
      tag: decodeURIComponent(tag),
      /*
       * Their release name, which is the tag again on most repositories and is the word a
       * reader saw. Falls back to the tag, because a Version published with no name at all
       * leaves their heading link empty.
       */
      title: text(link) === "" ? decodeURIComponent(tag) : text(link),
      url,
      at: when?.getAttribute("datetime") ?? "",
      /*
       * Who published it. Their author line is an avatar, a link and the words "released
       * this", so the anchor beside the date is the one that names them. Read structurally
       * because the section holds other user links, in the notes, and those are the people who
       * wrote the Changes rather than the person who cut the release.
       */
      author: text(when?.parentElement?.querySelector("a[href]")),
      prerelease: labelled(section, "Pre-release"),
      latest: labelled(section, "Latest"),
      changes: [...(body?.querySelectorAll("li") ?? [])].flatMap(changeIn),
      remark: remarkIn(body)
    }
  ]
}

/**
 * Every Version their list page carries, in the order they gave them.
 *
 * Their order is kept and never re-sorted here. It is a real complaint that the order is hard to
 * predict, [#8226](https://github.com/orgs/community/discussions/8226) at 84 upvotes, and
 * whether this screen overrides it is an open question in `docs/spec/releases.md`. A parser is
 * the wrong place to hold that opinion.
 */
export const versionsOnPage = (html: string): ReadonlyArray<Version> =>
  [...parse(html).querySelectorAll("section[data-release-anchor]")].flatMap(versionIn)

const DIGEST = /sha256:[a-f0-9]{64}/

/**
 * A size as GitHub words it, out of the row's own text.
 *
 * Their string rather than a byte count formatted again: "23.8 MB" is what a reader saw on their
 * page, and the fragment gives no number to format anyway.
 */
const SIZE = /^\s*([\d.]+\s*[KMGT]?B)\s*$/

const sizeIn = (row: Element): string => {
  for (const cell of [...row.querySelectorAll("span, div, td")]) {
    const said = SIZE.exec(text(cell))?.[1]
    if (said !== undefined) return said.replace(/\s+/g, " ")
  }
  return ""
}

/**
 * The Builds of one Version, and the Source Archives GitHub appended to them.
 *
 * Two lists and not one, because they are two kinds of thing and their own page draws all six
 * alike. That is [#6003](https://github.com/orgs/community/discussions/6003) at 143 upvotes, and
 * curl's maintainer reporting that users take the wrong file because of it.
 *
 * Told apart by the address rather than by the name: an archive nobody uploaded is served from
 * `/archive/refs/tags/`, and a file somebody uploaded is served from `/releases/download/`. A
 * maintainer is free to upload a file called "Source code", and one has.
 */
export const buildsOnPage = (html: string): Attached => {
  const page = parse(html)
  const builds: Array<Build> = []
  const archives: Array<SourceArchive> = []

  for (const link of [...page.querySelectorAll("a[href]")]) {
    const url = link.getAttribute("href") ?? ""

    if (url.includes("/archive/refs/tags/")) {
      const kind = url.endsWith(".zip") ? "zip" : url.endsWith(".tar.gz") ? "tar.gz" : null
      if (kind !== null && !archives.some((one) => one.kind === kind)) archives.push({ kind, url })
      continue
    }

    if (!url.includes("/releases/download/")) continue

    const name = text(link)
    if (name === "" || builds.some((one) => one.name === name)) continue

    /*
     * The row the link sits in, for the size and the digest. Both are siblings of the name
     * rather than children of it, and the row is the nearest ancestor that holds all three:
     * their fragment is a table on a wide window and a stack of divs on a narrow one, so the
     * ancestor is found by walking up until the digest or the size is in reach.
     */
    const row = link.closest("tr, li, .Box-row") ?? link.parentElement?.parentElement ?? link

    builds.push({
      name,
      url,
      size: sizeIn(row),
      digest: DIGEST.exec(row.textContent ?? "")?.[0] ?? null,
      platform: platformIn(name),
      form: formIn(name)
    })
  }

  return { builds, archives }
}

/**
 * Whether what came back out of the store is still the shape that went in.
 *
 * The same guard the Actions list keeps, and for the same reason: an entry written before an
 * update is the one shape that would reach the screen and fail there. One Version is enough to
 * tell, since they are written in one go by one version of this code, and `remark` is the field
 * to prove because it is the one a Version gained after the first drawing of this screen.
 */
export const isKeptVersions = (value: unknown): value is ReadonlyArray<Version> => {
  if (!Array.isArray(value)) return false
  if (value.length === 0) return true

  const one: Partial<Version> = value[0]
  return (
    typeof one === "object" &&
    one !== null &&
    typeof one.tag === "string" &&
    typeof one.at === "string" &&
    typeof one.prerelease === "boolean" &&
    typeof one.remark === "string" &&
    Array.isArray(one.changes)
  )
}
