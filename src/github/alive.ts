/**
 * GitHub's own way of saying a pull request changed.
 *
 * Every page they serve holds one websocket open to `alive.github.com` and
 * subscribes it to signed channel tokens carried in the payloads: a merge
 * queue, a review, a workflow run. The server pushes a line when the thing
 * behind a token moves, and the page reads that slice again.
 *
 * This is that socket, for the payloads this extension already fetches. It is
 * the alternative to an interval poll — which would be both slower to notice a
 * change and the request pattern that gets a reader rate-limited.
 *
 * The protocol, from GitHub's own client and confirmed against their server:
 *
 * - subscribe with `{"subscribe": {"<token>": "<offset>"}}`, offsets as
 *   **strings**; `"-1"` means everything from now on. Sent as a number the
 *   server closes the connection with `failed to unmarshal JSON`, which on
 *   this side looks exactly like a socket that never said anything.
 * - `{"e":"ack","off":"…","health":true}` acknowledges the subscription.
 * - `{"e":"msg","ch":"<token>","off":"…","data":{…}}` is the change itself.
 *
 * What is in `data` is deliberately ignored. It differs by channel and is not
 * documented anywhere; the fact worth having is that the thing named by `ch`
 * is no longer what we last read, and reading it again answers that honestly
 * whatever GitHub put in the payload.
 */
import { UndefinedOr } from "effect"

/** As much of a websocket as this needs, so a test can be one. */
export type Socket = {
  // Written as methods, and listened to rather than assigned to, so that a
  // real WebSocket satisfies this without an adapter in between.
  addEventListener(kind: "open" | "message" | "close", react: (event: Frame) => void): void
  send(frame: string): void
  close(): void
}

/** As much of a message event as this reads. */
export type Frame = { readonly data?: unknown }

/**
 * How long to wait before opening the socket again, by attempt.
 *
 * Doubling from a quarter of a second to half a minute. A reader who closes
 * their laptop comes back to a socket that reconnects immediately; a GitHub
 * that is down is not asked sixty times a minute whether it still is.
 */
const backoff = (attempt: number): number => Math.min(250 * 2 ** attempt, 30_000)

export type Listening = {
  /** Opens the socket. Called again on every reconnection. */
  readonly open: () => Socket
  /** GitHub's signed tokens, from the payloads that carried them. */
  readonly channels: ReadonlyArray<string>
  /** Called with the token whose subject changed. */
  readonly onFire: (channel: string) => void
  readonly wait?: (attempt: number) => number
}

/**
 * Holds a subscription open until the returned function is called.
 *
 * Offsets are remembered per channel so a reconnection asks for what it
 * missed rather than for what happens next: the interesting case is exactly
 * the one where the socket was down while the queue moved.
 */
export const listen = ({ open, channels, onFire, wait = backoff }: Listening): (() => void) => {
  const offsets = new Map(channels.map((channel) => [channel, "-1"]))
  let attempt = 0
  let stopped = false
  let socket: Socket | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const start = () => {
    if (stopped) return
    const opened = open()
    socket = opened

    opened.addEventListener("open", () => {
      attempt = 0
      opened.send(JSON.stringify({ subscribe: Object.fromEntries(offsets) }))
    })

    opened.addEventListener("message", (frame) => {
      const said = read(frame.data)
      if (said === undefined || said.e !== "msg" || typeof said.ch !== "string") return

      // A channel nobody asked for is GitHub's business, not this reader's —
      // and remembering its offset would subscribe to it on the next
      // reconnection, which is how one arrives for good.
      if (!offsets.has(said.ch)) return

      if (typeof said.off === "string") offsets.set(said.ch, said.off)
      onFire(said.ch)
    })

    opened.addEventListener("close", () => {
      if (stopped) return
      timer = setTimeout(start, wait(attempt++))
    })
  }

  start()

  return () => {
    stopped = true
    if (timer !== undefined) clearTimeout(timer)
    socket?.close()
  }
}

type Said = { readonly e?: string; readonly ch?: string; readonly off?: string }

/**
 * Reading their JSON without the throw: a frame that is not JSON comes back as
 * nothing, which is what every caller here wants anyway.
 */
const parsed = UndefinedOr.liftThrowable(JSON.parse)

/**
 * Their frame, or nothing.
 *
 * A frame this cannot read is not worth an exception: the socket is an
 * optimisation over reading the page again, and the page still reads.
 */
const read = (data: unknown): Said | undefined =>
  typeof data === "string" ? (parsed(data) as Said | undefined) : undefined

/**
 * The socket GitHub's own page is using, named in its markup.
 *
 * Signed per session and put there by them, which is why this is read rather
 * than built: there is nothing here that could construct one.
 */
export const socketUrl = (page: Document): string | undefined =>
  page.querySelector<HTMLLinkElement>('link[rel="shared-web-socket"]')?.href
