import { beforeEach, describe, expect, it, mock } from "bun:test"

/**
 * The bridge, which does not exist outside the app.
 *
 * `rpc.ts` builds Electrobun's view side as its modules load, and that reaches for a
 * window this test does not have. Faked here so the rule under test can be imported at
 * all, and so what it asks the main process for can be read back.
 */
const asked: Array<{ readonly method: string; readonly params: unknown }> = []

void mock.module("electrobun/view", () => ({
  Electroview: class {
    static defineRPC = (given: unknown) => given
    rpc = {
      request: {
        openOutside: (params: unknown) => {
          asked.push({ method: "openOutside", params })
          return Promise.resolve({ ok: true })
        }
      }
    }
  }
}))

const { keepLinksOutside } = await import("./outside")
const { nowShowing, openTheList } = await import("./showing")

const press = (html: string, how: Partial<MouseEventInit> = {}) => {
  document.body.innerHTML = html
  const link = document.querySelector("a")!
  const kind = how.button === 1 ? "auxclick" : "click"
  const followed = link.dispatchEvent(
    new MouseEvent(kind, { bubbles: true, cancelable: true, button: 0, ...how })
  )
  return { prevented: followed === false }
}

const A_PULL = "https://github.com/citrolabs/ego-lite/pull/193"

beforeEach(() => {
  asked.length = 0
  openTheList()
})

/*
 * The rule, rather than the decision it is made of. `where.ts` is tested on its own; what
 * is tested here is that a press is answered, and answered once.
 */
describe("the rule that keeps this window off other people's pages", () => {
  it("is installed once for the document, however many times it is asked for", () => {
    keepLinksOutside()
    keepLinksOutside()
    keepLinksOutside()

    press(`<a href="https://example.com/why">Why</a>`)

    expect(asked.length).toBe(1)
  })

  it("hands a page this window does not draw to the reader's browser", () => {
    keepLinksOutside()

    const { prevented } = press(`<a href="https://example.com/why">Why</a>`)

    expect(prevented).toBe(true)
    expect(asked[0]).toEqual({ method: "openOutside", params: { url: "https://example.com/why" } })
  })

  it("opens a pull request in here instead, and asks the main process for nothing", () => {
    keepLinksOutside()

    const { prevented } = press(`<a href="${A_PULL}">#193</a>`)

    expect(prevented).toBe(true)
    expect(nowShowing()).toEqual({
      at: "card",
      reference: { owner: "citrolabs", repo: "ego-lite", number: 193 }
    })
    expect(asked.length).toBe(0)
  })

  /*
   * One press, one answer. A middle press raises `auxclick` here and raised `click` with
   * button 1 in engines of a few years ago, so both are listened for — and each listener
   * answers its own button only, because a press answered twice is two tabs for one
   * press with nothing on the screen to say why.
   */
  it("answers a middle press once, though two listeners hear it", () => {
    keepLinksOutside()

    press(`<a href="${A_PULL}">#193</a>`, { button: 1 })

    expect(asked.length).toBe(1)
    expect(nowShowing()).toEqual({ at: "list" })
  })

  it("stops a link it cannot place, and says so where somebody will read it", () => {
    keepLinksOutside()
    const warned: Array<string> = []
    const realWarn = console.warn
    console.warn = (...said: ReadonlyArray<unknown>) => warned.push(said.map(String).join(" "))

    const { prevented } = press(`<a href="sftp://box/thing">Nowhere this knows</a>`)

    console.warn = realWarn
    expect(prevented).toBe(true)
    expect(asked.length).toBe(0)
    expect(warned.length).toBe(1)
    expect(warned[0]).toContain("sftp://box/thing")
  })

  it("leaves a jump inside the page to the page", () => {
    keepLinksOutside()

    const { prevented } = press(`<a href="#top">Top</a>`)

    expect(prevented).toBe(false)
    expect(asked.length).toBe(0)
  })
})
