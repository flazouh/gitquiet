import { describe, expect, test } from "bun:test"
import { ROOT_ID, takeOverPage } from "./mount"

const githubPage = (): Document => {
  const page = document.implementation.createHTMLDocument("github")
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
