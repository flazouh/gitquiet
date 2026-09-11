import { afterEach, expect, test } from "bun:test"
import { loadSheet, softSheet } from "./gateCss"
import { HOME_READY, watchHomeGate } from "./homeGate"
import { HOME } from "./place"

let stop = () => {}
afterEach(() => stop())
const turn = () => new Promise<void>(resolve => setTimeout(resolve, 0))
const page = () => document.implementation.createHTMLDocument("GitHub")

test("home gates do not make body observe all descendant styles", () => {
  expect(loadSheet([HOME])).not.toContain("body:has(")
  expect(softSheet([HOME])).not.toContain("body:has(")
})

test("the home gate follows the native dashboard and leaves the feed visible", async () => {
  const target = page()
  target.body.innerHTML = '<main id="feed" class="dashboard"></main>'
  stop = watchHomeGate(target)
  const gated = () => {
    const sheet = softSheet([HOME])
    const selector = sheet.slice(sheet.indexOf("html["), sheet.indexOf(" {"))
    return target.querySelector(selector) !== null
  }
  target.documentElement.setAttribute("data-gitquiet-gating", "")
  expect(gated()).toBe(false)
  target.body.innerHTML = '<main id="dashboard" class="dashboard"></main>'
  await turn()
  expect(gated()).toBe(true)
  expect(target.body.hasAttribute(HOME_READY)).toBe(true)
  target.getElementById("dashboard")!.className = "other"
  await turn()
  expect(gated()).toBe(false)
  target.getElementById("dashboard")!.className = "dashboard"
  await turn()
  expect(gated()).toBe(true)
  target.getElementById("dashboard")!.id = "feed"
  await turn()
  expect(gated()).toBe(false)
})

test("existing home is marked synchronously and removal clears it", async () => {
  const target = page()
  target.body.innerHTML = '<main id="dashboard" class="dashboard"></main>'
  stop = watchHomeGate(target)
  expect(target.body.hasAttribute(HOME_READY)).toBe(true)
  target.getElementById("dashboard")!.remove()
  await turn()
  expect(target.body.hasAttribute(HOME_READY)).toBe(false)
})

test("body replacement and cleanup leave no stale gate", async () => {
  const target = page()
  target.body.innerHTML = '<main id="dashboard" class="dashboard"></main>'
  stop = watchHomeGate(target)
  const previous = target.body
  const replacement = target.createElement("body")
  target.body.replaceWith(replacement)
  await turn()
  expect(previous.hasAttribute(HOME_READY)).toBe(false)
  expect(replacement.hasAttribute(HOME_READY)).toBe(false)
  replacement.innerHTML = '<main id="dashboard" class="dashboard"></main>'
  await turn()
  expect(replacement.hasAttribute(HOME_READY)).toBe(true)
  stop()
  expect(replacement.hasAttribute(HOME_READY)).toBe(false)
  replacement.replaceChildren()
  replacement.innerHTML = '<main id="dashboard" class="dashboard"></main>'
  await turn()
  expect(replacement.hasAttribute(HOME_READY)).toBe(false)
})

test("a body arriving after document start can establish the gate", async () => {
  const target = page()
  target.body.remove()
  stop = watchHomeGate(target)
  const body = target.createElement("body")
  body.innerHTML = '<main id="dashboard" class="dashboard"></main>'
  target.documentElement.append(body)
  await turn()
  expect(body.hasAttribute(HOME_READY)).toBe(true)
})

test("rapid dashboard changes and unrelated content keep the final gate correct", async () => {
  const target = page()
  target.body.innerHTML = '<main id="dashboard" class="dashboard"></main><div id="gitquiet-root"></div>'
  stop = watchHomeGate(target)
  const dashboard = target.getElementById("dashboard")!
  const root = target.getElementById("gitquiet-root")!
  dashboard.remove()
  dashboard.className = "other"
  target.body.append(dashboard)
  dashboard.className = "dashboard"
  for (let i = 0; i < 1000; i++) root.append(target.createElement("span"))
  await turn()
  expect(target.body.hasAttribute(HOME_READY)).toBe(true)
  target.documentElement.removeAttribute("data-gitquiet-gating")
  expect(target.querySelector('html[data-gitquiet-gating] body[data-gitquiet-home]')).toBeNull()
})

test("the dashboard must be a descendant of body", async () => {
  const target = page()
  target.body.id = "dashboard"
  target.body.className = "dashboard"
  stop = watchHomeGate(target)
  expect(target.body.hasAttribute(HOME_READY)).toBe(false)
  target.body.removeAttribute("id")
  target.body.removeAttribute("class")
  target.head.innerHTML = '<meta id="dashboard" class="dashboard">'
  await turn()
  expect(target.body.hasAttribute(HOME_READY)).toBe(false)
})
