import { afterEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { CHIP_CLASS, EDIT_ID, plantGistLabelsPanel } from "./gistLabelsPanel"

const html = readFileSync("tests/fixtures/gistList.html", "utf8")
const pageOf = (source: string): Document => new DOMParser().parseFromString(source, "text/html")

afterEach(() => {
  document.body.innerHTML = ""
})

const rowFor = (page: Document, id: string): Element => {
  const row = [...page.querySelectorAll(".gist-snippet")].find((element) =>
    element.querySelector(`a[href="/octocat/${id}"]`) !== null
  )
  if (row === undefined) throw new Error(`no row for ${id}`)
  return row
}

describe("labels and a name, drawn on each row", () => {
  test("draws a chip for every Label the gist carries", () => {
    const page = pageOf(html)
    const kept = new Map([["aaa111", { labels: ["deploy", "runbook"], name: null }]])
    plantGistLabelsPanel(page, kept, () => {})

    const chips = [...rowFor(page, "aaa111").querySelectorAll(`.${CHIP_CLASS}`)].map((chip) =>
      chip.textContent?.trim()
    )
    expect(chips).toEqual(["deploy", "runbook"])
  })

  test("draws no chips on a gist never marked", () => {
    const page = pageOf(html)
    plantGistLabelsPanel(page, new Map(), () => {})

    expect(rowFor(page, "bbb222").querySelectorAll(`.${CHIP_CLASS}`).length).toBe(0)
  })

  test("shows the Name in place of the filename, where one was given", () => {
    const page = pageOf(html)
    const kept = new Map([["aaa111", { labels: [], name: "Staging deploy runbook" }]])
    plantGistLabelsPanel(page, kept, () => {})

    expect(rowFor(page, "aaa111").querySelector("strong.css-truncate-target")?.textContent?.trim()).toBe(
      "Staging deploy runbook"
    )
  })

  test("leaves the filename showing where no Name was given", () => {
    const page = pageOf(html)
    plantGistLabelsPanel(page, new Map(), () => {})

    expect(rowFor(page, "aaa111").querySelector("strong.css-truncate-target")?.textContent?.trim()).toBe(
      "deploy-notes.md"
    )
  })

  test("is planted once per row, not stacked on a second call", () => {
    const page = pageOf(html)
    plantGistLabelsPanel(page, new Map(), () => {})
    plantGistLabelsPanel(page, new Map(), () => {})

    expect(rowFor(page, "aaa111").querySelectorAll(`#${EDIT_ID}`).length).toBe(1)
  })

  test("writes nothing to a chip or a title a second call would draw the same way", () => {
    // The content script that plants this panel replants on every DOM mutation,
    // because GitHub can redraw a row without loading a document — and writing
    // to a chip or a title is itself a mutation. An unconditional redraw would
    // have the observer call this again forever; this is the regression test
    // for the guard that stops it.
    const page = pageOf(html)
    const kept = new Map([["aaa111", { labels: ["deploy"], name: "Staging runbook" }]])
    plantGistLabelsPanel(page, kept, () => {})

    const row = rowFor(page, "aaa111")
    const titleEl = row.querySelector("strong.css-truncate-target")
    const chipEl = row.querySelector(`.${CHIP_CLASS}`)

    plantGistLabelsPanel(page, kept, () => {})

    expect(row.querySelector("strong.css-truncate-target")).toBe(titleEl)
    expect(row.querySelector(`.${CHIP_CLASS}`)).toBe(chipEl)
  })
})

describe("editing a gist's own Labels and Name", () => {
  test("opens a form pre-filled with what is already kept, and commits on submit", () => {
    const page = pageOf(html)
    const kept = new Map([["aaa111", { labels: ["deploy"], name: "Staging runbook" }]])
    const changes: Array<{ id: string; labels: ReadonlyArray<string>; name: string | null }> = []
    plantGistLabelsPanel(page, kept, (id, labels, name) => changes.push({ id, labels, name }))

    const row = rowFor(page, "aaa111")
    const edit = row.querySelector<HTMLButtonElement>(`#${EDIT_ID}`)
    edit?.click()

    const labelsInput = row.querySelector<HTMLInputElement>('[data-gitquiet-field="labels"]')
    const nameInput = row.querySelector<HTMLInputElement>('[data-gitquiet-field="name"]')
    expect(labelsInput?.value).toBe("deploy")
    expect(nameInput?.value).toBe("Staging runbook")

    labelsInput!.value = "deploy, urgent"
    nameInput!.value = "Staging runbook v2"
    row.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    expect(changes).toEqual([{ id: "aaa111", labels: ["deploy", "urgent"], name: "Staging runbook v2" }])
  })

  test("redraws the chips and the title once a change is committed", () => {
    const page = pageOf(html)
    let kept = new Map()
    const plant = () =>
      plantGistLabelsPanel(page, kept, (id, labels, name) => {
        kept = new Map(kept).set(id, { labels, name })
        plant()
      })
    plant()

    const row = rowFor(page, "bbb222")
    row.querySelector<HTMLButtonElement>(`#${EDIT_ID}`)?.click()
    row.querySelector<HTMLInputElement>('[data-gitquiet-field="labels"]')!.value = "flaky"
    row.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    const chips = [...row.querySelectorAll(`.${CHIP_CLASS}`)].map((chip) => chip.textContent?.trim())
    expect(chips).toEqual(["flaky"])
  })
})
