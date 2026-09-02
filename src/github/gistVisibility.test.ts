import { describe, expect, test } from "bun:test"
import { isSecretGist } from "./gistVisibility"

/**
 * Markup read live on a secret gist's own page, 2026-09-02, trimmed to the
 * header GitHub draws it in. See `docs/spec/gists.md`.
 */
const SECRET_HEADER = `
<div class="gisthead">
  <h1 class="wb-break-word f3 text-normal mb-md-0 mb-1">
    <span class="author"><a href="/flazouh">flazouh</a></span>
    <span class="mx-1">/</span>
    <strong><a href="/flazouh/0b3809e3400f4985647c9ed34cccdf18">probe.txt</a></strong>
    <span title="Only those with the link can see this gist." class="Label v-align-middle">
      Secret
    </span>
  </h1>
</div>
`

const PUBLIC_HEADER = `
<div class="gisthead">
  <h1 class="wb-break-word f3 text-normal mb-md-0 mb-1">
    <span class="author"><a href="/octocat">octocat</a></span>
    <span class="mx-1">/</span>
    <strong><a href="/octocat/6cad326836d38bd3a7ae">hello_world.rb</a></strong>
  </h1>
</div>
`

const documentOf = (html: string): Document =>
  new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html")

describe("whether a gist reads as secret", () => {
  test("finds the Label GitHub already draws, and says so", () => {
    expect(isSecretGist(documentOf(SECRET_HEADER))).toBe(true)
  })

  test("says nothing is secret about a public gist's page", () => {
    expect(isSecretGist(documentOf(PUBLIC_HEADER))).toBe(false)
  })

  test("says nothing is secret about a page carrying no gist header at all", () => {
    expect(isSecretGist(documentOf("<p>Not a gist page.</p>"))).toBe(false)
  })

  test("does not fire on the word appearing somewhere else on the page", () => {
    const elsewhere = `${PUBLIC_HEADER}<footer>Keep it Secret, keep it safe.</footer>`
    expect(isSecretGist(documentOf(elsewhere))).toBe(false)
  })
})
