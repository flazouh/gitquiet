import { keepTabs, keptTabs } from "../github/repoTabs"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Effect, Option } from "effect"
import { BAR_ID, theBarStands } from "./barSlot"
import { keepRepositories, keptRepositories } from "./keptRepositories"
import { interfaceContainer, ROOT_ID, takeOverSlot, theScreenMoved } from "./mount"
import { REPO_PULLS, RUN } from "./place"
import { TheBar } from "./TheBar"
import { visited, visiting } from "./visited"
import type { Repository } from "../domain/repositories"

afterEach(cleanup)

/*
 * An empty store around every test, because this bar keeps each list it is handed.
 * One test's props were the next one's kept list, so the test asking what a reader
 * with nothing to switch to sees was reading the reader before it.
 */
beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

const repository = (nameWithOwner: string): Repository => {
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

const KEPT = [repository("flazouh/gitquiet")]

const SOMEONE = { login: "flazouh", faceUrl: Option.none() }

const WHERE = { kind: "repository" as const, owner: "flazouh", repo: "gitquiet" }

/**
 * A tab that has been somewhere, as the browser describes one.
 *
 * The Navigation API, which is what `theTrail` reads: verified from inside a content
 * script, and absent from the runtime the tests run in — so it is put on the window
 * here and taken off again by the hook below, rather than the naming being tested
 * through a seam of its own.
 */
const havingBeen = (addresses: ReadonlyArray<string>, current = addresses.length - 1): void => {
  ;(window as { navigation?: unknown }).navigation = {
    entries: () =>
      addresses.map((at, index) => ({
        url: `https://github.com${at}`,
        key: `k${index}`,
        index
      })),
    currentEntry: { index: current },
    canGoBack: current > 0,
    canGoForward: current < addresses.length - 1,
    traverseTo: () => undefined,
    addEventListener: () => {},
    removeEventListener: () => {}
  }
}

// Taken off after every test rather than inside each one, so a test that fails
// mid-way does not leave a trail on the window for the next file in the run.
afterEach(() => {
  delete (window as { navigation?: unknown }).navigation
})

/*
 * The browser lists the addresses a tab has been through and never their titles, so
 * the menu says what an address can honestly say. These are the kinds a reader walks
 * between; GitHub's own pages fall through to the path.
 */
describe("the places the trail names", () => {
  test("names each kind a reader walks between, nearest first", async () => {
    havingBeen([
      "/pulls",
      "/flazouh/gitquiet",
      "/flazouh/gitquiet/issues",
      "/flazouh/gitquiet/pull/12",
      "/flazouh/gitquiet/pull/14"
    ])

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)
    await userEvent.click(screen.getByRole("button", { name: "Where you have been" }))

    expect(screen.getAllByRole("menuitem").map((one) => one.textContent)).toEqual([
      "#12 in flazouh/gitquiet",
      "flazouh/gitquiet: issues",
      "flazouh/gitquiet",
      "Working Set"
    ])
  })

  /*
   * One page, two addresses: the same pull request with a query of its own. The
   * name is what a reader reads, so a row they cannot tell from the one above it
   * is not worth a line.
   */
  test("says one name once, keeping the nearest place that wears it", async () => {
    havingBeen([
      "/flazouh/gitquiet/pull/12?diff=split",
      "/pulls",
      "/flazouh/gitquiet/pull/12",
      "/flazouh/gitquiet/pull/14"
    ])

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)
    await userEvent.click(screen.getByRole("button", { name: "Where you have been" }))

    expect(screen.getAllByRole("menuitem").map((one) => one.textContent)).toEqual([
      "#12 in flazouh/gitquiet",
      "Working Set"
    ])
  })

  test("keeps the path itself for a page of theirs nothing here can name", async () => {
    havingBeen(["/flazouh/gitquiet/blob/main/README.md", "/pulls", "/flazouh/gitquiet/pull/14"])

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)
    await userEvent.click(screen.getByRole("button", { name: "Where you have been" }))

    expect(screen.getAllByRole("menuitem").map((one) => one.textContent)).toEqual([
      "Working Set",
      "/flazouh/gitquiet/blob/main/README.md"
    ])
  })
})

describe("the bar and where the reader has been", () => {
  test("prepares the exact route behind and ahead before a return press", async () => {
    havingBeen(
      [
        "/flazouh/gitquiet/pull/12",
        "/flazouh/gitquiet/pull/14",
        "/flazouh/gitquiet/pull/16"
      ],
      1
    )
    const prepared: Array<string> = []

    render(
      <TheBar
        where={WHERE}
        participant={SOMEONE}
        repositories={KEPT}
        onPrepareRoute={(path) => prepared.push(path)}
      />
    )

    await userEvent.hover(screen.getByRole("button", { name: "Back" }))
    await userEvent.hover(screen.getByRole("button", { name: "Forward" }))

    expect(prepared).toEqual([
      "/flazouh/gitquiet/pull/12",
      "/flazouh/gitquiet/pull/16"
    ])
  })

  test("records the repository being read, so the next switcher opens on it", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    await waitFor(() => expect(visited()).toEqual(["flazouh/gitquiet"]))
  })

  test("records nothing off a repository, Home being nowhere in particular", async () => {
    render(<TheBar where={{ kind: "home" }} participant={SOMEONE} repositories={KEPT} />)

    await waitFor(() => expect(screen.getByRole("banner")).toBeDefined())
    expect(visited()).toEqual([])
  })

  test("hands the switcher the pins and the visits it was kept for", async () => {
    visiting("octo-org/octo-repo")
    render(
      <TheBar
        where={WHERE}
        participant={SOMEONE}
        repositories={[...KEPT, repository("octo-org/octo-repo"), repository("acme/alpha")]}
      />
    )

    await userEvent.click(screen.getByRole("button", { name: "Switch repository" }))
    const menu = screen.getByRole("menu", { name: "Your repositories" })

    expect([...menu.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "flazouh/gitquiet",
      "octo-org/octo-repo",
      "acme/alpha"
    ])
  })
})

describe("the bar's palette", () => {
  test("opens on ⌘K from anywhere on the page, not only from the bar", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    expect(screen.queryByRole("dialog")).toBeNull()
    await userEvent.keyboard("{Meta>}k{/Meta}")

    expect(screen.getByRole("dialog")).toBeDefined()
  })

  test("shuts again on the same key, which is how every palette behaves", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    await userEvent.keyboard("{Meta>}k{/Meta}")
    await userEvent.keyboard("{Meta>}k{/Meta}")

    expect(screen.queryByRole("dialog")).toBeNull()
  })

  test("offers no search at all where there is nothing to search", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} />)

    await userEvent.keyboard("{Meta>}k{/Meta}")

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(screen.queryByRole("button", { name: /Search anything you have/ })).toBeNull()
  })

  test("searches the repositories the last visit left behind, on a page that never read them", async () => {
    render(
      <TheBar
        where={WHERE}
        participant={SOMEONE}
        recall={() => Effect.succeed(Option.some(KEPT))}
      />
    )

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Search anything you have/ })).toBeDefined()
    )
    await userEvent.keyboard("{Meta>}k{/Meta}")

    expect(screen.getByRole("option").textContent).toContain("flazouh/gitquiet")
  })

  test("stays quiet when the store has nothing kept", async () => {
    render(
      <TheBar where={WHERE} participant={SOMEONE} recall={() => Effect.succeed(Option.none())} />
    )

    await userEvent.keyboard("{Meta>}k{/Meta}")

    expect(screen.queryByRole("dialog")).toBeNull()
  })
})

describe("the reader's own settings", () => {
  /*
   * They were a small button at the right end of the files band, which put them
   * on the one screen that has a files band and nowhere else. The bar is on
   * every page this extension draws, so that is where a setting lives.
   */
  test("stand in the tray, on every page the bar is on", () => {
    render(<TheBar where={{ kind: "home" }} participant={SOMEONE} />)

    expect(screen.getByLabelText("Display settings")).toBeDefined()
  })

  test("open the sheet where the reader presses them", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} />)

    await userEvent.click(screen.getByLabelText("Display settings"))

    expect(screen.getByRole("dialog", { name: "Settings" })).toBeDefined()
  })

  /*
   * The pane the button stands in carries `backdrop-filter` — see `glass.css` — and a filtered
   * element is the containing block for everything positioned inside it, the top layer included.
   * Chrome paints the `::backdrop` of a modal in there and loses the sheet itself, so the reader
   * gets a dimmed page and nothing to read on it. The sheet hangs where the toaster and the
   * hover cards hang instead: outside the bar, and outside our root.
   */
  test("hang outside the glass, because a filtered pane cannot hold a modal", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} />)

    await userEvent.click(screen.getByLabelText("Display settings"))

    const pane = document.querySelector(`#${BAR_ID} > header`)
    expect(pane).not.toBeNull()
    expect(pane?.contains(screen.getByRole("dialog", { name: "Settings" }))).toBe(false)
  })
})

/*
 * Two bars on one page, which is the fault this describes and the one readers reported most.
 *
 * The slot is made once per document — see `barSlot.ts` — and every screen's tree portals its
 * bar into it. A screen starts on the promise of a press, a whole second before the address
 * moves, so for that second two trees are alive: the one the reader is looking at and the one
 * arriving. Both drew a bar, and if the arriving one never got the page — a press abandoned, a
 * takeover that failed, their router quicker than ours — the second bar stayed for good.
 */
describe("two screens of ours, and the one bar between them", () => {
  const clear = () => {
    for (const root of document.querySelectorAll(`#${ROOT_ID}`)) root.remove()
    document.querySelector("run-summary")?.remove()
  }

  afterEach(clear)

  /** A screen already on the page, of a different kind: the list the reader is reading. */
  const readingAlready = (): Element => {
    const standing = interfaceContainer(document, REPO_PULLS)
    document.body.append(standing)
    return standing
  }

  test("waits while another screen of ours is the one on the page", async () => {
    readingAlready()
    // The press: this screen's script starts and builds its tree before it has anywhere to put it.
    const mine = interfaceContainer(document, RUN)
    expect(mine.isConnected).toBe(false)

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    await waitFor(() => expect(document.getElementById(BAR_ID)).not.toBeNull())
    expect(document.querySelectorAll(`#${BAR_ID} > header`).length).toBe(0)
  })

  test("draws the moment the screen it belongs to has the page", async () => {
    readingAlready()
    const mine = interfaceContainer(document, RUN)
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    // GitHub renders the run, and the takeover settles into the frame inside it.
    const theirs = document.createElement("run-summary")
    theirs.innerHTML = '<turbo-frame id="repo-content-turbo-frame"></turbo-frame>'
    document.body.append(theirs)
    act(() => {
      expect(takeOverSlot(document, mine, RUN)).not.toBeNull()
    })

    await waitFor(() => expect(document.querySelectorAll(`#${BAR_ID} > header`).length).toBe(1))
  })

  test("draws on an ordinary arrival, where nothing of ours is on the page yet", async () => {
    // A document load: the tree renders while GitHub's HTML is still arriving, and the bar is
    // the first thing on the screen. Holding it back until the takeover would leave the page
    // with no bar at all, theirs being hidden by the slot's own presence.
    interfaceContainer(document, RUN)

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    await waitFor(() => expect(document.querySelectorAll(`#${BAR_ID} > header`).length).toBe(1))
  })

  test("stays up until the screen that took the page has drawn its own", async () => {
    /*
     * Measured on bun's Actions list: the arriving screen needs eighty milliseconds to
     * render its bar, and this one used to come off the instant it lost the page. The
     * slot was empty for the whole of that, so the page moved up by the height of a bar
     * and back down again while the reader was still pressing.
     */
    const mine = readingAlready()
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)
    await waitFor(() => expect(document.querySelectorAll(`#${BAR_ID} > header`).length).toBe(1))

    // The screen arriving, as its own script does it: this one's container off the page,
    // its own in place of it. Nothing of that runs in this bundle, which is the point.
    const arriving = document.createElement("div")
    arriving.id = ROOT_ID
    mine.replaceWith(arriving)
    act(() => theScreenMoved(document))

    await new Promise((ready) => setTimeout(ready, 30))
    expect(document.querySelectorAll(`#${BAR_ID} > header`).length).toBe(1)

    // And down, once the screen that took the page says its own bar is up. On that rather
    // than on the wait running out: the cap behind it is four hundred milliseconds, and a
    // handover that took four hundred milliseconds to tidy up would pass this test while
    // leaving two bars stacked for most of a second.
    const appended = Date.now()
    act(() => theBarStands(document))

    await waitFor(() =>
      expect(document.querySelectorAll(`#${BAR_ID} > header:has(nav)`).length).toBe(0)
    )
    expect(Date.now() - appended).toBeLessThan(200)
  })
})

describe("a number, on a page inside a repository", () => {
  test("offers that pull request in the repository being read", async () => {
    render(
      <TheBar
        where={{ kind: "repository", owner: "flazouh", repo: "gitquiet" }}
        participant={SOMEONE}
        repositories={KEPT}
      />
    )

    await userEvent.keyboard("{Meta>}k{/Meta}")
    await userEvent.type(screen.getByRole("combobox"), "1938")

    expect(screen.getByRole("option").textContent).toContain("#1938")
  })

  test("offers nothing of the kind on Home, which is inside nothing", async () => {
    render(<TheBar where={{ kind: "home" }} participant={SOMEONE} repositories={KEPT} />)

    await userEvent.keyboard("{Meta>}k{/Meta}")
    await userEvent.type(screen.getByRole("combobox"), "1938")

    expect(screen.queryAllByRole("option")).toEqual([])
  })
})

describe("the switcher on a strip that has only just been built", () => {
  const chevron = () => screen.queryByRole("button", { name: "Switch repository" })

  /* Held outside the render, as every screen holds theirs: a module-level thunk. */
  const neverAnswers = () => Effect.never
  const answers = () => Effect.succeed(Option.some(KEPT))
  const answersNothing = () => Effect.succeed(Option.none<ReadonlyArray<Repository>>())

  /*
   * Every screen this extension draws is its own bundle, so a press on a row builds
   * a new bar, and the list behind the name arrives from the store one read later.
   * The chevron is drawn only where there is a list, so it went for as long as that
   * read took: a control disappearing and coming back under the pointer, measured at
   * about a tenth of a second on a press from a list to a card.
   */
  test("draws the chevron on the first render, off the list the last read kept", () => {
    keepRepositories([repository("flazouh/gitquiet"), repository("acme/alpha")])

    // A read that never answers, so the only list on the screen is the kept one.
    render(<TheBar where={WHERE} participant={SOMEONE} recall={neverAnswers} />)

    expect(chevron()).not.toBeNull()
  })

  test("keeps what a read answers, which is what the next strip built draws", async () => {
    render(
      <TheBar
        where={WHERE}
        participant={SOMEONE}
        recall={answers}
      />
    )

    await waitFor(() =>
      expect(keptRepositories().map((one) => one.nameWithOwner)).toEqual(["flazouh/gitquiet"])
    )
  })

  /*
   * Home and the Working Set read the whole list off GitHub and hand it straight in,
   * which makes it the freshest one this bar ever sees. Kept for the same reason the
   * read above is: the card the reader presses next builds its own bar.
   */
  test("keeps a list handed straight in, which is the freshest one there is", async () => {
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    await waitFor(() =>
      expect(keptRepositories().map((one) => one.nameWithOwner)).toEqual(["flazouh/gitquiet"])
    )
  })

  /*
   * The store answers with nothing whenever its own copy of the list has gone cold,
   * and a bar cannot tell that from a reader who has no repositories. Kept either
   * way, one such read threw the list away and the switcher never came back.
   */
  test("holds on to the kept list when a read answers with nothing", async () => {
    keepRepositories(KEPT)

    render(<TheBar where={WHERE} participant={SOMEONE} recall={answersNothing} />)

    await waitFor(() => expect(chevron()).not.toBeNull())
    expect(keptRepositories().map((one) => one.nameWithOwner)).toEqual(["flazouh/gitquiet"])
  })

  test("draws no chevron where nothing is kept and nothing has answered yet", () => {
    // A reader on their first visit, who has nowhere to switch to. A control that opens
    // an empty menu is worse than no control, which is the rule this keeps.
    render(<TheBar where={WHERE} participant={SOMEONE} recall={neverAnswers} />)

    expect(chevron()).toBeNull()
  })
})

describe("the strip before their nav lands", () => {
  test("still offers the pull requests, which an address alone can name", () => {
    /*
     * Their row is inside the header their own React hydrates, so on a load and on every soft
     * navigation there is a moment with no row to read. The strip drew nothing at all for it:
     * a bar in a repository offering no way into that repository, and a chevron whose menu
     * said "Nothing by that name." to a reader who had typed no name.
     */
    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    const tabs = screen.getByRole("navigation", { name: "Repository" })

    expect([...tabs.querySelectorAll("a")].map((one) => one.textContent?.trim())).toEqual([
      "Pull requests"
    ])
  })

  test("stands aside the moment their own row can be read", () => {
    // Theirs carries the counts, the tabs this repository actually has, and Insights at an
    // address no list of names would guess. See `theirNav.ts`.
    //
    // Taken out again in the same test rather than in a hook: `screen` reads one document for
    // the whole run, and a second nav left in the body is a second nav every later file finds.
    const theirs = document.createElement("nav")
    theirs.setAttribute("aria-label", "Repository")
    theirs.innerHTML = `<ul>
         <li><a href="/flazouh/gitquiet">Code</a></li>
         <li><a href="/flazouh/gitquiet/issues">Issues</a></li>
         <li><a href="/flazouh/gitquiet/pulls">Pull requests</a></li>
       </ul>`
    document.body.append(theirs)

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    const ours = screen
      .getAllByRole("navigation", { name: "Repository" })
      .find((one) => one.closest(`#${BAR_ID}`) !== null)

    expect([...(ours?.querySelectorAll("a") ?? [])].map((one) => one.textContent?.trim())).toEqual([
      "Issues",
      "Pull requests"
    ])

    theirs.remove()
  })
})

describe("the strip before GitHub's own row has hydrated", () => {
  /*
   * The reader's photograph: a repository with a hundred and ninety-five issues, and a bar
   * over it offering Code and Pull requests. Their row is inside the header their React
   * hydrates, so for the first frames of every press there is nothing of theirs to read, and
   * an address can only promise the two tabs every repository has.
   *
   * So the row is read out of their document by the gateway, warmed on the pointer and kept
   * under the repository's own name. See `github/repoTabs.ts`.
   */

  const oursIn = (): HTMLElement | undefined =>
    screen
      .getAllByRole("navigation", { name: "Repository" })
      .find((one) => one.closest(`#${BAR_ID}`) !== null)

  const namesIn = (strip: HTMLElement | undefined): ReadonlyArray<string | undefined> =>
    [...(strip?.querySelectorAll("a") ?? [])].map((one) => one.textContent?.trim())

  test("draws the row this repository was read to have, counts and all", () => {
    keepTabs(
      { owner: "flazouh", repo: "gitquiet" },
      [
        { name: "Code", href: "/flazouh/gitquiet", here: true },
        { name: "Issues", href: "/flazouh/gitquiet/issues", count: 195, here: false },
        { name: "Pull requests", href: "/flazouh/gitquiet/pulls", count: 9, here: false }
      ]
    )

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    // Their count is part of the tab's own text, which is the other half of what an address
    // cannot say: "Issues195" rather than "Issues".
    expect(namesIn(oursIn())).toEqual(["Issues195", "Pull requests9"])
  })

  /*
   * The reason a kept row was refused here for a long time, and the reason keeping it by
   * name is safe. One row for all of GitHub is `bun`'s tabs above `hello-world` for as long as the
   * hydration takes, which is a reader pressing Issues and landing in another repository.
   */
  test("draws no other repository's row, whatever is in the store", () => {
    keepTabs(
      { owner: "oven-sh", repo: "bun" },
      [
        { name: "Code", href: "/oven-sh/bun", here: true },
        { name: "Discussions", href: "/oven-sh/bun/discussions", here: false }
      ]
    )

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    expect(namesIn(oursIn())).not.toContain("Discussions")
  })

  test("keeps the row it reads off theirs, for the next press into this repository", () => {
    const theirs = document.createElement("nav")
    theirs.setAttribute("aria-label", "Repository")
    theirs.innerHTML = `<ul>
         <li><a href="/flazouh/gitquiet">Code</a></li>
         <li><a href="/flazouh/gitquiet/issues">Issues</a></li>
         <li><a href="/flazouh/gitquiet/actions">Actions</a></li>
         <li><a href="/flazouh/gitquiet/pulls">Pull requests</a></li>
       </ul>`
    document.body.append(theirs)

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    expect(keptTabs({ owner: "flazouh", repo: "gitquiet" }).map((one) => one.name)).toEqual([
      "Code",
      "Issues",
      "Actions",
      "Pull requests"
    ])

    theirs.remove()
  })
})

describe("the strip after the reader switches repository", () => {
  /** Their row, as it stands in the document for the repository named in it. */
  const theirRow = (root: string): HTMLElement => {
    const nav = document.createElement("nav")
    nav.setAttribute("aria-label", "Repository")
    nav.innerHTML = `<ul>
         <li><a href="${root}">Code</a></li>
         <li><a href="${root}/issues">Issues</a></li>
         <li><a href="${root}/pulls">Pull requests</a></li>
       </ul>`
    document.body.append(nav)
    return nav
  }

  const oursIn = (): HTMLElement | undefined =>
    screen
      .getAllByRole("navigation", { name: "Repository" })
      .find((one) => one.closest(`#${BAR_ID}`) !== null)

  const pullsIn = (strip: HTMLElement | undefined): string | null | undefined =>
    [...(strip?.querySelectorAll("a") ?? [])]
      .find((one) => one.textContent?.trim() === "Pull requests")
      ?.getAttribute("href")

  test("offers this repository's pull requests, not the ones of the repository just left", () => {
    /*
     * GitHub changes the address before it replaces its own nav row, so a read
     * taken on the change finds the row of the repository just left. The strip
     * took any row it could read and stopped watching, which drew `oven-sh/bun`
     * addresses under the name `octo-org/hello-world` — a reader pressing
     * Pull requests on the new repository landed back on the old one.
     */
    const stale = theirRow("/oven-sh/bun")

    render(
      <TheBar
        where={{ kind: "repository", owner: "octo-org", repo: "hello-world" }}
        participant={SOMEONE}
        repositories={KEPT}
      />
    )

    expect(pullsIn(oursIn())).toBe("/octo-org/hello-world/pulls")

    stale.remove()
  })

  test("takes their row the moment the one for this repository lands", async () => {
    // And keeps watching until then, rather than settling for the stale row and
    // disconnecting, which is what left the addresses behind.
    const stale = theirRow("/oven-sh/bun")

    render(
      <TheBar
        where={{ kind: "repository", owner: "octo-org", repo: "hello-world" }}
        participant={SOMEONE}
        repositories={KEPT}
      />
    )

    stale.remove()
    const landed = theirRow("/octo-org/hello-world")

    await waitFor(() =>
      expect(
        [...(oursIn()?.querySelectorAll("a") ?? [])].map((one) => one.textContent?.trim())
      ).toEqual(["Issues", "Pull requests"])
    )
    expect(pullsIn(oursIn())).toBe("/octo-org/hello-world/pulls")

    landed.remove()
  })
})

describe("whose account the bar says it is", () => {
  /*
   * By the name on it, because the way into the account menu is the chip itself and a
   * shut menu is not in the document — see `Menu`, which draws nothing until it is up.
   */
  const chipFor = (login: string) => screen.queryByRole("button", { name: new RegExp(login) })

  /**
   * Their own markup, which carries the login on every page signed in or out.
   *
   * See `viewer.ts`: this is what `participantOnPage` reads, and it is the whole reason
   * a bar can name the reader without a request.
   */
  const theirLogin = (login: string) => {
    const said = document.createElement("meta")
    said.setAttribute("name", "user-login")
    said.setAttribute("content", login)
    document.head.append(said)
    return said
  }

  test("reads it off their page where the screen handed none in", async () => {
    // Thirteen of the fourteen screens hand none in, which is why this is read here
    // rather than passed: only `/pulls` ever called `participantOnPage`, so every
    // other screen drew a bar with the account missing from the tray.
    const said = theirLogin("flazouh")

    render(<TheBar where={WHERE} repositories={KEPT} />)

    await waitFor(() => expect(chipFor("flazouh")).not.toBeNull())

    said.remove()
  })

  test("says nobody where their page names nobody, rather than an empty chip", () => {
    render(<TheBar where={WHERE} repositories={KEPT} />)

    expect(chipFor("flazouh")).toBeNull()
  })

  test("lets a screen that knows better win, since one reads it from its own load", () => {
    // `WorkingSetScreen` hands in whoever its own read named. A page fact read here
    // must not overrule a screen that was told.
    const said = theirLogin("someone-else")

    render(<TheBar where={WHERE} participant={SOMEONE} repositories={KEPT} />)

    expect(chipFor("flazouh")).not.toBeNull()
    expect(chipFor("someone-else")).toBeNull()

    said.remove()
  })
})
