import { describe, expect, test } from "bun:test"
import { readingTheCode, repositoryTabs, tabsWeCanName, theirRowIsFor } from "./theirNav"
import type { Tab } from "./theirNav"

/**
 * The markup here is not invented: it is `nav[aria-label="Repository"]` as
 * `scripts/probe-repo-nav-dom.js` read it off a live pull request page, down to the count
 * living in a `CounterLabel` span with a visually hidden copy beside it and the current tab
 * saying so with `aria-current="page"`.
 */
const theirRow = (tabs: string): Document => {
  const page = document.implementation.createHTMLDocument("github")
  page.body.innerHTML = `
    <header class="GlobalNav styles-module__appHeader__YzYWk" aria-label="Global navigation menu">
      <nav aria-label="Repository" class="prc-components-UnderlineWrapper-eT-Yj LocalNavigation">
        <ul class="prc-UnderlineNav-ItemsList-oj8gN">${tabs}</ul>
      </nav>
    </header>
  `
  return page
}

const tab = (
  name: string,
  href: string,
  { count, here }: { readonly count?: number; readonly here?: boolean } = {}
): string =>
  `<li class="prc-UnderlineNav-UnderlineNavItem-syRjR">
     <a href="${href}"${here === true ? ' aria-current="page"' : ""}>
       <span>${name}</span>
       ${count === undefined ? "" : `<span class="prc-CounterLabel-CounterLabel-X-kRU">${count}</span><span class="prc-VisuallyHidden-VisuallyHidden-Q0qSB">(${count})</span>`}
     </a>
   </li>`

describe("reading their repository nav", () => {
  test("names every tab, in their order, with where each goes", () => {
    const page = theirRow(
      tab("Code", "/flowline-labs/flowline") +
        tab("Issues", "/flowline-labs/flowline/issues", { count: 183 }) +
        tab("Pull requests", "/flowline-labs/flowline/pulls", { count: 8, here: true }) +
        tab("Settings", "/flowline-labs/flowline/settings")
    )

    expect(repositoryTabs(page).map((one) => one.name)).toEqual([
      "Code",
      "Issues",
      "Pull requests",
      "Settings"
    ])
    expect(repositoryTabs(page).map((one) => one.href)).toEqual([
      "/flowline-labs/flowline",
      "/flowline-labs/flowline/issues",
      "/flowline-labs/flowline/pulls",
      "/flowline-labs/flowline/settings"
    ])
  })

  test("keeps a count where they have one, and none where they do not", () => {
    const page = theirRow(
      tab("Code", "/o/r") +
        tab("Issues", "/o/r/issues", { count: 183 }) +
        tab("Actions", "/o/r/actions")
    )
    const [code, issues, actions] = repositoryTabs(page)

    expect(code?.count).toBeUndefined()
    expect(issues?.count).toBe(183)
    expect(actions?.count).toBeUndefined()
  })

  test("the count is not left in the name, in either of the two copies they draw", () => {
    const page = theirRow(tab("Issues", "/o/r/issues", { count: 183 }))

    expect(repositoryTabs(page)[0]?.name).toBe("Issues")
  })

  test("marks the tab they say is current", () => {
    const page = theirRow(
      tab("Code", "/o/r") + tab("Pull requests", "/o/r/pulls", { count: 8, here: true })
    )

    expect(repositoryTabs(page).map((one) => one.here)).toEqual([false, true])
  })

  test("answers nothing on a page without their row, which is Home", () => {
    const page = document.implementation.createHTMLDocument("github")
    page.body.innerHTML = `<header class="GlobalNav" aria-label="Global navigation menu"></header>`

    expect(repositoryTabs(page)).toEqual([])
  })

  test("is not fooled by a nav of ours that happens to hold links", () => {
    const page = theirRow(tab("Code", "/o/r"))
    page.body.insertAdjacentHTML(
      "afterbegin",
      `<div id="gitquiet-bar"><nav aria-label="Repository"><a href="/somewhere">Ours</a></nav></div>`
    )

    expect(repositoryTabs(page).map((one) => one.name)).toEqual(["Code"])
  })
})

/**
 * The two we can name without them, for the moment before their row lands.
 */
describe("the tabs an address alone can give", () => {
  const inFlowline = { owner: "flowline-labs", repo: "flowline" }

  test("names the two every repository has, with where each goes", () => {
    expect(tabsWeCanName(inFlowline, "/flowline-labs/flowline")).toEqual([
      { name: "Code", href: "/flowline-labs/flowline", here: true },
      { name: "Pull requests", href: "/flowline-labs/flowline/pulls", here: false }
    ])
  })

  test("offers no Issues, a repository being free to switch them off", () => {
    // `octo-org/octo-repo` has, and a tab that redirects to the page beside it is
    // worse than a tab that is not there for the second their row takes to arrive.
    const named = tabsWeCanName(inFlowline, "/flowline-labs/flowline").map((one) => one.name)

    expect(named).not.toContain("Issues")
  })

  test("counts nothing, because nothing here knows how many", () => {
    for (const one of tabsWeCanName(inFlowline, "/flowline-labs/flowline/pulls"))
      expect(one.count).toBeUndefined()
  })

  test("says which one is being read, from the address it was given", () => {
    const here = (path: string) => tabsWeCanName(inFlowline, path).find((one) => one.here)?.name

    expect(here("/flowline-labs/flowline")).toBe("Code")
    expect(here("/flowline-labs/flowline/tree/main/src")).toBe("Code")
    expect(here("/flowline-labs/flowline/pulls")).toBe("Pull requests")
    expect(here("/flowline-labs/flowline/pull/21/files")).toBe("Pull requests")
    expect(here("/flowline-labs/flowline/issues")).toBeUndefined()
  })

  test("says nothing at all about somebody else's repository", () => {
    // The address is how `here` is decided, so an address belonging to another repository
    // would mark a tab of ours as current on a page that is not ours at all.
    expect(tabsWeCanName(inFlowline, "/other/thing/pulls").every((one) => !one.here)).toBe(true)
  })
})

/**
 * Whose row it is, which is the whole of what a soft navigation gets wrong.
 */
describe("whether a row that was read belongs to the repository being read", () => {
  const inBun = { owner: "oven-sh", repo: "bun" }

  const row = (root: string): ReadonlyArray<Tab> => [
    { name: "Code", href: root, here: false },
    { name: "Pull requests", href: `${root}/pulls`, here: true }
  ]

  test("says yes to the row of the repository in hand", () => {
    expect(theirRowIsFor(inBun, row("/oven-sh/bun"))).toBe(true)
  })

  test("says no to another repository's row, which is what the address swap leaves behind", () => {
    // GitHub changes the address before it replaces the row, so a read taken on
    // the change finds the row of the repository just left. Drawn, it puts that
    // repository's addresses under this one's name.
    expect(theirRowIsFor(inBun, row("/octo-org/hello-world"))).toBe(false)
  })

  test("says no to an empty row, there being no repository in it to match", () => {
    expect(theirRowIsFor(inBun, [])).toBe(false)
  })

  test("minds neither the case they write it in nor a whole address", () => {
    expect(theirRowIsFor(inBun, row("/OVEN-SH/Bun"))).toBe(true)
    expect(theirRowIsFor(inBun, row("https://github.com/oven-sh/bun"))).toBe(true)
  })

  test("takes one row of the repository as enough, an odd link out being theirs to add", () => {
    // Their row carries what they like in it, and a single entry pointing at an
    // organisation page is not a reason to throw away the counts and Insights.
    const mixed = [
      { name: "Pull requests", href: "/oven-sh/bun/pulls", here: true },
      { name: "Projects", href: "/orgs/oven-sh/projects", here: false }
    ]

    expect(theirRowIsFor(inBun, mixed)).toBe(true)
  })
})

describe("whether the reader is on the repository's own page", () => {
  const inOri = { owner: "octo-org", repo: "octo-repo" }

  test("says yes on the repository itself, and on a file inside it", () => {
    expect(readingTheCode(inOri, "/octo-org/octo-repo")).toBe(true)
    expect(readingTheCode(inOri, "/octo-org/octo-repo/tree/main/src")).toBe(true)
    expect(readingTheCode(inOri, "/octo-org/octo-repo/blob/main/README.md")).toBe(true)
  })

  test("says no on a page of issues, whatever their own row claims there", () => {
    /*
     * This repository has Issues switched off, and GitHub answers `/issues` with the list
     * anyway while marking Code as the current tab. Believing them put "you are here" on the
     * repository's name while the reader was reading issues.
     */
    expect(readingTheCode(inOri, "/octo-org/octo-repo/issues")).toBe(false)
    expect(readingTheCode(inOri, "/octo-org/octo-repo/issues/1234")).toBe(false)
    expect(readingTheCode(inOri, "/octo-org/octo-repo/pulls")).toBe(false)
  })

  test("says no about a repository that is not the one it was asked about", () => {
    expect(readingTheCode(inOri, "/other/thing")).toBe(false)
    expect(readingTheCode(inOri, "/octo-org/octo-repo-docs")).toBe(false)
  })
})
