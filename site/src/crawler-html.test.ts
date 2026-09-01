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
})
