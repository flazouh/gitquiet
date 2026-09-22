import { describe, expect, test } from "bun:test"
import { phpPrefixesIn } from "./composer"

/*
 * A PHP namespace is a folder by convention and by `composer.json`, which says so
 * outright: Laravel maps `Illuminate\Support\` to five folders, and a class in
 * four of them was a file no convention could find.
 */
describe("what composer.json says each namespace is", () => {
  test("reads the PSR-4 map, a folder or several, from the root and from a package", () => {
    const files = new Map([
      ["composer.json", JSON.stringify({ autoload: { "psr-4": { "Illuminate\\": "src/Illuminate/", "Illuminate\\Support\\": ["src/Illuminate/Macroable/", "src/Illuminate/Conditionable"] } } })],
      ["src/Illuminate/Collections/composer.json", JSON.stringify({ autoload: { "psr-4": { "Illuminate\\Support\\": "" } }, "autoload-dev": { "psr-4": { "Tests\\": "tests/" } } })],
      ["vendor/other/composer.json", JSON.stringify({ autoload: { "psr-4": { "Other\\": "src/" } } })],
      ["broken/composer.json", "{ not json"]
    ])

    expect(Object.fromEntries([...phpPrefixesIn(files)].map(([prefix, folders]) => [prefix, [...folders]]))).toEqual({
      "Illuminate\\": ["src/Illuminate"],
      "Illuminate\\Support\\": ["src/Illuminate/Macroable", "src/Illuminate/Conditionable", "src/Illuminate/Collections"],
      "Tests\\": ["src/Illuminate/Collections/tests"]
    })
  })
})
