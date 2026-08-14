import { describe, expect, it } from "bun:test"
import { THEME_KNOBS } from "./Settings"
import { syntaxOf, GITHUB_SYNTAX, ONE_DARK_SYNTAX, type SyntaxPair } from "./syntax"
import type { Pack } from "./theme"
import { LOADERS } from "../syntax/loaders"

const PACKS = THEME_KNOBS.find((one) => one.key === "pack")!
  .choices.map((choice) => choice.value)
  .filter((value): value is Pack => value !== "match")

describe("which Shiki theme paints the code", () => {
  it("keeps One Dark and GitHub as fixed overrides", () => {
    expect(syntaxOf("github", "dracula")).toEqual(GITHUB_SYNTAX)
    expect(syntaxOf("one-dark", "dracula")).toEqual(ONE_DARK_SYNTAX)
  })

  it("follows the pack when the knob says to match", () => {
    expect(syntaxOf("match", "dracula")).toEqual({ dark: "dracula", light: "dracula-soft" })
    expect(syntaxOf("match", "github")).toEqual(GITHUB_SYNTAX)
    expect(syntaxOf("match", "catppuccin")).toEqual({
      dark: "catppuccin-mocha",
      light: "catppuccin-latte"
    })
  })

  it("answers a dark and a light name for every shipped pack", () => {
    for (const pack of PACKS) {
      const pair: SyntaxPair = syntaxOf("match", pack)
      expect([pack, pair.dark.length > 0, pair.light.length > 0]).toEqual([pack, true, true])
    }
  })

  it("has a Shiki loader for every name except Pierre's own light", () => {
    const names = new Set<string>()
    for (const pack of PACKS) {
      const pair = syntaxOf("match", pack)
      names.add(pair.dark)
      names.add(pair.light)
    }
    names.add(GITHUB_SYNTAX.dark)
    names.add(GITHUB_SYNTAX.light)
    names.add(ONE_DARK_SYNTAX.dark)
    names.add(ONE_DARK_SYNTAX.light)
    for (const name of names) {
      if (name === "pierre-light") continue
      expect([name, Object.hasOwn(LOADERS, name)]).toEqual([name, true])
    }
  })
})
