/**
 * The Mac App Store provisioning profiles a signed build needs, made if they are
 * not there and written where Xcode looks for them.
 *
 * Made on every release rather than kept as a secret, because a profile expires
 * after a year and a secret does not say so. The first release after the year is
 * up would fail on a file nobody had touched, which is the worst kind.
 *
 * Usage: apple-profiles.ts <file to write> <bundle identifier>...
 *
 * The file is written here rather than piped, because a workflow step runs under
 * `bash -e` without `pipefail`: through a pipe, a throw from this script leaves a
 * green step and a file with nothing in it.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { connect, type Ask, type Records } from "./appstore"

/** A profile this can judge: one missing any of these is passed over. */
export type Profile = {
  readonly name: string
  readonly state: string
  readonly expires: string
  readonly content: string
}

type ProfileFields = {
  readonly name?: string
  readonly profileState?: string
  readonly expirationDate?: string
  readonly profileContent?: string
}

/**
 * The profiles that can be judged at all, of those that came back.
 *
 * A half-read profile is dropped rather than filled in, because the gaps decide
 * things: a profile with no name was once written to disk as `.provisionprofile`,
 * a dotfile Xcode never looks at, and the export failed on a missing profile.
 */
export const readable = (found: Records<ProfileFields>["data"]): readonly Profile[] =>
  found.flatMap((one) => {
    const { name, profileState, expirationDate, profileContent } = one.attributes
    if (!name || !profileState || !expirationDate || !profileContent) return []
    return [{ name, state: profileState, expires: expirationDate, content: profileContent }]
  })

/**
 * The profile worth signing with, or nothing when one has to be made.
 *
 * A day of margin, because a profile that expires during the review it was
 * uploaded for is refused later, in a mail, rather than here.
 */
export const usable = (profiles: readonly Profile[], now: Date): Profile | null => {
  const day = 24 * 60 * 60 * 1000
  return (
    profiles.find(
      (one) => one.state === "ACTIVE" && Date.parse(one.expires) - now.getTime() > day
    ) ?? null
  )
}

/** What Xcode reads. Both paths, because the older one is still searched. */
export const profileHomes = (home: string) => [
  join(home, "Library/MobileDevice/Provisioning Profiles"),
  join(home, "Library/Developer/Xcode/UserData/Provisioning Profiles")
]

type CertificateFields = { readonly expirationDate?: string; readonly displayName?: string }

/**
 * Every Apple Distribution certificate that has not expired, so the profile
 * covers whichever one the runner's keychain holds.
 *
 * All of them rather than the newest, because a team renewing a certificate has
 * two for a month and this cannot see which one the keychain was given. A
 * profile that names the other produces "provisioning profile doesn't include
 * signing certificate", about a certificate nobody chose.
 */
const distributing = async (ask: Ask, now: Date) => {
  const found = await ask<CertificateFields>(
    "GET",
    "/v1/certificates?filter[certificateType]=DISTRIBUTION&limit=200"
  )
  const live = found.data.filter((one) => Date.parse(one.attributes.expirationDate ?? "") > now.getTime())
  if (live.length === 0) throw new Error("This team has no Apple Distribution certificate that has not expired.")
  return live
}

const main = async () => {
  const [into, ...bundles] = process.argv.slice(2)
  if (into === undefined || bundles.length === 0) {
    throw new Error("Usage: apple-profiles.ts <file to write> <bundle identifier>...")
  }

  const ask = connect((path) => readFileSync(path, "utf8"))
  const now = new Date()
  const certificates = await distributing(ask, now)

  const homes = profileHomes(homedir())
  for (const home of homes) mkdirSync(home, { recursive: true })

  const lines: string[] = []
  for (const bundle of bundles) {
    // Asked for by the name this script gives them, and by type, because there
    // are more profiles in an account than one page holds and a profile of
    // another type can carry the same name.
    const name = `${bundle} Mac App Store`
    const mine = `/v1/profiles?filter[name]=${encodeURIComponent(name)}&filter[profileType]=MAC_APP_STORE`
    const look = async () => usable(readable((await ask<ProfileFields>("GET", mine)).data), now)

    const already = await look()
    if (!already) await make(ask, bundle, name, certificates)
    const profile = already ?? (await look())
    if (!profile) throw new Error(`Made a profile named ${name} and then could not read it back.`)

    const bytes = Buffer.from(profile.content, "base64")
    for (const home of homes) writeFileSync(join(home, `${name}.provisionprofile`), bytes)
    lines.push(`${bundle}\t${name}\t${already ? "kept" : "made"}\t${profile.expires}`)
  }

  const report = `${lines.join("\n")}\n`
  writeFileSync(into, report)
  process.stdout.write(report)
}

const make = async (
  ask: Ask,
  bundle: string,
  name: string,
  certificates: Records<unknown>["data"]
) => {
  const registered = await ask<never>(
    "GET",
    `/v1/bundleIds?filter[identifier]=${encodeURIComponent(bundle)}`
  )
  const id = registered.data[0]?.id
  if (id === undefined) throw new Error(`${bundle} is not a registered bundle identifier.`)

  await ask("POST", "/v1/profiles", {
    data: {
      type: "profiles",
      attributes: { name, profileType: "MAC_APP_STORE" },
      relationships: {
        bundleId: { data: { type: "bundleIds", id } },
        certificates: { data: certificates.map((one) => ({ type: "certificates", id: one.id })) }
      }
    }
  })
}

if (import.meta.main) await main()
