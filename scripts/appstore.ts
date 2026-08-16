/**
 * Asking App Store Connect something, over the API rather than the dashboard.
 *
 * Apart from the two scripts that use it, because a release asks Apple for the
 * profiles it has to sign with and asks again whether the build it is about to
 * send is already there.
 */
import { createPrivateKey, sign } from "node:crypto"

/** What the API answers with, where the caller names the fields it reads. */
export type Records<Fields> = {
  readonly data: readonly { readonly id: string; readonly attributes: Fields }[]
}

export type Ask = <Fields>(
  method: "GET" | "POST" | "PATCH",
  path: string,
  payload?: unknown
) => Promise<Records<Fields>>

export const need = (name: string) => {
  const value = process.env[name]
  if (value === undefined || value === "") throw new Error(`${name} is not set.`)
  return value
}

/**
 * A token good for fifteen minutes, which is as long as Apple allows.
 *
 * `ieee-p1363` is the pair of numbers a JSON web token carries. The default is
 * DER, which Apple answers 401 to without saying why.
 */
export const token = (keyId: string, issuer: string, pem: string) => {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const now = Math.floor(Date.now() / 1000)
  const head = part({ alg: "ES256", kid: keyId, typ: "JWT" })
  const body = part({ iss: issuer, iat: now, exp: now + 900, aud: "appstoreconnect-v1" })
  const seal = sign("sha256", Buffer.from(`${head}.${body}`), {
    key: createPrivateKey(pem),
    dsaEncoding: "ieee-p1363"
  }).toString("base64url")
  return `${head}.${body}.${seal}`
}

type Failure = { readonly errors?: readonly { readonly title: string; readonly detail: string }[] }

/** Whatever came back as `data`, as a list, and nothing when there was none. */
export const records = <Fields>(data: unknown): Records<Fields>["data"] => {
  const list = Array.isArray(data) ? data : data === undefined || data === null ? [] : [data]
  return list as Records<Fields>["data"]
}

/**
 * Reads the key named by the environment and answers questions with it.
 *
 * A failure is thrown rather than returned, because every caller here wants the
 * release to stop: signing with half an answer makes a package Apple refuses
 * days later, in a mail, where this refuses it now and says which address failed.
 */
export const connect = (read: (path: string) => string): Ask => {
  const bearer = token(need("APPLE_ASC_KEY_ID"), need("APPLE_ASC_ISSUER_ID"), read(need("APPLE_ASC_KEY_PATH")))
  return async (method, path, payload) => {
    const answer = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(payload === undefined ? {} : { "Content-Type": "application/json" })
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) })
    })
    // A write to a relationship answers 204 with nothing in it, so the body is
    // read as text first and only parsed when there is one. `json()` on an empty
    // body returns null, and reading `errors` off that throws a TypeError which
    // says nothing about the address that was asked.
    const body = await answer.text()
    // The one cast, because JSON arrives untyped and the caller is the only one
    // who knows which address it asked and so which fields come back.
    const reply = (body === "" ? {} : JSON.parse(body)) as Failure & { readonly data?: unknown }
    if (!answer.ok && reply.errors === undefined) {
      throw new Error(`${method} ${path}: Apple answered ${answer.status} with ${body || "nothing"}.`)
    }
    if (reply.errors) {
      throw new Error(
        `${method} ${path}: ${reply.errors.map((e) => `${e.title} ${e.detail}`).join("; ")}`
      )
    }
    // A list answers with a list and a create answers with the one thing it made.
    // Both are read here as a list of what came back, so a caller has one shape.
    return { data: records(reply.data) }
  }
}
