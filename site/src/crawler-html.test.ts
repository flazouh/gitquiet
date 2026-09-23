import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { COMPARED } from "./compare/pages"

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

const attr = (source: string, name: string): string => {
  const quoted = new RegExp(`${name}="([^"]*)"`).exec(source)
  if (quoted?.[1] === undefined) throw new Error(`missing ${name}`)
  return quoted[1]
}

const titleFromH1 = (name: string, h1: string): string => {
  const stem = h1.replace(/\.$/, "")
  return `GitQuiet vs ${name}: ${stem.charAt(0).toLowerCase()}${stem.slice(1)}`
}

const titleOf = (page: (typeof COMPARED)[number]): string =>
  page.slug === "github-pr-sidebar"
    ? "GitQuiet vs GitHub PR Sidebar: one screen, not a side panel"
    : titleFromH1(page.name, page.h1)

const META = {
  prflow:
    "GitQuiet is in the tab on github.com. PRFlow is a Chromium side panel with a PAT. No extra login. Filed by next action. Not an AI reviewer.",
  "github-pr-sidebar":
    "GitQuiet is one screen in the tab. GitHub PR Sidebar is a Chromium side panel with a PAT; clicks open a new tab. Not an AI reviewer.",
  "refined-github":
    "Refined GitHub polishes github.com. GitQuiet is a queue: every pull request you are in, sorted by next action. No extra login. Not an AI reviewer.",
  octobox:
    "Octobox is a hosted notifications inbox with its own login. GitQuiet is on github.com. No extra login. Filed by next action. Not an AI reviewer."
} as const

describe("crawler-visible copy inside #page", () => {
  test("home has the live h1", () => {
    expect(h1In(html("../index.html"))).toBe("A faster, quieter GitHub.")
  })

  test("home crawler copy links the two job pages", () => {
    const source = html("../index.html")
    expect(source).toContain("/github-pr-inbox")
    expect(source).toContain("/github-review-queue")
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

  test("github-review-queue has the live h1, and is not a fifth compare", () => {
    const source = html("../github-review-queue.html")
    expect(h1In(source)).toBe("A GitHub review queue, in the tab")
    expect(source).not.toContain("/compare/pullwatch")
    expect(source).not.toContain("/compare/attention-set")
  })


  test("inbox crawler copy links the sibling review-queue job", () => {
    expect(html("../github-pr-inbox.html")).toContain("/github-review-queue")
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

describe("crawler-visible titles and metas", () => {

  test.each([...COMPARED])("$slug title, meta, og and twitter", (page) => {
    const source = html(`../compare/${page.slug}.html`)
    const titled = titleOf(page)
    const described = META[page.slug as keyof typeof META]
    expect(titleIn(source)).toBe(titled)
    expect(source).toContain(`name="description" content="${described}"`)
    expect(source).toContain(`property="og:title" content="${titled}"`)
    expect(source).toContain(`property="og:description" content="${described}"`)
    expect(source).toContain(`name="twitter:title" content="${titled}"`)
    expect(source).toContain(`name="twitter:description" content="${described}"`)
  })

  test("compare canonicals stay unique and locked", () => {
    const canonicals = COMPARED.map((page) => {
      const source = html(`../compare/${page.slug}.html`)
      const href = attr(source, `rel="canonical" href`)
      const og = attr(source, `property="og:url" content`)
      expect(href).toBe(`https://gitquiet.com/compare/${page.slug}`)
      expect(og).toBe(href)
      return href
    })
    expect(canonicals).toEqual([
      "https://gitquiet.com/compare/prflow",
      "https://gitquiet.com/compare/github-pr-sidebar",
      "https://gitquiet.com/compare/refined-github",
      "https://gitquiet.com/compare/octobox"
    ])
    expect(new Set(canonicals).size).toBe(4)
  })

  test("compare HTML files do not say working set", () => {
    for (const page of COMPARED) {
      expect(html(`../compare/${page.slug}.html`)).not.toContain("working set")
    }
  })

  test("compare HTML files never say GitHub is where your work lives", () => {
    for (const page of COMPARED) {
      expect(html(`../compare/${page.slug}.html`)).not.toContain(
        "GitHub is where your work lives"
      )
    }
  })
})

describe("first-paint shell", () => {
  test("home hides the crawler main on sober dark first paint", () => {
    const source = html("../index.html")
    expect(source).toContain("#page > main")
    expect(source).toContain("clip: rect(0, 0, 0, 0)")
    expect(source).toContain("100dvh")
    expect(source).toContain("#0c0c0c")
    expect(source).not.toContain("#ff9ad1")
    expect(source).not.toContain("#0c0b10")
  })


  test("job and compare pages hide the crawler main on paper", () => {
    const files = [
      "../github-pr-inbox.html",
      "../github-review-queue.html",
      ...COMPARED.map((page) => `../compare/${page.slug}.html` as const)
    ]
    for (const file of files) {
      const source = html(file)
      expect(source).toContain("#page > main")
      expect(source).toContain("clip: rect(0, 0, 0, 0)")
      expect(source).toContain("100dvh")
      expect(source).toContain("#f2f2ee")
    }
  })
})

describe("no recycled marketing shots", () => {
  test("site/src never loads public shot PNGs", () => {
    const root = fileURLToPath(new URL(".", import.meta.url))
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs")
    const { join } = require("node:path") as typeof import("node:path")
    const walk = (dir: string): string[] => {
      const out: string[] = []
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) out.push(...walk(path))
        else if (/\.(tsx?|css)$/.test(name) && !name.endsWith(".test.ts")) out.push(path)
      }
      return out
    }
    // Public asset URLs only — fixture imports from repo `shots/` (Supplied/views) are fine.
    const publicShot = /["'`]\/shots\/|src=\{\`\/shots\//
    for (const file of walk(root)) {
      const text = readFileSync(file, "utf8")
      expect(publicShot.test(text), file).toBe(false)
    }
  })
})
