import { useEffect, useState } from "react"

/**
 * How many people have starred the repository, for the nav to say so.
 *
 * Asked of GitHub from the reader's own browser rather than baked in at build time. A
 * number written into the bundle is right on the day it is deployed and quietly wrong
 * after it, and this page is deployed when the copy changes rather than when somebody
 * stars the repository. The route needs no token for a public repository and answers a
 * few hundred bytes.
 *
 * A failure says nothing. The count is decoration next to a link that works either way,
 * so a rate limit, an offline reader or a shape GitHub changed all end as a chip with no
 * number in it rather than as anything a reader has to read.
 */

const COUNT_AT = "https://api.github.com/repos/flazouh/gitquiet"

/**
 * Where the last answer is kept.
 *
 * So a second visit has a number in the first frame instead of a chip that grows a
 * quarter of a second in. It is shown while the live read runs behind it and replaced
 * when that lands, which for a star count is the whole of the policy worth having.
 */
const KEPT = "gitquiet.stars"

const remembered = (): number | undefined => {
  try {
    const said = window.localStorage.getItem(KEPT)
    const many = said === null ? Number.NaN : Number(said)
    return Number.isInteger(many) && many >= 0 ? many : undefined
  } catch {
    // A browser with storage turned off, which is a first frame without a number in it.
    return undefined
  }
}

const remember = (many: number): void => {
  try {
    window.localStorage.setItem(KEPT, String(many))
  } catch {}
}

const countIn = (body: unknown): number | undefined => {
  const said = (body as { readonly stargazers_count?: unknown } | null)?.stargazers_count
  return typeof said === "number" && Number.isInteger(said) && said >= 0 ? said : undefined
}

export const useStars = (): number | undefined => {
  const [many, setMany] = useState<number | undefined>(remembered)

  useEffect(() => {
    let gone = false

    fetch(COUNT_AT, { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body) => {
        const now = countIn(body)
        if (gone || now === undefined) return

        remember(now)
        setMany(now)
      })
      .catch(() => {})

    return () => {
      gone = true
    }
  }, [])

  return many
}

/**
 * The count as GitHub itself writes it: a thousand and up in thousands, one decimal
 * until ten thousand.
 *
 * Their own header says `1.2k` where this said `1200`, and two numbers for one fact on
 * the same screen is a reader wondering which of them to believe.
 */
export const inShort = (many: number): string => {
  if (many < 1_000) return String(many)
  const thousands = many / 1_000
  return `${many < 10_000 ? thousands.toFixed(1) : Math.round(thousands)}k`
}
