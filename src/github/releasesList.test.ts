import { describe, expect, test } from "bun:test"
import { Option } from "effect"
import { isBare, releasesIn, rowsIn, yoursAmong } from "../domain/release"
import { buildsOnPage, isKeptVersions, versionsOnPage } from "./releasesList"

/*
 * `zeronsh/comet/releases` as GitHub served it on 2026-08-14: ten Versions of a repository that
 * published 67 in 23 days, four of the ten carrying no notes beyond a link to the comparison.
 * Every element and attribute a parser touches is theirs, unedited.
 */
const real = await Bun.file("tests/fixtures/releasesList.html").text()

/* Their `expanded_assets/v0.2.1` fragment, which is the only place a filename appears at all. */
const assets = await Bun.file("tests/fixtures/releaseAssets.html").text()

const versions = versionsOnPage(real)

describe("reading their releases list", () => {
  test("finds every Version on the page", () => {
    expect(versions).toHaveLength(10)
  })

  test("reads the newest Version's facts as their page prints them", () => {
    const first = versions[0]

    expect(first?.tag).toBe("v0.2.1")
    expect(first?.title).toBe("v0.2.1")
    expect(first?.url).toBe("/zeronsh/comet/releases/tag/v0.2.1")
    expect(first?.at).toBe("2026-08-14T19:33:14Z")
    expect(first?.author).toBe("github-actions")
    expect(first?.latest).toBe(true)
    expect(first?.prerelease).toBe(false)
  })

  test("reads every Change of a Version that names two", () => {
    const version = versions.find((one) => one.tag === "v0.1.65")

    expect(version?.changes).toEqual([
      {
        title: "feat(ui): add Tree-sitter syntax highlighting",
        author: "jsgrrchg",
        pullRequest: "78",
        url: "https://github.com/zeronsh/comet/pull/78"
      },
      {
        title: "Shortcuts: rebindable New session (mod-n)",
        author: "SinaKhalili",
        pullRequest: "77",
        url: "https://github.com/zeronsh/comet/pull/77"
      }
    ])
  })

  /*
   * The count this screen exists for. Their page draws ten cards of equal weight; three of the ten
   * say nothing at all, and over all 67 Versions of this repository it is 30.
   */
  test("finds the Versions whose notes say nothing", () => {
    const bare = versions.filter(isBare).map((one) => one.tag)

    expect(bare).toEqual(["v0.2.1", "v0.1.64", "v0.1.63"])
  })

  /*
   * Their generated notes are a heading, a list of pull requests and a link to the comparison,
   * and none of those three is prose. A Version carrying only them has no remark, or every
   * Version would have one and the field would say nothing.
   */
  test("takes their own furniture out of the remark", () => {
    expect(versions.find((one) => one.tag === "v0.1.65")?.remark).toBe("")
    expect(versions.find((one) => one.tag === "v0.2.0")?.remark).toBe("")
  })

  test("keeps their order, which is newest first", () => {
    expect(versions.map((one) => one.tag)).toEqual([
      "v0.2.1",
      "v0.2.0",
      "v0.1.65",
      "v0.1.64",
      "v0.1.63",
      "v0.1.62",
      "v0.1.61",
      "v0.1.60",
      "v0.1.59",
      "v0.1.58"
    ])
  })

  test("comes back empty on a page that has stopped looking like theirs", () => {
    expect(versionsOnPage("<html><body><div>Something else</div></body></html>")).toEqual([])
  })
})

describe("folding Versions into the rows a reader reads", () => {
  const rows = rowsIn(versions)

  /*
   * Ten cards become ten rows, and the shape of the reduction is the point rather than the count:
   * eight of the rows are a Change somebody can act on, and the three Versions that said nothing
   * are two markers rather than three cards, because two of the three were consecutive.
   */
  test("draws a Change per Change and a marker per run of silence", () => {
    expect(rows.filter((row) => row.kind === "change")).toHaveLength(8)
    expect(rows.filter((row) => row.kind === "bare")).toHaveLength(2)
  })

  test("joins consecutive Bare Versions into one marker", () => {
    const markers = rows.flatMap((row) =>
      row.kind === "bare" ? [row.versions.map((one) => one.tag)] : []
    )

    expect(markers).toEqual([["v0.2.1"], ["v0.1.64", "v0.1.63"]])
  })

  test("names the tag once per Version rather than once per Change", () => {
    const firsts = rows.flatMap((row) =>
      row.kind === "change" && row.first ? [row.version.tag] : []
    )

    /* Seven Versions, eight Changes: v0.1.65 carried two and names its tag once. */
    expect(firsts).toEqual([
      "v0.2.0",
      "v0.1.65",
      "v0.1.62",
      "v0.1.61",
      "v0.1.60",
      "v0.1.59",
      "v0.1.58"
    ])
  })
})

describe("reading their asset fragment", () => {
  const { builds, archives } = buildsOnPage(assets)

  test("finds every Build, which their list page names nowhere", () => {
    expect(builds.map((one) => one.name)).toEqual([
      "zeron-0.2.1-linux-aarch64.tar.gz",
      "zeron-0.2.1-linux-x86_64.tar.gz",
      "zeron-0.2.1-macos-arm64-app.tar.gz",
      "zeron-0.2.1-macos-arm64.dmg"
    ])
  })

  test("reads the size and the digest their fragment carries", () => {
    const dmg = builds.find((one) => one.name.endsWith(".dmg"))

    expect(dmg?.size).toBe("23.8 MB")
    expect(dmg?.digest).toBe("sha256:34e2b38fe9f1fa2d98e8502d2cc781f47cec5ae92c4385ce50f08c95af233d7f")
    expect(dmg?.platform).toEqual({ machine: "macos", chip: "arm64" })
    expect(dmg?.form).toBe("installer")
  })

  /*
   * Their two archives, kept apart from the Builds. Told apart by the address and not the name,
   * so a maintainer who uploads a file called "Source code" still gets a Build.
   */
  test("keeps the Source Archives out of the Builds", () => {
    expect(archives).toEqual([
      { kind: "zip", url: "/zeronsh/comet/archive/refs/tags/v0.2.1.zip" },
      { kind: "tar.gz", url: "/zeronsh/comet/archive/refs/tags/v0.2.1.tar.gz" }
    ])
    expect(builds.some((one) => one.name.startsWith("Source code"))).toBe(false)
  })

  /*
   * The decision the screen exists to make. Two Builds answer for a Mac on Apple silicon, and the
   * installer is the one, which their own download counts corroborate at 186 against 11.
   */
  test("names one Build for a Mac on Apple silicon", () => {
    const yours = yoursAmong(builds, { machine: "macos", chip: "arm64" })

    expect(Option.getOrNull(yours)?.name).toBe("zeron-0.2.1-macos-arm64.dmg")
  })

  test("names one Build for Linux on Intel", () => {
    const yours = yoursAmong(builds, { machine: "linux", chip: "x86_64" })

    expect(Option.getOrNull(yours)?.name).toBe("zeron-0.2.1-linux-x86_64.tar.gz")
  })

  /*
   * Nothing, rather than the closest thing. This repository ships no Windows build at all, and
   * offering a reader on Windows a `.dmg` is the mistake the whole screen is against.
   */
  test("names nothing where no Build runs on the reader's machine", () => {
    expect(Option.isNone(yoursAmong(builds, { machine: "windows", chip: "x86_64" }))).toBe(true)
  })

  test("names nothing where the reader's own machine is not known", () => {
    expect(Option.isNone(yoursAmong(builds, { machine: "macos", chip: null }))).toBe(true)
  })
})

describe("whose page an address is", () => {
  test("takes a repository's releases list", () => {
    expect(releasesIn("https://github.com/zeronsh/comet/releases")).toEqual(
      Option.some({ owner: "zeronsh", repo: "comet" })
    )
  })

  test("takes it with their own query on the end, which this screen ignores", () => {
    expect(releasesIn("https://github.com/zeronsh/comet/releases?page=3")).toEqual(
      Option.some({ owner: "zeronsh", repo: "comet" })
    )
  })

  /* One Version, all their tags, and a repository's front page are all somebody else's. */
  test("leaves every neighbouring address alone", () => {
    for (const path of [
      "/zeronsh/comet/releases/tag/v0.2.1",
      "/zeronsh/comet/releases/latest",
      "/zeronsh/comet/releases/expanded_assets/v0.2.1",
      "/zeronsh/comet/tags",
      "/zeronsh/comet",
      "/zeronsh/comet/actions"
    ]) {
      expect(Option.isNone(releasesIn(`https://github.com${path}`))).toBe(true)
    }
  })

  test("leaves another host alone", () => {
    expect(Option.isNone(releasesIn("https://example.com/zeronsh/comet/releases"))).toBe(true)
  })
})

describe("what came out of the store", () => {
  test("takes what this version of the code wrote", () => {
    expect(isKeptVersions(versions)).toBe(true)
    expect(isKeptVersions([])).toBe(true)
  })

  test("refuses an entry written before a Version carried its prose", () => {
    const { remark, ...older } = versions[1] ?? {}

    expect(isKeptVersions([older])).toBe(false)
  })
})
