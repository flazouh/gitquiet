/**
 * A repository's releases, as the words in `CONTEXT.md` name them.
 *
 * The unit here is the Change and not the Version, for the reason `docs/spec/releases.md`
 * counts: read on 2026-08-14, 67 Versions of `zeronsh/comet` described 60 Changes between
 * them, and 30 of the 67 described none at all. A screen made of Versions draws 67 cards over
 * 60 facts, and nearly half of those cards are a version heading above a link to a comparison.
 */

import { Option } from "effect"
import type { RepoRef } from "./PullRequestRef"

/**
 * One Change: a thing that changed in a Version, as a person would say it.
 *
 * A pull request title, who wrote it, and its number, which is what GitHub's generated notes
 * are made of. Nothing here reads a commit: a Change is the sentence a reader can act on, and
 * their notes carry it already.
 */
export type Change = {
  /** The pull request's title, with their "by @who in #n" taken off the end. */
  readonly title: string
  /** The login, without the `@`. */
  readonly author: string
  /** The pull request number, without the `#`. */
  readonly pullRequest: string
  readonly url: string
}

/** What a Build runs on. Their word, lowercased, out of the filename. */
export type Machine = "macos" | "linux" | "windows"

/** What a Build runs on, the other half. */
export type Chip = "arm64" | "x86_64" | "x86"

/**
 * A platform, in the two halves a download decision actually turns on.
 *
 * Either half may be unknown, and unknown is not a guess: a filename that names no machine
 * answers with null rather than with the likeliest one, because a wrong file is the whole of
 * what the threads in `docs/spec/releases.md` are about.
 */
export type Platform = {
  readonly machine: Machine | null
  readonly chip: Chip | null
}

/**
 * Whether a Build installs itself or has to be unpacked.
 *
 * Read off the extension, which is a fact about the file rather than a preference. It is what
 * settles a platform two Builds both answer for: `zeron-0.2.1-macos-arm64.dmg` and
 * `zeron-0.2.1-macos-arm64-app.tar.gz` are one machine and one chip, and GitHub's own download
 * counts over comet's 67 Versions are 186 against 11.
 */
export type Form = "installer" | "archive" | "unknown"

/** One file attached to a Version, and what it runs on. */
export type Build = {
  readonly name: string
  readonly url: string
  /** As GitHub words it: "23.8 MB". Their string, because it is the one a reader saw. */
  readonly size: string
  /** `sha256:34e2…`, which their own asset fragment carries. Null where it does not. */
  readonly digest: string | null
  readonly platform: Platform
  readonly form: Form
}

/**
 * The zip and the tarball GitHub attaches to every Version.
 *
 * Never a Build and never Yours. Kept as its own type so that nothing can put one in a list of
 * Builds by accident, which is the mistake their own page makes by drawing all six alike.
 */
export type SourceArchive = {
  readonly kind: "zip" | "tar.gz"
  readonly url: string
}

/**
 * What one Version has attached, in the two lists it really is.
 *
 * Two fields rather than one so that nothing can put a Source Archive in a list of Builds by
 * accident, which is the mistake their own page makes by drawing all six alike.
 */
export type Attached = {
  readonly builds: ReadonlyArray<Build>
  readonly archives: ReadonlyArray<SourceArchive>
}

/** One entry of a repository's releases list. */
export type Version = {
  readonly tag: string
  /** Their release name, which is the tag again on most repositories. */
  readonly title: string
  readonly url: string
  readonly at: string
  /** Who published it, which is a bot on all 67 Versions of the worked example. */
  readonly author: string
  readonly prerelease: boolean
  /** Whether GitHub put their own "Latest" label on it. */
  readonly latest: boolean
  readonly changes: ReadonlyArray<Change>
  /**
   * Whatever the notes said beyond the Changes and the link to the comparison.
   *
   * Kept whole, and it is the reason a Version is not judged by its Changes alone. GitHub's
   * generated notes are a list of pull requests, so a repository that uses them has Changes and
   * nothing else; a repository whose maintainer writes their notes by hand has prose and often
   * no parseable pull request in it at all. Reading only the Changes would call every one of
   * those Bare and hide the very notes somebody sat down to write.
   */
  readonly remark: string
}

/**
 * A Bare Version: one whose notes say nothing at all.
 *
 * No Change named and no prose beyond their own link to the comparison, which is 30 of the 67
 * Versions of the worked example. There is nothing on it to read, so the screen draws it as a
 * marker between the Changes around it rather than as a row of its own.
 */
export const isBare = (version: Version): boolean =>
  version.changes.length === 0 && version.remark === ""

/** One line of the list: a Change, or the Versions that had none. */
export type Row =
  | {
      readonly kind: "change"
      readonly change: Change
      readonly version: Version
      /**
       * Whether this is the first Change of its Version.
       *
       * The tag is drawn once per Version rather than once per row: three Changes of one
       * Version are three things that landed together, and repeating the tag three times is
       * the noise this screen exists to remove.
       */
      readonly first: boolean
    }
  | {
      /**
       * What a Version said in prose, where it said anything.
       *
       * Its own row rather than a field of the Change rows, because the two are different
       * things: a Change is one pull request and this is the paragraph somebody wrote about the
       * release as a whole, which is often the only content a hand-written note has.
       */
      readonly kind: "remark"
      readonly version: Version
      /** Whether the Version's tag has already been drawn by a Change row above this one. */
      readonly first: boolean
    }
  | { readonly kind: "bare"; readonly versions: ReadonlyArray<Version> }

/**
 * Every Version folded into the rows a reader reads, in the order GitHub gave them.
 *
 * Their order is newest first and it is kept. Consecutive Bare Versions join into one marker,
 * because six versions that said nothing are one silence and not six.
 */
export const rowsIn = (versions: ReadonlyArray<Version>): ReadonlyArray<Row> => {
  const rows: Array<Row> = []
  let bare: Array<Version> = []

  const flush = () => {
    if (bare.length > 0) {
      rows.push({ kind: "bare", versions: bare })
      bare = []
    }
  }

  for (const version of versions) {
    if (isBare(version)) {
      bare.push(version)
      continue
    }
    flush()
    version.changes.forEach((change, at) => {
      rows.push({ kind: "change", change, version, first: at === 0 })
    })
    if (version.remark !== "") {
      rows.push({ kind: "remark", version, first: version.changes.length === 0 })
    }
  }

  flush()
  return rows
}

/**
 * Which Version a reader who came to download something should be offered.
 *
 * GitHub's own "Latest" label where they set one, because that label is the maintainer's answer
 * to this exact question and it already skips pre-releases. Failing that, the newest Version
 * that is not a pre-release, and only then the newest of all.
 *
 * The order matters on repositories where the top of the list is not the answer. Read on
 * 2026-08-14, 89 of the 100 newest releases of `vercel/next.js` are pre-releases, so the newest
 * Version there is a canary and the file a reader wants is further down the page than their
 * screen shows. Offering the canary is the same mistake as offering the wrong platform.
 */
export const downloadable = (
  versions: ReadonlyArray<Version>
): Option.Option<Version> => {
  const chosen =
    versions.find((one) => one.latest) ??
    versions.find((one) => !one.prerelease) ??
    versions[0]
  return chosen === undefined ? Option.none() : Option.some(chosen)
}

const TAB = /^\/([^/]+)\/([^/]+)\/releases\/?$/

/**
 * The repository whose releases list an address names, or nothing.
 *
 * The list itself only. `/releases/tag/{tag}` is one Version and has no screen here, and
 * `/releases/latest` is a redirect to one of those, so both stay GitHub's. A query is allowed
 * and ignored, as on the Actions tab: their search box is theirs until this screen holds more
 * than the first page.
 */
export const releasesIn = (url: string): Option.Option<RepoRef> => {
  const at = Option.liftThrowable((address: string) => new URL(address))(url)
  if (Option.isNone(at)) return Option.none()
  if (at.value.hostname !== "github.com") return Option.none()

  const named = TAB.exec(at.value.pathname)
  if (named === null) return Option.none()

  const owner = named[1] ?? ""
  const repo = named[2] ?? ""
  if (owner === "" || repo === "") return Option.none()
  return Option.some({ owner, repo })
}

/*
 * Words first and extensions second, and both, because a filename may carry either alone.
 * `zeron-0.2.1-macos-arm64.dmg` says it twice and `Cursor-darwin.zip` says it once.
 *
 * `\b` is doing real work in the chip patterns: `x86_64` must not read as `x86`, and it cannot,
 * because the character after `x86` there is an underscore and an underscore is a word
 * character. So the boundary fails and the wider pattern is reached.
 */
const MACHINES: ReadonlyArray<readonly [RegExp, Machine]> = [
  [/\b(?:macos|darwin|osx|mac)\b/, "macos"],
  [/\b(?:windows|win64|win32|win)\b/, "windows"],
  [/\blinux\b/, "linux"],
  [/\.(?:dmg|pkg)$/, "macos"],
  [/\.(?:msi|exe)$/, "windows"],
  [/\.(?:deb|rpm|appimage)$/, "linux"]
]

const CHIPS: ReadonlyArray<readonly [RegExp, Chip]> = [
  [/\b(?:arm64|aarch64|armv8|apple-?silicon)\b/, "arm64"],
  [/\b(?:x86_64|x8664|amd64|x64)\b/, "x86_64"],
  [/\b(?:i386|i686|x86|ia32)\b/, "x86"]
]

const INSTALLER = /\.(?:dmg|pkg|msi|exe|deb|rpm|appimage)$/
const ARCHIVE = /\.(?:tar\.gz|tgz|tar\.xz|tar\.bz2|zip|7z)$/

/**
 * What a filename says it runs on.
 *
 * A convention rather than a contract, which is why every unmatched half comes back null. A
 * `universal` macOS binary is deliberately not read as a chip: it answers for both, so reading
 * it as one would make a second Build agree with the reader's machine and quietly turn a
 * certain answer into a coin toss.
 */
export const platformIn = (name: string): Platform => {
  const said = name.toLowerCase()
  return {
    machine: MACHINES.find(([pattern]) => pattern.test(said))?.[1] ?? null,
    chip: CHIPS.find(([pattern]) => pattern.test(said))?.[1] ?? null
  }
}

/** Whether a filename installs itself, has to be unpacked, or says neither. */
export const formIn = (name: string): Form => {
  const said = name.toLowerCase()
  if (INSTALLER.test(said)) return "installer"
  if (ARCHIVE.test(said)) return "archive"
  return "unknown"
}

/**
 * Yours: the one Build that runs on the reader's own machine, or nothing.
 *
 * Nothing is a real answer here and is the point of the rule. Their page gives six files equal
 * weight and the r/github threads in `docs/spec/releases.md` are people taking the wrong one,
 * so a screen that names a file is making a promise. It only makes it when both halves of the
 * platform are known and agree, and when the Builds that agree come down to one.
 *
 * The one tie it breaks is the installer against the archive, which is a fact about the files
 * rather than a preference between them. A tie past that comes back empty and the screen names
 * every Build by platform instead.
 */
export const yoursAmong = (
  builds: ReadonlyArray<Build>,
  reader: Platform
): Option.Option<Build> => {
  if (reader.machine === null || reader.chip === null) return Option.none()

  const fits = builds.filter(
    (build) => build.platform.machine === reader.machine && build.platform.chip === reader.chip
  )

  const only = (among: ReadonlyArray<Build>): Option.Option<Build> => {
    const one = among.length === 1 ? among[0] : undefined
    return one === undefined ? Option.none() : Option.some(one)
  }

  if (fits.length < 2) return only(fits)
  return only(fits.filter((build) => build.form === "installer"))
}

const MACHINE_SAID: Record<Machine, string> = {
  macos: "macOS",
  linux: "Linux",
  windows: "Windows"
}

const CHIP_SAID: Record<Chip, string> = {
  arm64: "Apple silicon",
  x86_64: "Intel or AMD",
  x86: "32-bit Intel"
}

/**
 * The reader's own machine, in words, for the line above the download.
 *
 * "Apple silicon" rather than "arm64" because the reader is often not a developer, and the
 * whole reason this row exists is that `arm64`, `aarch64` and `x86_64` are the vocabulary the
 * page currently demands. On Linux and Windows the chip is said as the chip, since "Apple
 * silicon" is a Mac's word and no equally plain one exists for the rest.
 */
export const saidPlatform = (platform: Platform): string => {
  const machine = platform.machine === null ? null : MACHINE_SAID[platform.machine]
  if (machine === null) return "your machine"

  if (platform.chip === null) return machine
  if (platform.machine === "macos") return `${machine}, ${CHIP_SAID[platform.chip]}`
  return `${machine}, ${platform.chip}`
}

/**
 * The reader's machine out of what the browser will say, which on a Mac is not the truth.
 *
 * `navigator.platform` answers `MacIntel` on Apple silicon and has done deliberately for years,
 * so it settles the machine and can never settle the chip. Chrome's client hints do settle it:
 * `architecture` and `bitness` come back `arm`/`64` or `x86`/`64` from
 * `getHighEntropyValues`, and this runs in a Chrome extension, so asking is allowed. Both
 * halves are read where they are offered and left null where they are not.
 */
export const machineSaying = (said: string): Machine | null => {
  const lower = said.toLowerCase()
  if (lower.includes("mac") || lower.includes("darwin")) return "macos"
  if (lower.includes("win")) return "windows"
  if (lower.includes("linux") || lower.includes("x11") || lower.includes("android")) {
    return "linux"
  }
  return null
}

/** The chip out of Chrome's own two hints, or null where they say nothing usable. */
export const chipSaying = (architecture: string, bitness: string): Chip | null => {
  if (architecture === "arm" && bitness === "64") return "arm64"
  if (architecture === "arm64") return "arm64"
  if (architecture === "x86") return bitness === "32" ? "x86" : "x86_64"
  return null
}
