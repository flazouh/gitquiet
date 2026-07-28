import * as Bubble from "@radix-ui/react-tooltip"
import { useState } from "react"

/**
 * Where GitHub keeps a face for a login.
 *
 * Their redirect takes a login and answers with the avatar, which saves asking
 * an API for something a row already knows. Apps are written `name[bot]` in
 * commit data and that spelling 404s, so the suffix comes off — enough for the
 * older bots, and the ones it misses fall back to their initial.
 */
export const faceOf = (login: string, size = 40): string =>
  `https://github.com/${encodeURIComponent(login.replace(/\[bot\]$/, ""))}.png?size=${size}`

/**
 * Who did it, as a face rather than a name.
 *
 * A column of logins is a column of ragged text competing with the thing worth
 * reading, which is what changed. A face is scanned without being read, and the
 * name is one hover away for when it matters.
 */
export const Who = ({
  login,
  src,
  size = 16
}: {
  readonly login: string
  /** GitHub's own URL for the face, when the payload carried one. */
  readonly src?: string
  readonly size?: number
}) => {
  const [broken, setBroken] = useState(false)

  return (
    // Its own provider, so a face works wherever one is put rather than only
    // under whichever screen remembered to wrap itself in one.
    <Bubble.Provider delayDuration={0} skipDelayDuration={0}>
      <Bubble.Root>
        <Bubble.Trigger asChild>
          <span
            aria-label={login}
            role="img"
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface text-[9px] font-semibold uppercase text-ink-muted"
            style={{ width: size, height: size }}
          >
            {broken ? (
              login.slice(0, 1)
            ) : (
              <img
                alt=""
                src={src ?? faceOf(login, size * 2)}
                width={size}
                height={size}
                onError={() => setBroken(true)}
              />
            )}
          </span>
        </Bubble.Trigger>
        <Bubble.Portal>
          <Bubble.Content
            side="top"
            sideOffset={6}
            collisionPadding={8}
            className="z-50 rounded-md border border-line bg-raised px-2 py-1 text-xs text-ink shadow-pop"
          >
            {login}
          </Bubble.Content>
          </Bubble.Portal>
      </Bubble.Root>
    </Bubble.Provider>
  )
}
