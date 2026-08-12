/**
 * Photographs the inbox screen as it really stands on github.com, into `.tmp`.
 *
 *     ego-browser nodejs < scripts/shoot-notifications.js
 *
 * A picture of the live page rather than of the mock in `shots/mock/notifications.tsx`. The
 * mock is what the store listing shows and it is invented data; this is the reader's own inbox
 * with their own theme on it, which is the only thing that answers whether the screen sits in
 * GitHub's clothes.
 */

import { mkdirSync, writeFileSync } from "node:fs"

const EXTENSION = "/Users/alex/Documents/githubpro-notifications/.output/chrome-mv3"
const INTO = "/Users/alex/Documents/githubpro-notifications/.tmp"

const task = await useOrCreateTaskSpace("verify gitquiet on the notifications page")
await takeOverTaskSpace(task.id)

await cdp("Extensions.loadUnpacked", { path: EXTENSION }, null)
await gotoAndWait("https://github.com/notifications", { timeout: 40, settle: 3 })
await wait(4)

const shot = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true })

mkdirSync(INTO, { recursive: true })
const at = `${INTO}/notifications-live.png`
writeFileSync(at, Buffer.from(shot.data, "base64"))
cliLog(at)

await handOffTaskSpace(task.id)
