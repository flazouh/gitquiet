import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { COMPARED } from "./compare/pages"

/**
 * The HTML files themselves, not a built bundle. A crawler that never runs
 * JavaScript reads these, and a vite build would only prove the bundler still
 * copies them.
 */
const html = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")

const pageOf = (source: string): string => {
  const match = /<div id="page">([\s\S]*?)<\/div>/.exec(source)
  if (match?.[1] === undefined) throw new Error("#page is missing")
  return match[1]
}

const h1In = (source: string): string => {
  const match = /<h1>([\s\S]*?)<\/h1>/.exec(pageOf(source))
  if (match?.[1] === undefined) throw new Error("no h1 inside #page")
  return match[1].trim()
}

const titleIn = (source: string): string => {
  const match = /<title>([\s\S]*?)<\/title>/.exec(source)
  if (match?.[1] === undefined) throw new Error("no title")
  return match[1].trim()
}

const titleFromH1 = (name: string, h1: string): string => {
  const stem = h1.replace(/\.$/, "")
  return `GitQuiet vs ${name}: ${stem.charAt(0).toLowerCase()}${stem.slice(1)}`
}

describe("crawler-visible copy inside #page", () => {
  test("home has the live h1", () => {
    expect(h1In(html("../index.html"))).toBe("A faster, quieter GitHub.")
  })

  test("install has the live h1", () => {
    expect(h1In(html("../install.html"))).toBe("Install GitQuiet.")
  })

  test.each([...COMPARED])("$slug has the live h1, dek and we", (page) => {
    const source = html(`../compare/${page.slug}.html`)
    expect(h1In(source)).toBe(page.h1)
    expect(source).toContain(page.dek)
    expect(source).toContain(page.we)
  })

  test("github-pr-inbox has the live h1, and is not a fifth compare", () => {
    const source = html("../github-pr-inbox.html")
    expect(h1In(source)).toBe("A GitHub PR inbox, in the tab")
    expect(source).not.toContain("/compare/pullwatch")
    expect(source).not.toContain("/compare/attention-set")
  })

  test("install crawler copy links the inbox job", () => {
    expect(html("../install.html")).toContain("/github-pr-inbox")
  })

  test("compare pages stay four", () => {
    expect(COMPARED.map((page) => page.slug)).toEqual([
      "prflow",
      "github-pr-sidebar",
      "refined-github",
      "octobox"
    ])
  })
})

describe("crawler-visible titles", () => {
  test("install does not claim Safari is on the Mac App Store", () => {
    const source = html("../install.html")
    expect(source).not.toContain("Mac App Store")
    expect(source).toContain("Safari disk image")
  })

  test.each([...COMPARED])("$slug title uses the live h1", (page) => {
    const source = html(`../compare/${page.slug}.html`)
    const titled = titleFromH1(page.name, page.h1)
    expect(titleIn(source)).toBe(titled)
    expect(source).toContain(`property="og:title" content="${titled}"`)
    expect(source).toContain(`name="twitter:title" content="${titled}"`)
  })
})
