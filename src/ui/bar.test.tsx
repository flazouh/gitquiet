import { afterEach, describe, expect, test } from "bun:test"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Option } from "effect"
import { Bar } from "./Bar"
import type { Tab } from "./theirNav"

// `screen` reads the whole document, and every test file in a run shares one.
// Without this, what this file renders is still in the body when the next file
// asks for a banner, and both of them find two.
afterEach(cleanup)

const THEIR_TABS: ReadonlyArray<Tab> = [
  { name: "Code", href: "/flowline-labs/flowline", here: false },
  { name: "Issues", href: "/flowline-labs/flowline/issues", count: 183, here: false },
  { name: "Pull requests", href: "/flowline-labs/flowline/pulls", count: 8, here: true },
  { name: "Discussions", href: "/flowline-labs/flowline/discussions", here: false },
  { name: "Actions", href: "/flowline-labs/flowline/actions", here: false },
  { name: "Projects", href: "/flowline-labs/flowline/projects", here: false },
  { name: "Security and quality", href: "/flowline-labs/flowline/security", here: false },
  { name: "Insights", href: "/flowline-labs/flowline/network/dependencies", here: false },
  { name: "Settings", href: "/flowline-labs/flowline/settings", here: false }
]

const someone = { login: "flazouh", faceUrl: Option.none() }

const repository = (nameWithOwner: string) => {
  const [owner = "", repo = ""] = nameWithOwner.split("/")
  return {
    owner,
    repo,
    nameWithOwner,
    faceUrl: Option.none(),
    ofAnOrganisation: false,
    isPrivate: false,
    isEmpty: false
  }
}

const THEIRS = [
  repository("flowline-labs/flowline"),
  repository("flazouh/gitquiet"),
  repository("octo-org/octo-repo")
]

describe("the bar, on Home", () => {
  test("does not repeat the Destination, which the Rail beneath it already names", () => {
    // It said "Working Set 4 yours" twenty pixels above a Rail row reading "Working Set 4".
    // A crumb earns its place by saying where you are where nothing else does, and on Home
    // something else does.
    render(<Bar where={{ kind: "home" }} />)

    const bar = screen.getByRole("banner")
    expect(bar.textContent).not.toContain("Working Set")
    expect(bar.textContent).not.toContain("4")
  })

  test("still stands for something, so the strip is ours rather than an empty rule", () => {
    render(<Bar where={{ kind: "home" }} />)

    expect(screen.getByRole("banner").textContent).not.toContain("Repositories")
    expect(screen.getByLabelText("Home")).toBeDefined()
    // Not filled with the accent while standing on Home. It is the leftmost thing in the bar
    // and the only mark of ours up there, and a coloured square in that corner reads as a
    // badge for the extension rather than as a way back to the Working Set.
    expect(screen.getByLabelText("Home").className).not.toContain("bg-accent")
  })

  test("draws none of their repository tabs, there being no repository", () => {
    render(<Bar where={{ kind: "home" }} />)

    expect(screen.queryByLabelText("Repository")).toBeNull()
  })
})

describe("the bar, in a repository", () => {
  const inFlowline = {
    kind: "repository",
    owner: "flowline-labs",
    repo: "flowline"
  } as const

  test("names the repository, and nothing the page below it already says", () => {
    // It carried `#1934` beside the name, on the one page whose own title is that number
    // in forty-eight-pixel type. The same argument that took the Destination off Home's
    // side of the strip: a crumb earns its place by saying what nothing else does.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    const bar = screen.getByRole("banner")
    expect(bar.textContent).toContain("flowline-labs/flowline")
    expect(bar.textContent).not.toContain("#")
  })

  test("goes to the repository when its name is pressed, a name being where a name goes", () => {
    /*
     * It was a menu button, and the tab beside it was the only way to the repository's own
     * page. Every other product puts `owner/repo` in that corner as the way in, GitHub's own
     * included, so the first press most readers make went to a list of Actions and Settings.
     */
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    expect(screen.getByRole("link", { name: /flowline-labs\/flowline/ }).getAttribute("href")).toBe(
      "/flowline-labs/flowline"
    )
  })

  test("switches repository behind the chevron, which is what a name with one does", async () => {
    /*
     * The chevron listed Actions, Insights and Settings. A name with a chevron in the corner
     * of a bar switches to another one of the same thing everywhere else it appears, so the
     * one thing a reader could not do from it was the thing its shape promised.
     */
    render(<Bar where={inFlowline} tabs={THEIR_TABS} repositories={THEIRS} />)

    await userEvent.click(screen.getByRole("button", { name: "Switch repository" }))
    const menu = screen.getByRole("menu", { name: "Your repositories" })

    expect([...menu.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "flowline-labs/flowline",
      "flazouh/gitquiet",
      "octo-org/octo-repo"
    ])
    expect(menu.querySelector("a")?.getAttribute("href")).toBe("/flowline-labs/flowline")
  })

  test("opens on the one being read, whatever the list's own order was", async () => {
    /*
     * The list arrives in the store's order, which on a live account is alphabetical: the
     * switcher opened on `Aditechweb3/web3-elite-recruitment` and the repository the reader
     * was standing in was a hundred rows down, behind a field they had to type into to learn
     * anything at all.
     */
    render(
      <Bar
        where={{ kind: "repository", owner: "flazouh", repo: "gitquiet" }}
        tabs={THEIR_TABS}
        repositories={THEIRS}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Switch repository" }))
    const menu = screen.getByRole("menu", { name: "Your repositories" })

    expect([...menu.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "flazouh/gitquiet",
      "flowline-labs/flowline",
      "octo-org/octo-repo"
    ])
  })

  test("offers the pinned and the lately read before the rest of the alphabet", async () => {
    // GitHub's route answers alphabetically, so `octo-org/octo-repo` sat last of three
    // and would sit a hundred rows down on a live account. Whichever three a reader moves
    // between all day, those are the three the top of this menu is for.
    render(
      <Bar
        where={inFlowline}
        tabs={THEIR_TABS}
        repositories={THEIRS}
        pinned={["octo-org/octo-repo"]}
        lately={["flazouh/gitquiet"]}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Switch repository" }))
    const menu = screen.getByRole("menu", { name: "Your repositories" })

    expect([...menu.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "flowline-labs/flowline",
      "octo-org/octo-repo",
      "flazouh/gitquiet"
    ])
  })

  test("wears each owner's picture, six faces being told apart faster than six names", async () => {
    // The names are twenty characters of monospace that begin differently and end the same.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} repositories={THEIRS} />)

    await userEvent.click(screen.getByRole("button", { name: "Switch repository" }))
    const menu = screen.getByRole("menu", { name: "Your repositories" })

    expect(
      [...menu.querySelectorAll("a")].map((one) =>
        one.querySelector("img")?.getAttribute("src")
      )
    ).toEqual([
      "https://github.com/flowline-labs.png?size=32",
      "https://github.com/flazouh.png?size=32",
      "https://github.com/octo-org.png?size=32"
    ])
  })

  test("draws no chevron where there is nowhere to switch to", () => {
    // A reader who has not been to Home has no list kept, and a control that opens an empty
    // menu is worse than no control.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    expect(screen.queryByRole("button", { name: "Switch repository" })).toBeNull()
  })

  test("draws the name and its chevron as one chip, a reader seeing one object", () => {
    // Split in behaviour, not in appearance: the fill and the corners belong to the pair, and
    // two filled squares a pixel apart for one repository is two things where there is one.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} repositories={THEIRS} />)

    const name = screen.getByRole("link", { name: /flowline-labs\/flowline/ })
    const chevron = screen.getByRole("button", { name: "Switch repository" })
    const chip = name.parentElement

    expect(chevron.parentElement).toBe(chip)
    expect(chip?.className.split(" ")).toContain("bg-hover")
    expect(name.className.split(" ")).not.toContain("bg-hover")
    expect(chevron.className.split(" ")).not.toContain("bg-hover")
  })

  test("shows the chip has halves, one tinting under a hand without the other", () => {
    /*
     * A split control has to look split. One tint over the pair reads as a single button, so
     * nothing tells a reader which half they are about to press — and the half that goes to
     * the repository is the half nobody aims at.
     */
    render(<Bar where={inFlowline} tabs={THEIR_TABS} repositories={THEIRS} />)

    const name = screen.getByRole("link", { name: /flowline-labs\/flowline/ })
    const chevron = screen.getByRole("button", { name: "Switch repository" })

    expect(name.className).toContain("hover:bg-active")
    expect(chevron.className).toContain("hover:bg-active")
    expect(name.parentElement?.className).not.toContain("hover:")
  })

  test("draws a line between them, and gives the chevron a target a hand can hit", () => {
    // Twenty across was under the twenty-eight every other control in this strip keeps.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} repositories={THEIRS} />)

    const chevron = screen.getByRole("button", { name: "Switch repository" })

    expect(chevron.className).toContain("border-l")
    expect(chevron.className.split(" ")).toContain("size-7")
  })

  test("leaves the last control unfilled, the two words beside it being unfilled", async () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    const more = screen.getByRole("button", { name: "More in this repository" })

    expect(more.className.split(" ")).not.toContain("bg-hover")
    expect(more.className).toContain("hover:bg-hover")
  })

  test("keeps the rest of their tabs at the end of the row, behind one more control", async () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    await userEvent.click(screen.getByRole("button", { name: "More in this repository" }))

    expect(screen.getByRole("menu", { name: "This repository" })).toBeDefined()
  })

  test("draws no such control where there is nothing behind it", () => {
    // Their row is read off the page and arrives late, so the strip spends a moment with the
    // tabs an address can name and nothing spare.
    render(<Bar where={inFlowline} tabs={THEIR_TABS.slice(0, 3)} />)

    expect(screen.queryByRole("button", { name: "More in this repository" })).toBeNull()
  })

  test("wears the owner's own picture, asked for by name rather than passed in", () => {
    // It drew whatever face the screen handed down, and no screen handed one
    // down: every repository in the strip wore a grey box with one letter in it.
    // Nothing to pass means nothing to forget to pass.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    const face = screen.getByRole("img", { name: "flowline-labs" }).querySelector("img")
    expect(face?.getAttribute("src")).toBe("https://github.com/flowline-labs.png?size=36")
  })

  test("keeps the way home, which is the one thing every page of ours needs", () => {
    // The mark stood on Home only, where it is the page the reader is already on. On a
    // pull request — the page with no Rail beside it — there was nothing of ours going
    // anywhere but deeper into the repository.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/")
  })

  test("gives every tab in the strip a glyph as well as its name", () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    const tabs = screen.getByRole("navigation", { name: "Repository" })
    for (const tab of tabs.querySelectorAll("a")) {
      expect(tab.querySelector("svg"), tab.textContent ?? "").not.toBeNull()
    }
  })

  test("carries the two tabs a reader lives in, with their own counts", () => {
    /*
     * Code is not among them, and the name to the left of the row is why: both went to
     * `/flowline-labs/flowline`, so the strip drew one address twice and spent seventy pixels
     * on the second copy. Their own row keeps Code because their name is a menu.
     */
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    const tabs = screen.getByRole("navigation", { name: "Repository" })
    expect([...tabs.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "Issues183",
      "Pull requests8"
    ])
  })

  test("says the name is the page being read, the mark going where the way there is", () => {
    render(
      <Bar
        where={inFlowline}
        tabs={THEIR_TABS.map((one) => ({ ...one, here: false }))}
        atTheCode
        at="/flowline-labs/flowline"
      />
    )

    expect(screen.getByRole("link", { current: "page" }).textContent).toContain(
      "flowline-labs/flowline"
    )
  })

  test("paints that mark rather than only saying it aloud", () => {
    /*
     * `PRESSABLE` carries a fill, so writing `HERE` beside it put two background rules on one
     * element and the cascade decided between them: the resting tint won every time, and the
     * name looked identical on the repository's own page and on every other page of it.
     */
    render(<Bar where={inFlowline} tabs={THEIR_TABS} atTheCode at="/flowline-labs/flowline" />)

    const chip = screen.getByRole("link", { name: /flowline-labs\/flowline/ }).parentElement

    expect(chip?.className.split(" ")).toContain("bg-active")
    expect(chip?.className.split(" ")).not.toContain("bg-hover")
  })

  test("takes no word of theirs for it, their row saying Code on a page of issues", () => {
    // A repository with Issues switched off still answers `/owner/repo/issues`, and GitHub
    // marks Code as current there. See `readingTheCode`.
    render(
      <Bar
        where={inFlowline}
        tabs={THEIR_TABS.map((one) => ({ ...one, here: one.name === "Code" }))}
      />
    )

    expect(screen.queryByRole("link", { current: "page" })).toBeNull()
  })

  test("marks the tab GitHub says is current, on the page that tab goes to", () => {
    // Their mark alone said the page, and their mark is on Pull requests for one pull request
    // as well as for the list. The address is the half of it about this page: see the section
    // below, where the two are told apart.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} at="/flowline-labs/flowline/pulls" />)

    expect(screen.getByRole("link", { current: "page" }).textContent).toContain("Pull requests")
  })

  test("keeps their addresses rather than guessing them", async () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)
    await userEvent.click(screen.getByRole("button", { name: "More in this repository" }))

    // Insights is at `/network/dependencies`, which is exactly why the tabs are read off
    // their row instead of built from a list of names.
    expect(screen.getByRole("menuitem", { name: "Insights" }).getAttribute("href")).toBe(
      "/flowline-labs/flowline/network/dependencies"
    )
  })

  test("puts the six a reader visits monthly behind the repository's name", async () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)

    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "More in this repository" }))
    const menu = screen.getByRole("menu", { name: "This repository" })
    expect([...menu.querySelectorAll("a")].map((one) => one.textContent)).toEqual([
      "Discussions",
      "Actions",
      "Projects",
      "Security and quality",
      "Insights",
      "Settings"
    ])
  })

  test("gives every row in that menu a glyph, the six being read at a glance", async () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} />)
    await userEvent.click(screen.getByRole("button", { name: "More in this repository" }))

    const menu = screen.getByRole("menu", { name: "This repository" })
    for (const row of menu.querySelectorAll("a")) {
      expect(row.querySelector("svg"), row.textContent ?? "").not.toBeNull()
    }
  })

  test("draws the tab being read even when it is not one of the three", () => {
    render(
      <Bar
        where={inFlowline}
        tabs={THEIR_TABS.map((one) => ({ ...one, here: one.name === "Actions" }))}
      />
    )

    const tabs = screen.getByRole("navigation", { name: "Repository" })
    expect([...tabs.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "Issues183",
      "Pull requests8",
      "Actions"
    ])
  })

  test("draws no tabs at all where GitHub's row was never read", () => {
    render(<Bar where={inFlowline} />)

    expect(screen.queryByRole("navigation", { name: "Repository" })).toBeNull()
  })
})

/**
 * Standing on a page and standing in the section around it, which used to be one state.
 *
 * A reader on `/flowline-labs/flowline/pull/542` saw the Pull requests tab filled the way the
 * strip fills the tab you are on, and asked why the list looked selected while they were
 * reading one pull request. Their row marks the section, which is worth keeping and is not
 * worth saying twice.
 */
describe("the tab whose section holds the page", () => {
  const inFlowline = {
    kind: "repository",
    owner: "flowline-labs",
    repo: "flowline"
  } as const

  const ON_ONE = "/flowline-labs/flowline/pull/542"
  const ON_THE_LIST = "/flowline-labs/flowline/pulls"

  test("does not tell a reader they are already where the link would take them", () => {
    // `aria-current="page"` on a link to `/pulls` while the reader is on `/pull/542` is a
    // claim about a page nobody is on.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} at={ON_ONE} />)

    expect(screen.queryByRole("link", { current: "page" })).toBeNull()
  })

  test("says the reader is inside it, which is the other thing ARIA has a word for", () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} at={ON_ONE} />)

    expect(screen.getByRole("link", { current: "location" }).textContent).toContain(
      "Pull requests"
    )
  })

  test("wears neither the fill of the page nor the tint of a pointer", () => {
    // The two marks it must not be confused with: `bg-active` is where the reader is, and
    // `bg-hover` is what anything in this row takes under a hand.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} at={ON_ONE} />)

    const tab = screen.getByRole("link", { current: "location" })

    expect(tab.className.split(" ")).not.toContain("bg-active")
    expect(tab.className.split(" ")).not.toContain("bg-hover")
    expect(tab.className.split(" ")).toContain("text-ink")
  })

  test("is still darker than the sections the reader is not in", () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} at={ON_ONE} />)

    const tabs = screen.getByRole("navigation", { name: "Repository" })
    const issues = [...tabs.querySelectorAll("a")].find((one) =>
      one.textContent?.includes("Issues")
    )

    expect(issues?.className.split(" ")).toContain("text-ink-muted")
    expect(screen.getByRole("link", { current: "location" }).className.split(" ")).not.toContain(
      "text-ink-muted"
    )
  })

  test("keeps the list itself the page, so the two do not read alike", () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} at={ON_THE_LIST} />)

    const tab = screen.getByRole("link", { current: "page" })

    expect(tab.textContent).toContain("Pull requests")
    expect(tab.className.split(" ")).toContain("bg-active")
  })

  test("takes the address for the page, a row read on the last visit marking the last page", () => {
    /*
     * A kept row is read on one page and drawn on the next — see `keptTabs` — so what it
     * marks is where the reader was, not where they are. The address is the only thing here
     * that is about this page. Their href carries a query on some of their tabs and a reader
     * can type a trailing slash, so one page in two spellings is one page.
     */
    render(
      <Bar
        where={inFlowline}
        tabs={[
          {
            name: "Pull requests",
            href: "/flowline-labs/flowline/pulls?q=is%3Aopen",
            here: false
          }
        ]}
        at="/flowline-labs/flowline/pulls/"
      />
    )

    expect(screen.getByRole("link", { current: "page" }).textContent).toContain("Pull requests")
  })

  test("keeps a section the address alone would not name, their row being the one that knows", () => {
    // Their Actions tab is marked on `/actions/runs/1234`, which no list of names would
    // guess, and the tab stays in the strip because that is the section being read.
    render(
      <Bar
        where={inFlowline}
        tabs={THEIR_TABS.map((one) => ({ ...one, here: one.name === "Actions" }))}
        at="/flowline-labs/flowline/actions/runs/1234"
      />
    )

    expect(screen.getByRole("link", { current: "location" }).textContent).toContain("Actions")
  })
})

describe("the repository's name, which is where the Code tab's mark goes", () => {
  const inFlowline = {
    kind: "repository",
    owner: "flowline-labs",
    repo: "flowline"
  } as const

  const ROOT = "/flowline-labs/flowline"

  test("is the page on the repository's own page", () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} atTheCode at={ROOT} />)

    expect(screen.getByRole("link", { current: "page" }).textContent).toContain(
      "flowline-labs/flowline"
    )
  })

  test("says the code is around the reader on a file, not that they are on it", () => {
    // `readingTheCode` is true for the root and for `/tree/` and `/blob/` alike, so reading
    // one file filled the name the way standing on the repository's own page fills it.
    render(<Bar where={inFlowline} tabs={THEIR_TABS} atTheCode at={`${ROOT}/blob/main/README.md`} />)

    const name = screen.getByRole("link", { name: /flowline-labs\/flowline/ })

    expect(name.getAttribute("aria-current")).toBe("location")
    expect(name.parentElement?.className.split(" ")).not.toContain("bg-active")
  })

  test("still says the name is a way somewhere, the chip keeping its resting tint", () => {
    render(<Bar where={inFlowline} tabs={THEIR_TABS} atTheCode at={`${ROOT}/tree/main/src`} />)

    const chip = screen.getByRole("link", { name: /flowline-labs\/flowline/ }).parentElement

    expect(chip?.className.split(" ")).toContain("bg-hover")
  })
})

describe("what the bar keeps of GitHub's", () => {
  test("the inbox, saying whether rather than how many, because whether is all they know", () => {
    // `/notifications/indicator` answers `{"mode":"global"}`, so a count here would be
    // a figure this extension invented. The tray is drawn in its unread state instead.
    render(<Bar where={{ kind: "home" }} unread />)

    const inbox = screen.getByRole("link", { name: "Notifications, something is waiting" })
    expect(inbox.getAttribute("href")).toBe("/notifications")
    expect(inbox.textContent).not.toMatch(/\d/)
  })

  test("the inbox says nothing is waiting when nothing is", () => {
    render(<Bar where={{ kind: "home" }} />)

    expect(screen.getByRole("link", { name: "Notifications" })).toBeDefined()
  })

  test("the way back to GitHub, in the corner rather than on the screen below", async () => {
    // It was a control on the pull request card, which is one of the four
    // screens this extension draws: on the other three the way out was a row
    // inside the account menu, and a reader looking for it had to know which
    // this page was. The bar is on all four.
    let handedBack = 0
    render(<Bar where={{ kind: "home" }} onStepAside={() => (handedBack += 1)} />)

    await userEvent.click(screen.getByRole("button", { name: "Show GitHub's own page" }))

    expect(handedBack).toBe(1)
  })

  test("stands last in the row, at the corner of the page", async () => {
    // The far corner is where a reader looks for the control that leaves, and it
    // is the one place in this row that a login running long cannot push along.
    render(
      <Bar
        where={{ kind: "home" }}
        participant={someone}
        onStepAside={() => undefined}
      />
    )

    const controls = screen.getByRole("banner").querySelectorAll("a, button")
    const last = controls[controls.length - 1]
    expect(last?.getAttribute("aria-label")).toBe("Show GitHub's own page")
  })

  test("offers no way out where nothing is holding a page to go back to", () => {
    // A window that is not GitHub's page has nothing to hand anything back to,
    // and a button that presses into nothing is the mistake this bar undoes.
    render(<Bar where={{ kind: "home" }} />)

    expect(screen.queryByRole("button", { name: "Show GitHub's own page" })).toBeNull()
  })

  test("the Participant, with the same three rows the Rail offers", async () => {
    // The way back to GitHub was a fourth row here, a hundred pixels from the
    // button in this same bar that does it. Two ways to one place, one of them
    // behind a menu.
    render(
      <Bar
        where={{ kind: "home" }}
        participant={someone}
        onStepAside={() => undefined}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: /flazouh/ }))
    expect(screen.getAllByRole("menuitem").map((one) => one.textContent)).toEqual([
      "Your profile",
      "Settings",
      "Sign out"
    ])
  })
})

describe("the search", () => {
  test("is offered where something can answer it", () => {
    render(
      <Bar
        where={{ kind: "home" }}
        onSearch={() => undefined}
      />
    )

    expect(screen.getByRole("button", { name: /search/i })).toBeDefined()
  })

  test("is not drawn at all where nothing can, rather than pressing into nothing", () => {
    render(<Bar where={{ kind: "home" }} />)

    expect(screen.queryByRole("button", { name: /search/i })).toBeNull()
  })

  test("hands the press to whoever owns the palette", async () => {
    let asked = 0
    render(
      <Bar
        where={{ kind: "home" }}
        onSearch={() => {
          asked += 1
        }}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: /search/i }))
    expect(asked).toBe(1)
  })
})

/*
 * Where it goes is the whole of this. The strip reads outward to inward — the page
 * behind, Home, the repository, the section — and the far corner is for leaving this
 * interface for GitHub's page, which is a different move.
 */
describe("the way back", () => {
  const REPOSITORY = { kind: "repository", owner: "flowline-labs", repo: "flowline" } as const

  test("stands at the head of the strip, before the mark for Home", () => {
    render(<Bar where={REPOSITORY} onBack={() => undefined} />)

    const bar = screen.getByRole("banner")
    const back = screen.getByRole("button", { name: "Back" })
    const home = screen.getByLabelText("Home")

    expect(bar.firstElementChild).toBe(back)
    expect(back.compareDocumentPosition(home) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
  })

  test("is not the way out, which keeps the other corner", () => {
    render(<Bar where={REPOSITORY} onBack={() => undefined} onStepAside={() => undefined} />)

    const back = screen.getByRole("button", { name: "Back" })
    const out = screen.getByRole("button", { name: "Show GitHub's own page" })

    expect(back).not.toBe(out)
    expect(back.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING).toBeGreaterThan(0)
  })

  test("names where it goes, where anything knows the name", () => {
    render(<Bar where={REPOSITORY} onBack={() => undefined} backTo="the Working Set" />)

    const back = screen.getByRole("button", { name: "Back to the Working Set" })
    expect(back.getAttribute("title")).toBe("Back to the Working Set")
  })

  /*
   * A tab opened straight onto this address has nothing behind it, and a control
   * that presses into nothing is the fault this bar exists to undo.
   */
  test("is not drawn at all where there is nothing behind the page", () => {
    render(<Bar where={REPOSITORY} />)

    expect(screen.queryByRole("button", { name: /^back/i })).toBeNull()
  })

  test("hands the press to whoever knows how to go back", async () => {
    let asked = 0
    render(
      <Bar
        where={REPOSITORY}
        onBack={() => {
          asked += 1
        }}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Back" }))
    expect(asked).toBe(1)
  })
})
