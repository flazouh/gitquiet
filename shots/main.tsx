import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { paintFloor } from "@/ui/applyTheme"
import { ROOT_ID } from "@/ui/mount"
import { tokensOf } from "@/domain/theme"
import { Supplied } from "./Supplied"
import { VIEWS, viewNamed } from "./views"
import "./stage.css"

/**
 * The stage.
 *
 *     /?view=working-set
 *
 * One view at a time, at its own exact pixel size, with nothing around it: no
 * scrollbar, no page margin, no browser chrome. What the capture script clips is
 * therefore the element and not a guess at where the element is.
 *
 * `?view=` with no match, or none at all, lists what there is. That listing is for
 * a person opening the stage by hand; the capture script never sees it.
 */

/*
 * The extension's own root id, taken from the extension.
 *
 * Not a name this stage chose. The interface's stylesheets are all scoped to
 * `:is(#gitquiet-root, [data-gitquiet-outside])`, so a screen mounted under any other
 * id draws with the Tailwind utilities and none of the rules written by hand — which
 * is a screen that looks nearly right and is wrong in the places worth photographing.
 */
const stage = document.getElementById(ROOT_ID)
if (stage === null) throw new Error(`#${ROOT_ID} is missing from index.html`)

/*
 * The canvas under the screen, painted before React runs.
 *
 * `Theme scope="document"` paints the tokens onto `<html>`, and the floor is a
 * second name the theme sets for the colour behind everything — inside the
 * extension that is what covers GitHub's own page. Here there is no page to cover,
 * and without it the frame around a screen is white.
 */
paintFloor(document, tokensOf("gitquiet", "dark"))
document.documentElement.style.background = "var(--gitquiet-floor)"

/*
 * What there is to photograph, said to whoever is driving the browser.
 *
 * `shots/capture.js` runs in ego's Node and cannot import a TypeScript module, so
 * the list has to cross that boundary somehow. Read off the page is the only way
 * that cannot fall out of step: the capture loop is driven by the same array the
 * stage renders from, so a view added to `views.tsx` is photographed without
 * anything else being told about it.
 */
Object.assign(window, {
  __views: VIEWS.map(({ name, caption, width, height, ready }) => ({
    name,
    caption,
    width,
    height,
    ready
  }))
})

const asked = new URLSearchParams(window.location.search).get("view")
const view = asked === null ? undefined : viewNamed(asked)

if (view === undefined) {
  stage.innerHTML = `
    <ul style="font: 14px ui-monospace, monospace; padding: 24px; line-height: 2">
      ${VIEWS.map(
        (one) =>
          `<li><a href="?view=${one.name}" style="color: #79c0ff">${one.name}</a>
             <span style="opacity: .5"> ${one.width}×${one.height}</span></li>`
      ).join("")}
    </ul>`
} else {
  document.title = `gitquiet: ${view.name}`
  stage.style.width = `${view.width}px`
  stage.style.height = `${view.height}px`
  stage.style.overflow = "hidden"
  stage.dataset.view = view.name

  createRoot(stage).render(
    <StrictMode>
      <Supplied chosen={view.chosen}>{view.draw()}</Supplied>
    </StrictMode>
  )
}
