import { describe, expect, test } from "bun:test"
import { installFont } from "./font"
import { OURS, ROOT_ID, takeOverPage } from "./mount"

const githubPage = (): Document => {
  const page = document.implementation.createHTMLDocument("github")

  // GitHub ships dozens of these, and they stay in the head when the body is
  // replaced.
  const link = page.createElement("link")
  link.rel = "stylesheet"
  link.href = "https://github.githubassets.com/assets/dark.css"
  const inline = page.createElement("style")
  inline.textContent = "body { font-family: 'Mona Sans VF'; background: #0d1117 }"
  page.head.append(link, inline)

  const original = page.createElement("div")
  original.id = "js-repo-pjax-container"
  original.textContent = "GitHub's own pull request page"
  page.body.appendChild(original)
  return page
}

describe("taking over GitHub's page", () => {
  test("removes GitHub's markup rather than rendering on top of it", () => {
    const page = githubPage()

    takeOverPage(page, () => {})

    expect(page.querySelector("#js-repo-pjax-container")).toBeNull()
    expect(page.body.childElementCount).toBe(1)
  })

  test("takes the document's own scrolling away, since we now own the screen", () => {
    const page = githubPage()

    takeOverPage(page, () => {})

    for (const element of [page.documentElement, page.body]) {
      expect(element.style.overflow).toBe("hidden")
      expect(element.style.margin).toBe("0px")
      expect(element.style.height).toBe("100%")
    }
  })

  test("clears GitHub's stylesheets, whose unlayered rules would outrank ours", () => {
    const page = githubPage()

    takeOverPage(page, () => {})

    expect(page.querySelectorAll('link[rel="stylesheet"], style')).toHaveLength(0)
  })

  test("leaves stylesheets of our own standing", () => {
    const page = githubPage()
    const ours = page.createElement("style")
    ours.setAttribute(OURS, "")
    ours.textContent = ":root { color-scheme: dark }"
    page.head.append(ours)

    takeOverPage(page, () => {})

    expect(page.querySelectorAll("style")).toHaveLength(1)
    expect(page.querySelector("style")?.textContent).toContain("color-scheme")
  })

  test("keeps clearing stylesheets GitHub loads after the takeover", async () => {
    const page = githubPage()
    takeOverPage(page, () => {})

    const late = page.createElement("link")
    late.rel = "stylesheet"
    late.href = "https://github.githubassets.com/assets/86851.module.css"
    page.head.append(late)
    await Promise.resolve()

    expect(page.querySelector('link[rel="stylesheet"]')).toBeNull()
  })

  test("leaves alone the styles our own components inject while running", async () => {
    const page = githubPage()
    takeOverPage(page, () => {})

    // What a scroll lock or a popover library adds when it opens.
    const injected = page.createElement("style")
    injected.textContent = "body { overflow: hidden }"
    page.head.append(injected)
    await Promise.resolve()

    expect(page.head.contains(injected)).toBe(true)
  })

  test("keeps the font declared through a second takeover of the same page", () => {
    const page = githubPage()

    takeOverPage(page, () => installFont(page, "chrome-extension://abc/fonts/InterVariable.woff2"))
    takeOverPage(page, () => {})

    expect(page.head.textContent).toContain("chrome-extension://abc/fonts/InterVariable.woff2")
  })

  test("hands the caller a container already mounted in the document", () => {
    const page = githubPage()
    const rendered: Array<string> = []

    takeOverPage(page, (container) => {
      rendered.push(container.id)
      container.textContent = "our interface"
    })

    expect(rendered).toEqual([ROOT_ID])
    expect(page.getElementById(ROOT_ID)?.textContent).toBe("our interface")
  })
})
