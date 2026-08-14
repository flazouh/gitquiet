import { Option } from "effect"
import type {
  Attached,
  Build,
  Change,
  Platform,
  Row,
  SourceArchive,
  Version
} from "../domain/release"
import { rowsIn, saidPlatform, yoursAmong } from "../domain/release"
import { useArt } from "./art"
import { ASIDE, CHIP, GHOST, PILL } from "./dress"
import { Face } from "./Face"
import { Section } from "./Section"
import { ageOf, momentOf } from "./when"
import { faceOf } from "./Who"

/**
 * The version a Change arrived in, as a chip at the end of its row.
 *
 * Once per Version and never once per Change, which is what `rowsIn` decides. Three Changes of
 * one Version are three things that landed together, and the tag printed three times down the
 * right of the card is the repetition this screen exists to take out: their own page prints it
 * as a heading over each, along with an author line, an asset list and a reactions bar.
 */
const Tag = ({ version }: { readonly version: Version }) => (
  <span className="flex shrink-0 items-center gap-1">
    <a
      className={`${CHIP} font-mono text-ink text-xs no-underline tabular-nums hover:bg-active`}
      href={version.url}
      title={`${version.title}, published ${momentOf(version.at)}`}
    >
      {version.tag}
    </a>
    {version.prerelease ? (
      <span className={`${PILL} shrink-0 text-ink-muted text-xs`} title="GitHub marks this a pre-release">
        Pre-release
      </span>
    ) : null}
  </span>
)

/**
 * One Change: what changed, who wrote it, and where to go with a question about it.
 *
 * The title is the link and the row is not, as a Notice's is: a reader who wants to select the
 * words of a title should not have to open a pull request to do it.
 *
 * A face rather than a login in the first line, because the login is the least useful thing on
 * the row and a face is recognised without being read. Their own generated notes put it the
 * other way round and in the middle of a sentence: "… by @wingleeio in #79".
 */
const OfChange = ({
  change,
  version,
  first
}: {
  readonly change: Change
  readonly version: Version
  readonly first: boolean
}) => {
  const age = ageOf(version.at)

  return (
    <li className="flex items-start gap-2.5 px-3 py-2 hover:bg-hover">
      <span className="mt-0.5 shrink-0" title={change.author}>
        <Face faceUrl={Option.some(faceOf(change.author))} name={change.author} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <a
            className="min-w-0 flex-1 truncate text-ink text-sm no-underline hover:underline"
            href={change.url}
          >
            {change.title}
          </a>
          <span className="shrink-0 text-ink-muted text-sm tabular-nums">
            {`#${change.pullRequest}`}
          </span>
          {age === "" ? null : (
            <span className="shrink-0 text-ink-muted text-xs" title={momentOf(version.at)}>
              {age}
            </span>
          )}
        </div>

        {/* The second line carries the tag, and only on the first Change of a Version. A row
            without one is a row that landed with the one above it, which is a thing the gap
            says better than a repeated chip would. */}
        {first ? (
          <div className={`mt-1 flex items-center gap-2 ${ASIDE}`}>
            <Tag version={version} />
            <span className="min-w-0 truncate">{change.author}</span>
          </div>
        ) : null}
      </div>
    </li>
  )
}

/** What a Version said in prose, where it said anything past its own Changes. */
const OfRemark = ({
  version,
  first
}: {
  readonly version: Version
  readonly first: boolean
}) => (
  <li className="flex items-start gap-2.5 px-3 py-2 hover:bg-hover">
    <span className="mt-0.5 shrink-0" title={version.author}>
      <Face faceUrl={Option.some(faceOf(version.author))} name={version.author} />
    </span>
    <div className="min-w-0 flex-1">
      {/* Clamped rather than cut, and to four lines rather than to a height in pixels: their own
          page hides everything past 300 pixels behind a "Read more" that eight readers in
          [#5962](https://github.com/orgs/community/discussions/5962) called misleading, because a
          list truncated mid-item reads as a complete list. Four lines is enough to see that there
          is prose here and whose it is; the tag beside it is the way to all of it. */}
      <p className="line-clamp-4 min-w-0 whitespace-pre-line text-ink text-sm">{version.remark}</p>
      {first ? (
        <div className={`mt-1 flex items-center gap-2 ${ASIDE}`}>
          <Tag version={version} />
          <span className="shrink-0" title={momentOf(version.at)}>
            {ageOf(version.at)}
          </span>
        </div>
      ) : null}
    </div>
  </li>
)

/**
 * The Versions that said nothing, as one line rather than as one card each.
 *
 * Thirty of the sixty-seven Versions of the worked example are this, and their own page gives
 * each the same furniture as a Version that changed something. Six in a row is six screens of
 * heading, author line and asset list over nothing, which is what pushes the Changes below the
 * fold.
 *
 * Drawn rather than dropped, and every tag still a link. A tag that exists is a tag somebody may
 * be looking for, and a screen that quietly hides ten of them cannot be trusted about the rest.
 */
const OfBare = ({ versions }: { readonly versions: ReadonlyArray<Version> }) => {
  const art = useArt()
  const Mark = art.dot

  return (
    <li className={`flex items-center gap-2.5 px-3 py-1.5 ${ASIDE}`}>
      <Mark size={16} aria-hidden="true" className="shrink-0 opacity-40" />
      <span className="shrink-0">
        {versions.length === 1 ? "1 version said nothing" : `${versions.length} versions said nothing`}
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {versions.map((one) => (
          <a
            key={one.tag}
            className="font-mono text-ink-muted text-xs no-underline tabular-nums hover:text-ink hover:underline"
            href={one.url}
            title={`${one.title}, published ${momentOf(one.at)}`}
          >
            {one.tag}
          </a>
        ))}
      </span>
    </li>
  )
}

const OfRow = ({ row }: { readonly row: Row }) => {
  if (row.kind === "bare") return <OfBare versions={row.versions} />
  if (row.kind === "remark") return <OfRemark version={row.version} first={row.first} />
  return <OfChange change={row.change} version={row.version} first={row.first} />
}

/** One Build that is not Yours, as a row of the fold under the download. */
const OfBuild = ({ build }: { readonly build: Build }) => {
  const said = saidPlatform(build.platform)

  return (
    <a
      className="flex items-baseline gap-2 px-3 py-1.5 no-underline hover:bg-hover"
      href={build.url}
      title={build.digest === null ? build.name : `${build.name}\n${build.digest}`}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-ink text-xs">{build.name}</span>
      <span className="shrink-0 text-ink-muted text-xs">{said === "your machine" ? "" : said}</span>
      <span className="shrink-0 text-ink-muted text-xs tabular-nums">{build.size}</span>
    </a>
  )
}

/** The zip and the tarball GitHub attaches whether or not anybody wanted them. */
const OfArchive = ({ archive }: { readonly archive: SourceArchive }) => (
  <a
    className="flex items-baseline gap-2 px-3 py-1.5 no-underline hover:bg-hover"
    href={archive.url}
    title="Attached by GitHub, not by the maintainer"
  >
    <span className="min-w-0 flex-1 truncate font-mono text-ink-muted text-xs">
      {`source.${archive.kind}`}
    </span>
    <span className="shrink-0 text-ink-muted text-xs">the repository, not a build</span>
  </a>
)

/**
 * The rest of the files, folded away under the one that is Yours.
 *
 * Folded rather than listed, and the fold is the whole argument of the row above it: a screen
 * that names one file and then prints the other five underneath has named nothing. The pattern
 * is `Commits`, which folds the wall of commits away for the same reason and keeps the way to a
 * sha for when a check blames one.
 *
 * The Source Archives are inside the fold and below the Builds, marked for what they are. That
 * is [#6003](https://github.com/orgs/community/discussions/6003) at 143 upvotes, and curl's
 * maintainer reporting that readers take those two instead of the real files.
 */
const TheRest = ({
  attached,
  except
}: {
  readonly attached: Attached
  readonly except?: Build
}) => {
  const art = useArt()
  const Chevron = art["chevron-right"]
  const rest = attached.builds.filter((one) => one.name !== except?.name)
  const how = rest.length + attached.archives.length
  if (how === 0) return null

  return (
    <details className="group border-line-muted border-t">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-1.5 text-ink-muted text-xs hover:bg-hover [&::-webkit-details-marker]:hidden">
        <Chevron
          size={12}
          className="shrink-0 transition-transform duration-[var(--duration-quick)] ease-[var(--ease-in-out)] group-open:rotate-90"
        />
        {how === 1 ? "1 other file" : `${how} other files`}
      </summary>
      <div className="divide-y divide-line-muted border-line-muted border-t">
        {rest.map((one) => (
          <OfBuild key={one.name} build={one} />
        ))}
        {attached.archives.map((one) => (
          <OfArchive key={one.kind} archive={one} />
        ))}
      </div>
    </details>
  )
}

/**
 * The one file this reader should take, as the top of the page.
 *
 * The row exists because their own page has no such row, and the threads say so: the most
 * upvoted complaint about the releases page is a reader at 3,293 points asking where the
 * download button is, and it is a reader's rather than a maintainer's. Their page answers with
 * six files of equal weight, two of which nobody uploaded.
 *
 * Emphasis, which nothing else on this screen wears. It is the same accent the merge button
 * takes on a pull request, and for the same reason: one press on the page is what the page is
 * for, and a reader who came here to download something should not have to read to find it.
 */
const Yours = ({
  version,
  attached,
  machine
}: {
  readonly version: Version
  readonly attached: Attached
  readonly machine: Platform
}) => {
  const art = useArt()
  const Down = art.download
  const yours = yoursAmong(attached.builds, machine)
  const said = saidPlatform(machine)

  return (
    <Section
      name="Download"
      art="download"
      summary={
        <span className="flex items-baseline gap-2">
          <span className="font-mono tabular-nums">{version.tag}</span>
          <span aria-hidden="true">·</span>
          <span className="min-w-0 truncate">{said}</span>
        </span>
      }
    >
      {Option.isSome(yours) ? (
        /*
         * The button is the width of its own filename and no wider. Stretched across the card it
         * was a bar of solid accent the width of the screen, which is louder than the one press
         * on the page needs to be: emphasis is how a reader finds it, and a reader finds a button
         * faster than they find a banner. The size sits outside it as a fact about the file, not
         * as part of what the press does.
         */
        <div className="flex items-center gap-2.5 px-3 py-2">
          <a
            className={`${GHOST} flex min-w-0 items-center gap-2 bg-accent-emphasis px-2.5 py-1.5 font-semibold text-ink-on-emphasis text-xs no-underline hover:opacity-90`}
            href={yours.value.url}
            title={
              yours.value.digest === null
                ? yours.value.name
                : `${yours.value.name}\n${yours.value.digest}`
            }
          >
            <Down size={14} aria-hidden="true" className="shrink-0 opacity-90" />
            <span className="min-w-0 truncate font-mono">{yours.value.name}</span>
          </a>
          {yours.value.size === "" ? null : (
            <span className="shrink-0 text-ink-muted text-xs tabular-nums">
              {yours.value.size}
            </span>
          )}
        </div>
      ) : (
        /*
         * Nothing named, and every file drawn instead. A reader on Windows offered a `.dmg` is
         * the mistake this whole screen is against, so the row would rather say it cannot tell:
         * either half of the platform unknown, or two Builds answering for the same one past the
         * installer tie, and it stops guessing. The list underneath is then their own page's
         * information with the platform said in words beside each file.
         */
        <p className={`px-3 py-2 ${ASIDE}`}>
          {attached.builds.length === 0
            ? `${version.tag} has no files attached to it.`
            : `No single file is named for ${said}. All of them are below.`}
        </p>
      )}
      <TheRest attached={attached} except={Option.getOrUndefined(yours)} />
    </Section>
  )
}

export { Yours }

/**
 * What the fold came to, in the words a section header holds.
 *
 * Both numbers, because either alone is the wrong answer: eight rows without "over 10 versions"
 * looks like a quiet repository, and ten versions without the eight hides the whole point of the
 * screen. The same argument the Actions tally makes, on a page where the gap is wider.
 */
const saidTally = (changes: number, versions: number): string =>
  `${changes === 1 ? "1 change" : `${changes} changes`}, over ${
    versions === 1 ? "1 version" : `${versions} versions`
  }`

/**
 * A repository's releases, one row per Change.
 *
 * The unit is the Change and not the Version, which is the whole of this screen: read on
 * 2026-08-14, 67 Versions of `zeronsh/comet` described 60 Changes between them and 30 described
 * none at all, so their page draws 67 cards over 60 facts. The argument is in
 * `docs/spec/releases.md`.
 */
export const Releases = ({ versions }: { readonly versions: ReadonlyArray<Version> }) => {
  const rows = rowsIn(versions)
  const changes = rows.reduce((running, row) => running + (row.kind === "change" ? 1 : 0), 0)

  return (
    <Section
      name="Changes"
      art="tag"
      summary={<span className="tabular-nums">{saidTally(changes, versions.length)}</span>}
    >
      {versions.length === 0 ? (
        <p className="px-3 py-6 text-center text-ink-muted text-sm">
          This repository has published no releases.
        </p>
      ) : (
        <ul className="divide-y divide-line-muted">
          {rows.map((row, at) => (
            <OfRow
              key={
                row.kind === "bare"
                  ? `bare-${row.versions[0]?.tag ?? at}`
                  : row.kind === "remark"
                    ? `remark-${row.version.tag}`
                    : `change-${row.version.tag}-${row.change.pullRequest}`
              }
              row={row}
            />
          ))}
        </ul>
      )}
    </Section>
  )
}
