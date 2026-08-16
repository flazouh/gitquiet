/**
 * Whether App Store Connect already holds a build of this version.
 *
 * Prints `held` or `new`. The upload reads it and stops when the answer is
 * `held`, because Apple refuses a build number it has seen and the tag is the
 * build number. Without this, re-running the Safari job after any later step
 * failed would always end red on an upload that had already worked.
 *
 * Usage: apple-build.ts <bundle identifier> <version>
 */
import { readFileSync } from "node:fs"
import { connect } from "./appstore"

const main = async () => {
  const [bundle, version] = process.argv.slice(2)
  if (bundle === undefined || version === undefined) {
    throw new Error("Usage: apple-build.ts <bundle identifier> <version>")
  }

  const ask = connect((path) => readFileSync(path, "utf8"))
  const apps = await ask<never>("GET", `/v1/apps?filter[bundleId]=${encodeURIComponent(bundle)}`)
  const app = apps.data[0]?.id
  // No app record is the first release, before anyone has made one. Nothing is
  // held, and the upload is what says so in words Apple wrote.
  if (app === undefined) return console.log("new")

  const builds = await ask<never>(
    "GET",
    `/v1/builds?filter[app]=${app}&filter[version]=${encodeURIComponent(version)}`
  )
  console.log(builds.data.length > 0 ? "held" : "new")
}

if (import.meta.main) await main()
