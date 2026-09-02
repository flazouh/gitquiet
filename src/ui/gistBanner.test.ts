import { afterEach, describe, expect, test } from "bun:test"
import { GHOST_ID, plantSecretBanner } from "./gistBanner"

const SECRET_HEADER = `
<div class="gisthead">
  <h1 class="wb-break-word f3 text-normal mb-md-0 mb-1">
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
    <strong><a href="/octocat/6cad326836d38bd3a7ae">hello_world.rb</a></strong>
  </h1>
</div>
`

const documentOf = (html: string): Document =>
  new DOMParser().parseFromString(`<html><body>${html}</body></html>`, "text/html")

afterEach(() => {
  document.body.innerHTML = ""
})

describe("the banner naming what Secret actually means", () => {
  test("is planted on a secret gist, saying plainly what the link does and does not protect", () => {
    const page = documentOf(SECRET_HEADER)
    plantSecretBanner(page)

    const banner = page.getElementById(GHOST_ID)
    expect(banner).not.toBeNull()
    expect(banner?.textContent).toContain("link")
  })

  test("plants nothing on a public gist", () => {
    const page = documentOf(PUBLIC_HEADER)
    plantSecretBanner(page)

    expect(page.getElementById(GHOST_ID)).toBeNull()
  })

  test("plants nothing a second time, so a re-render does not stack banners", () => {
    const page = documentOf(SECRET_HEADER)
    plantSecretBanner(page)
    plantSecretBanner(page)

    expect(page.querySelectorAll(`#${GHOST_ID}`).length).toBe(1)
  })

  test("plants nothing on a page with no gist header at all", () => {
    const page = documentOf("<p>Not a gist page.</p>")
    plantSecretBanner(page)

    expect(page.getElementById(GHOST_ID)).toBeNull()
  })
})
