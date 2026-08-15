/**
 * The Mac App Store provisioning profiles a signed build needs, made if they are
 * not there and written where Xcode looks for them.
 *
 * Made on every release rather than kept as a secret, because a profile expires
 * after a year and a secret does not say so. The first release after the year is
 * up would fail on a file nobody had touched, which is the worst kind.
 */
import { createPrivateKey, sign } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

/** A profile as App Store Connect reports it, with only the parts read here. */
export type Profile = {
  readonly id: string
  readonly name: string
  readonly bundle: string
  readonly state: string
  readonly expires: string
}

/**
 * The profile to sign with, or nothing when one has to be made.
 *
 * A day of margin, because a profile that expires during the review it was
 * uploaded for is refused later, in a mail, rather than here.
 */
export const usable = (profiles: readonly Profile[], bundle: string, now: Date): Profile | null => {
  const day = 24 * 60 * 60 * 1000
  return (
    profiles.find(
      (one) =>
        one.bundle === bundle &&
        one.state === "ACTIVE" &&
        Date.parse(one.expires) - now.getTime() > day
    ) ?? null
  )
}

/** What Xcode reads. Both paths, because the older one is still searched. */
export const profileHomes = (home: string) => [
  join(home, "Library/MobileDevice/Provisioning Profiles"),
  join(home, "Library/Developer/Xcode/UserData/Provisioning Profiles")
]

const token = (keyId: string, issuer: string, pem: string) => {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const head = part({ alg: "ES256", kid: keyId, typ: "JWT" })
  const body = part({ iss: issuer, iat: now, exp: now + 900, aud: "appstoreconnect-v1" })
  // `ieee-p1363` is the pair of numbers a JSON web token carries. The default is
  // DER, which Apple answers 401 to without saying why.
  const seal = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(pem),
    dsaEncoding: "ieee-p1363"
  }).toString("base64url")
  return `${head}.${body}.${seal}`
}

/**
 * As much of a reply as is read here. Every field is optional because one address
 * answers with certificates, another with profiles, and a third with identifiers.
 */
type Reply = {
  readonly data?: readonly {
    readonly id: string
    readonly attributes: {
      readonly certificateType?: string
      readonly identifier?: string
      readonly name?: string
      readonly profileState?: string
      readonly expirationDate?: string
      readonly profileContent?: string
    }
    readonly relationships?: { readonly bundleId?: { readonly data?: { readonly id: string } } }
  }[]
  readonly errors?: readonly { readonly title: string; readonly detail: string }[]
}

const main = async () => {
  const bundles = process.argv.slice(2)
  if (bundles.length === 0) throw new Error("Name the bundle identifiers to cover.")

  const keyId = need("APPLE_ASC_KEY_ID")
  const issuer = need("APPLE_ASC_ISSUER_ID")
  const pem = readFileSync(need("APPLE_ASC_KEY_PATH"), "utf8")
  const bearer = token(keyId, issuer, pem)

  const ask = async (method: "GET" | "POST", path: string, payload?: unknown): Promise<Reply> => {
    const answer = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(payload === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    })
    const reply = (await answer.json()) as Reply
    if (reply.errors) {
      throw new Error(
        `${method} ${path}: ${reply.errors.map((e) => `${e.title} ${e.detail}`).join("; ")}`
      )
    }
    return reply
  }

  const certificates = await ask("GET", "/v1/certificates?limit=200")
  const distribution = certificates.data?.find(
    (one) => one.attributes.certificateType === "DISTRIBUTION"
  )
  if (!distribution) throw new Error("This team has no Apple Distribution certificate.")

  const identifiers = await ask("GET", "/v1/bundleIds?limit=200")
  const idOf = new Map(
    (identifiers.data ?? []).map((one) => [one.attributes.identifier ?? "", one.id] as const)
  )

  const found = await ask("GET", "/v1/profiles?include=bundleId&limit=200")
  // A profile missing any of these is one this cannot judge, so it is passed over
  // and a new one is made rather than signing with something half read.
  const known: Profile[] = (found.data ?? []).map((one) => ({
    id: one.id,
    name: one.attributes.name ?? "",
    bundle: one.relationships?.bundleId?.data?.id ?? "",
    state: one.attributes.profileState ?? "",
    expires: one.attributes.expirationDate ?? ""
  }))

  const homes = profileHomes(homedir())
  for (const home of homes) mkdirSync(home, { recursive: true })

  for (const bundle of bundles) {
    const registered = idOf.get(bundle)
    if (!registered) throw new Error(`${bundle} is not a registered bundle identifier.`)

    const already = usable(known, registered, new Date())
    const name = already?.name ?? `${bundle} Mac App Store`
    if (!already) {
      await ask("POST", "/v1/profiles", {
        data: {
          type: "profiles",
          attributes: { name, profileType: "MAC_APP_STORE" },
          relationships: {
            bundleId: { data: { type: "bundleIds", id: registered } },
            certificates: { data: [{ type: "certificates", id: distribution.id }] }
          }
        }
      })
    }

    // Read back by name either way, because a create answers with the profile
    // itself where a list answers with a list, and one reader is fewer than two.
    const whole = (await ask("GET", `/v1/profiles?filter[name]=${encodeURIComponent(name)}`))
      .data?.[0]
    if (whole === undefined) throw new Error(`Found no profile named ${name}.`)
    const content = whole.attributes.profileContent
    if (content === undefined) throw new Error(`The profile named ${name} came back empty.`)

    const bytes = Buffer.from(content, "base64")
    for (const home of homes) writeFileSync(join(home, `${name}.provisionprofile`), bytes)
    const until = whole.attributes.expirationDate
    console.log(`${bundle}\t${name}\t${already ? "kept" : "made"}\t${until}`)
  }
}

const need = (name: string) => {
  const value = process.env[name]
  if (value === undefined || value === "") throw new Error(`${name} is not set.`)
  return value
}

if (import.meta.main) await main()
