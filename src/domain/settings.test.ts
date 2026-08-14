import { describe, expect, it } from "bun:test"
import {
  DEFAULTS,
  DIFF_KNOBS,
  PAGE_KNOBS,
  THEME_KNOBS,
  readSettings,
  TREE_KNOBS
} from "./Settings"

const ALL_KNOBS = [...PAGE_KNOBS, ...THEME_KNOBS, ...DIFF_KNOBS, ...TREE_KNOBS]

describe("the settings schema", () => {
  it("gives every knob a default that is one of its own choices", () => {
    for (const knob of ALL_KNOBS) {
      const offered = knob.choices.map((choice) => choice.value)
      expect(offered).toContain(knob.fallback)
    }
  })

  it("names every knob once", () => {
    const keys = ALL_KNOBS.map((one) => one.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("gives every knob a short line as well as the long one", () => {
    // The rows in the dialog are scanned rather than read, and the panel beside
    // them carries the whole trade. A gist that runs to the length of the note
    // is a second note, and puts the list past the height of the dialog.
    for (const knob of ALL_KNOBS) {
      expect([knob.key, knob.gist.length > 0, knob.gist.length <= 50]).toEqual([
        knob.key,
        true,
        true
      ])
      expect([knob.key, knob.gist.length < knob.note.length]).toEqual([knob.key, true])
      expect([knob.key, knob.gist.endsWith(".")]).toEqual([knob.key, false])
    }
  })

  it("explains every knob, at more length than its label", () => {
    for (const knob of ALL_KNOBS) {
      expect(knob.note.length).toBeGreaterThan(80)
      expect(knob.note.trim().endsWith(".")).toBe(true)
    }
  })

  it("names every choice somewhere in the knob's explanation", () => {
    // Not a spelling check: a note that never mentions what the options are is
    // a note that describes the setting instead of helping anyone choose.
    for (const knob of [...THEME_KNOBS, ...DIFF_KNOBS, ...TREE_KNOBS]) {
      const said = knob.note.toLowerCase()
      const named = knob.choices.filter((choice) => said.includes(choice.label.toLowerCase()))
      const onOff = knob.choices.every((choice) => choice.value === "on" || choice.value === "off")
      expect(onOff ? 1 : named.length).toBeGreaterThan(0)
    }
  })

  it("keeps most of the menu out of the advanced section", () => {
    const curated = [...DIFF_KNOBS, ...TREE_KNOBS].filter((one) => !one.advanced)
    expect(curated.length).toBeGreaterThan(10)
  })
})

describe("reading what was stored", () => {
  it("falls back to the defaults when there is nothing", () => {
    expect(readSettings(undefined)).toEqual(DEFAULTS)
    expect(readSettings(null)).toEqual(DEFAULTS)
    expect(readSettings("nonsense")).toEqual(DEFAULTS)
  })

  it("keeps a stored choice that is still offered", () => {
    const read = readSettings({ diff: { layout: "split" }, tree: { density: "relaxed" } })

    expect(read.diff.layout).toBe("split")
    expect(read.tree.density).toBe("relaxed")
  })

  it("drops a value the schema no longer offers", () => {
    const read = readSettings({ diff: { layout: "three-way", textSize: 12 } })

    expect(read.diff.layout).toBe("unified")
    expect(read.diff.textSize).toBe("small")
  })

  it("fills in a knob that did not exist when the settings were written", () => {
    const read = readSettings({ diff: { layout: "split" } })
    expect(read.tree.icons).toBe("material")
  })
})

describe("choosing whose pull request page to read", () => {
  it("starts on ours, which is the reason the extension is installed", () => {
    expect(DEFAULTS.page.view).toBe("ours")
  })

  it("keeps a reader who has asked for GitHub's page on it", () => {
    expect(readSettings({ page: { view: "github" } }).page.view).toBe("github")
  })

  it("comes back to ours rather than to a page nobody offers", () => {
    expect(readSettings({ page: { view: "classic" } }).page.view).toBe("ours")
  })
})

describe("choosing how the interface looks", () => {
  it("starts on the desktop look, following the OS, in the glyphs of wherever it is drawn", () => {
    expect(DEFAULTS.theme).toEqual({ appearance: "system", pack: "match", art: "match" })
    expect(DEFAULTS.diff.syntax).toBe("match")
  })

  it("keeps a stored appearance and pack that are still offered", () => {
    const read = readSettings({
      theme: { appearance: "dark", pack: "anthropic" }
    })
    expect(read.theme).toEqual({ appearance: "dark", pack: "anthropic", art: "match" })
  })

  it("drops an appearance or pack nobody offers", () => {
    const read = readSettings({
      theme: { appearance: "dimmed", pack: "papaya" }
    })
    expect(read.theme).toEqual({ appearance: "system", pack: "match", art: "match" })
  })

  it("fills theme in when older settings never had it", () => {
    const read = readSettings({ diff: { layout: "split" } })
    expect(read.theme).toEqual({ appearance: "system", pack: "match", art: "match" })
  })

  it("keeps a set the reader asked for by name, and drops one nobody draws", () => {
    expect(readSettings({ theme: { art: "github" } }).theme.art).toBe("github")
    expect(readSettings({ theme: { art: "octicons" } }).theme.art).toBe("match")
  })

  it("offers every pack the product ships", () => {
    const pack = THEME_KNOBS.find((one) => one.key === "pack")
    expect(pack?.choices.map((choice) => choice.value)).toEqual([
      "match",
      "gitquiet",
      "anthropic",
      "cursor",
      "github",
      "catppuccin",
      "nord",
      "one-dark",
      "dracula",
      "solarized",
      "gruvbox",
      "tokyo-night",
      "rose-pine",
      "monokai",
      "ayu",
      "everforest",
      "kanagawa",
      "night-owl",
      "material",
      "palenight",
      "horizon",
      "vesper",
      "cobalt",
      "synthwave",
      "oxocarbon",
      "flexoki",
      "zinc"
    ])
  })
})

/**
 * The repositories a reader pinned, which GitHub allows six of.
 *
 * "Six pins is not enough" is its own discussion in their community, and the limit is there
 * for their layout rather than for the reader. There is none here, which is why the record
 * holds a list rather than a choice between values — the one field in these settings that
 * is not a knob, and the only one that has to be read defensively item by item.
 */
describe("the repositories a reader pinned", () => {
  it("starts empty, because a pin is something somebody did", () => {
    expect(readSettings({}).pinned).toEqual([])
  })

  it("comes back in the order they were pinned", () => {
    expect(readSettings({ pinned: ["flazouh/octo-repo", "citrolabs/ego-lite"] }).pinned).toEqual([
      "flazouh/octo-repo",
      "citrolabs/ego-lite"
    ])
  })

  it("drops anything that is not an address", () => {
    // Written by an older version of this file, by a newer one, or by nothing at all. A row
    // drawn from `{}` is a link to `/undefined`.
    expect(readSettings({ pinned: ["flazouh/octo-repo", 4, null, {}, "", "nope"] }).pinned).toEqual([
      "flazouh/octo-repo"
    ])
  })

  it("holds no repository twice, however it was written", () => {
    expect(readSettings({ pinned: ["flazouh/octo-repo", "flazouh/octo-repo"] }).pinned).toEqual([
      "flazouh/octo-repo"
    ])
  })
})

/**
 * The Workflows a reader put away, which is the second field here that is not a knob.
 *
 * A list for the reason the pins are one: the number of Workflows a repository has is theirs
 * and not ours. Each entry names the repository as well as the Workflow, because `ci.yml` is a
 * different file in every repository and one reader has hundreds of them.
 */
describe("the workflows a reader put away", () => {
  it("starts empty, because putting one away is something somebody did", () => {
    expect(readSettings({}).putAway).toEqual([])
  })

  it("keeps the repository and the workflow together", () => {
    expect(
      readSettings({ putAway: ["octo-org/octo-repo:github-code-scanning/codeql"] }).putAway
    ).toEqual(["octo-org/octo-repo:github-code-scanning/codeql"])
  })

  /*
   * A Workflow their sidebar did not name is put away under its own `name:`, and a `name:` may
   * carry a colon: "Code Quality: PR" is a real one off `octo-repo`. So the repository is
   * everything up to the first colon and the Workflow is the whole of the rest, never a split
   * on every colon.
   */
  it("keeps a workflow whose own name carries a colon", () => {
    expect(readSettings({ putAway: ["octo-org/octo-repo:Code Quality: PR"] }).putAway).toEqual([
      "octo-org/octo-repo:Code Quality: PR"
    ])
  })

  it("drops an entry that names no repository, or no workflow", () => {
    expect(
      readSettings({
        putAway: ["ci.yml", "octo-org/octo-repo:", ":ci.yml", 4, null, {}, ""]
      }).putAway
    ).toEqual([])
  })

  it("holds one workflow of one repository once, however it was written", () => {
    expect(
      readSettings({ putAway: ["octo-org/octo-repo:ci.yml", "octo-org/octo-repo:ci.yml"] }).putAway
    ).toEqual(["octo-org/octo-repo:ci.yml"])
  })
})

describe("the groups a reader turned the other way", () => {
  it("starts empty, so every list opens in the shape it was designed in", () => {
    expect(readSettings({}).turned).toEqual([])
  })

  it("keeps the person and the group together", () => {
    expect(readSettings({ turned: ["flazouh:forked"] }).turned).toEqual(["flazouh:forked"])
  })

  it("drops an entry naming a group that does not exist", () => {
    // A turn nothing draws is a choice the reader cannot undo from the screen it
    // was made on.
    expect(
      readSettings({
        turned: ["flazouh:popular", "flazouh:", ":forked", "moving", 4, null, {}, ""]
      }).turned
    ).toEqual([])
  })

  it("holds one group of one person once", () => {
    expect(readSettings({ turned: ["flazouh:quiet", "flazouh:quiet"] }).turned).toEqual([
      "flazouh:quiet"
    ])
  })
})
