/**
 * Puts the screen captures the onboarding shows beside the compiled view.
 *
 * The onboarding names a screen — `working-set`, `pull-request`, `commit` — and each
 * host draws it as it can. The site mounts the real screen and runs it; a window would
 * be fetching a four-megabyte diff engine to draw a picture nobody reads the code in,
 * so the window shows the capture the site already ships.
 *
 * Copied rather than committed twice. `bun run shots` in the repository root retakes
 * them, and a second copy under `desktop/` would be a picture of an older interface
 * the day after anybody forgets.
 *
 * Only the ones the onboarding names. There are twelve captures and the tour shows
 * three of them, at four hundred kilobytes each.
 */
import { cp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { BEATS } from "../../src/ui/onboarding/beats"

/* `fileURLToPath` rather than `.pathname`, which leaves a space in a checkout's path
   as `%20` and then looks for a directory nobody has. */
const here = fileURLToPath(new URL("..", import.meta.url))
const from = join(here, "../site/public/shots")
const beside = join(here, "src/view/shots")

await rm(beside, { recursive: true, force: true })
await mkdir(beside, { recursive: true })

const wanted = BEATS.flatMap((beat) => (beat.shot === undefined ? [] : [beat.shot]))

for (const shot of wanted) {
  const file = `${shot}@2x.png`
  const at = join(from, file)

  if (!(await Bun.file(at).exists())) {
    throw new Error(`The onboarding asks for ${file}, and site/public/shots has no such capture.`)
  }

  await cp(at, join(beside, file))
}

console.log(`copied ${wanted.length} shots`)
