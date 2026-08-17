import { useEffect, useState } from "react"

/**
 * One public read, from the reader's own browser, kept once it lands.
 *
 * No loading state and no error state, because there is nothing for a reader to do
 * about either. Everything this site reads live is decoration around something that
 * works without it: a star count beside a link, a size beside a download. So a rate
 * limit, an offline reader, or a shape the service changed all end as a page that says
 * less rather than as a page that fails.
 *
 * The reader is a module-level function at both call sites, which is what keeps this
 * from re-fetching on every render. Anything else in that slot needs a `useCallback`,
 * so keep the argument a plain function that lives at the top of a module.
 */
export const useRead = <Answer>(
  at: string,
  read: (body: unknown) => Answer | undefined,
  headers?: Readonly<Record<string, string>>
): Answer | undefined => {
  const [got, setGot] = useState<Answer | undefined>(undefined)

  useEffect(() => {
    let gone = false

    fetch(at, headers === undefined ? undefined : { headers })
      .then((response) => (response.ok ? response.json() : undefined))
      .then((body) => {
        const now = read(body)
        if (gone || now === undefined) return
        setGot(now)
      })
      .catch(() => {})

    return () => {
      gone = true
    }
  }, [at, read, headers])

  return got
}
