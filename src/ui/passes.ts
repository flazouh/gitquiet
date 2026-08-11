import { Option, UndefinedOr } from "effect"
import type { Pass, Read } from "../domain/reviewPass"
import { PASSES } from "./keeping"

const store = UndefinedOr.liftThrowable((): Storage => localStorage)
const read = UndefinedOr.liftThrowable((one: Storage, key: string) => one.getItem(key))
const write = UndefinedOr.liftThrowable((one: Storage, key: string, value: string) => {
  one.setItem(key, value)
})
const parse = UndefinedOr.liftThrowable((value: string): unknown => JSON.parse(value))

const keyOf = (subject: string): string => `${PASSES}${subject}`

const isRead = (value: unknown): value is Read => {
  if (typeof value !== "object" || value === null) return false
  const read = value as Partial<Read>
  return typeof read.path === "string" && typeof read.mark === "string"
}

const isPass = (value: unknown): value is Pass => {
  if (typeof value !== "object" || value === null) return false
  const pass = value as Partial<Pass>
  return (
    typeof pass.from === "string" &&
    typeof pass.at === "number" &&
    Number.isFinite(pass.at) &&
    Array.isArray(pass.reads) &&
    pass.reads.every(isRead)
  )
}

/** The Review Pass last kept for this pull request. */
export const passOf = (subject: string): Option.Option<Pass> => {
  const one = store()
  if (one === undefined) return Option.none()

  const value = read(one, keyOf(subject))
  if (value === null || value === undefined) return Option.none()

  const decoded = parse(value)
  return decoded !== undefined && isPass(decoded) ? Option.some(decoded) : Option.none()
}

/** Keep the reader's acts after one more file is read. */
export const keepPass = (subject: string, pass: Pass): void => {
  const one = store()
  if (one === undefined) return

  write(one, keyOf(subject), JSON.stringify(pass))
}
