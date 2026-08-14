import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import { Effect, Option } from "effect"
import type { Attached, Build, Platform, Version } from "../domain/release"
import { formIn, platformIn } from "../domain/release"
import { ReleasesScreen, type Shown } from "./ReleasesScreen"

afterEach(cleanup)

const repo = { owner: "zeronsh", repo: "comet" }

const version = (what: Partial<Version> & Pick<Version, "tag">): Version => ({
  title: what.tag,
  url: `/zeronsh/comet/releases/tag/${what.tag}`,
  at: "2026-08-14T19:33:14Z",
  author: "github-actions",
  prerelease: false,
  latest: false,
  changes: [],
  remark: "",
  ...what
})

const change = (title: string, pullRequest: string) => ({
  title,
  author: "wingleeio",
  pullRequest,
  url: `https://github.com/zeronsh/comet/pull/${pullRequest}`
})

const build = (name: string, size: string): Build => ({
  name,
  url: `/zeronsh/comet/releases/download/v0.2.1/${name}`,
  size,
  digest: null,
  platform: platformIn(name),
  form: formIn(name)
})

const onAMac: Platform = { machine: "macos", chip: "arm64" }

const show = (
  versions: ReadonlyArray<Version>,
  attached?: Attached,
  machine: Platform = onAMac
) =>
  render(
    <ReleasesScreen
      repo={repo}
      load={() =>
        Effect.succeed<Shown>({
          versions,
          attached: attached === undefined ? Option.none() : Option.some(attached),
          machine
        })
      }
      onStepAside={() => {}}
    />
  )

/* The shape of the worked example: two Versions that changed something and three that did not. */
const asComet: ReadonlyArray<Version> = [
  version({ tag: "v0.2.1", latest: true }),
  version({ tag: "v0.2.0", changes: [change("Seamless local to synced switch", "79")] }),
  version({
    tag: "v0.1.65",
    changes: [
      change("feat(ui): add Tree-sitter syntax highlighting", "78"),
      change("Shortcuts: rebindable New session", "77")
    ]
  }),
  version({ tag: "v0.1.64" }),
  version({ tag: "v0.1.63" })
]

const files: Attached = {
  builds: [
    build("zeron-0.2.1-linux-x86_64.tar.gz", "21.4 MB"),
    build("zeron-0.2.1-macos-arm64-app.tar.gz", "23.1 MB"),
    build("zeron-0.2.1-macos-arm64.dmg", "23.8 MB")
  ],
  archives: [{ kind: "zip", url: "/zeronsh/comet/archive/refs/tags/v0.2.1.zip" }]
}

describe("a repository's releases", () => {
  test("draws every Change as a row a reader can act on", async () => {
    show(asComet)

    const first = await screen.findByRole("link", {
      name: "feat(ui): add Tree-sitter syntax highlighting"
    })

    expect(first.getAttribute("href")).toBe("https://github.com/zeronsh/comet/pull/78")
    expect(screen.getByRole("link", { name: "Shortcuts: rebindable New session" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Seamless local to synced switch" })).toBeTruthy()
  })

  /*
   * The count is the argument. Three Changes over five Versions is the ratio their own page draws
   * as five cards of equal size, and this line is what a reader would otherwise have to work out
   * by scrolling.
   */
  test("says how many Changes came out of how many Versions", async () => {
    show(asComet)

    expect(await screen.findByText("3 changes, over 5 versions")).toBeTruthy()
  })

  test("joins the Versions that said nothing into one line", async () => {
    show(asComet)

    expect(await screen.findByText("2 versions said nothing")).toBeTruthy()
    expect(screen.getByText("1 version said nothing")).toBeTruthy()
  })

  /* A tag that exists is a tag somebody may be looking for, so a marker still links to each. */
  test("keeps a way to every Version it did not give a row", async () => {
    show(asComet)

    const marked = await screen.findByRole("link", { name: "v0.1.64" })

    expect(marked.getAttribute("href")).toBe("/zeronsh/comet/releases/tag/v0.1.64")
  })

  test("names the tag once for a Version that carried two Changes", async () => {
    show(asComet)

    await screen.findByRole("link", { name: "Shortcuts: rebindable New session" })

    expect(screen.getAllByRole("link", { name: "v0.1.65" })).toHaveLength(1)
  })
})

describe("the one file this reader should take", () => {
  /*
   * Two Builds answer for a Mac on Apple silicon and the installer is the one drawn, which is the
   * whole of the download row: their own page offers six files of equal weight, and the most
   * upvoted complaint about it is a reader asking where the download button is.
   */
  test("names the Build that runs on the reader's own machine", async () => {
    show(asComet, files)

    const yours = await screen.findByRole("link", { name: /zeron-0\.2\.1-macos-arm64\.dmg/ })

    expect(yours.getAttribute("href")).toBe(
      "/zeronsh/comet/releases/download/v0.2.1/zeron-0.2.1-macos-arm64.dmg"
    )
    expect(screen.getByText("23.8 MB")).toBeTruthy()
  })

  test("says which machine it named it for, and where the other files are", async () => {
    show(asComet, files)

    const card = await screen.findByRole("region", { name: "Download" })

    expect(card.textContent).toContain("macOS, Apple silicon")
    expect(card.textContent).toContain("v0.2.1")
    /*
     * The rest are folded away, which is the whole argument of the row above them: two Builds
     * this reader's machine does not want, and the archive GitHub appended to the Version.
     */
    expect(screen.getByText("3 other files")).toBeTruthy()
  })

  /*
   * Nothing named, and every Build drawn by platform instead. A reader on Windows offered a `.dmg`
   * is the mistake this screen exists to stop, so the row would rather say it cannot tell.
   */
  test("names nothing where no Build runs on the reader's machine", async () => {
    show(asComet, files, { machine: "windows", chip: "x86_64" })

    expect(
      await screen.findByText("No single file is named for Windows, x86_64. All of them are below.")
    ).toBeTruthy()
    /* Nothing is held back: the fold carries every Build, plus the archives GitHub appended. */
    expect(screen.getByText("4 other files")).toBeTruthy()
  })

  /*
   * The pre-release rule, which their own "Latest" label already encodes. Read on 2026-08-14, 89 of
   * the 100 newest releases of `vercel/next.js` are pre-releases, so the newest Version on a page
   * like that is a canary and offering it is the same mistake as offering the wrong platform.
   */
  test("offers the newest Version that is not a pre-release", async () => {
    show(
      [
        version({ tag: "v16.0.1-canary.9", prerelease: true }),
        version({ tag: "v16.0.0", changes: [change("Ship the router", "1")] })
      ],
      files
    )

    const card = await screen.findByRole("region", { name: "Download" })

    expect(card.textContent).toContain("v16.0.0")
    expect(card.textContent).not.toContain("canary")
  })

  test("draws no download row at all until the second read lands", async () => {
    show(asComet)

    await screen.findByText("3 changes, over 5 versions")

    expect(screen.queryByText(/zeron-0\.2\.1-macos-arm64\.dmg/)).toBeNull()
  })
})

describe("a repository with nothing published", () => {
  test("says so rather than drawing an empty list", async () => {
    show([])

    expect(await screen.findByText("This repository has published no releases.")).toBeTruthy()
  })
})
