import { describe, expect, test } from "bun:test"
import { listen, type Socket } from "./alive"

/** A socket that does nothing until a test makes it do something. */
const aSocket = () => {
  const sent: Array<string> = []
  const reactions = new Map<string, (event: { readonly data?: unknown }) => void>()
  let closed = 0

  return {
    sent,
    get closed() {
      return closed
    },
    addEventListener: (kind: string, react: (event: { readonly data?: unknown }) => void) =>
      void reactions.set(kind, react),
    send: (frame: string) => void sent.push(frame),
    close: () => void (closed += 1),
    /** The server's side of it, for the test to play. */
    opens: () => reactions.get("open")?.({}),
    says: (frame: unknown) => reactions.get("message")?.({ data: JSON.stringify(frame) }),
    garbles: () => reactions.get("message")?.({ data: "not json at all" }),
    drops: () => reactions.get("close")?.({})
  } satisfies Socket & Record<string, unknown>
}

const CHANNEL = "eyJjIjoicHVsbF9yZXF1ZXN0OjE6bWVyZ2VfcXVldWUifQ==--abc"
const OTHER = "eyJjIjoicHVsbF9yZXF1ZXN0OjE6dGltZWxpbmUifQ==--def"

const sentBy = (socket: { readonly sent: ReadonlyArray<string> }) =>
  JSON.parse(socket.sent[0] ?? "{}")

describe("listening to the channels GitHub publishes", () => {
  test("asks for everything from now on, in the shape their server accepts", () => {
    const socket = aSocket()

    listen({ open: () => socket, channels: [CHANNEL, OTHER], onFire: () => {} })
    socket.opens()

    // Offsets are strings on this protocol. Sent as numbers their server
    // closes the connection with "failed to unmarshal JSON", which arrives
    // here as a socket that simply never says anything.
    expect(sentBy(socket)).toEqual({ subscribe: { [CHANNEL]: "-1", [OTHER]: "-1" } })
  })

  test("says which channel fired, so only what changed is read again", () => {
    const socket = aSocket()
    const fired: Array<string> = []

    listen({
      open: () => socket,
      channels: [CHANNEL],
      onFire: (channel) => void fired.push(channel)
    })
    socket.opens()
    socket.says({ e: "msg", ch: CHANNEL, off: "1-0", data: {} })

    expect(fired).toEqual([CHANNEL])
  })

  test("keeps quiet about an acknowledgement, and about anything it cannot read", () => {
    const socket = aSocket()
    const fired: Array<string> = []

    listen({
      open: () => socket,
      channels: [CHANNEL],
      onFire: (channel) => void fired.push(channel)
    })
    socket.opens()
    socket.says({ e: "ack", off: "1-0", health: true })
    socket.says({ e: "msg", ch: OTHER, off: "2-0", data: {} })
    socket.garbles()

    expect(fired).toEqual([])
  })

  test("asks again from where it left off when the socket comes back", async () => {
    let opened = 0
    const first = aSocket()
    const second = aSocket()
    const sockets = [first, second]

    listen({
      open: () => sockets[opened++] ?? first,
      channels: [CHANNEL],
      onFire: () => {},
      wait: () => 0
    })
    first.opens()
    first.says({ e: "msg", ch: CHANNEL, off: "7-0", data: {} })
    first.drops()
    await new Promise((waited) => setTimeout(waited, 0))
    second.opens()

    // From where it left off rather than from now: the queue moving while the
    // socket was down is the whole reason to reconnect at all.
    expect(sentBy(second)).toEqual({ subscribe: { [CHANNEL]: "7-0" } })
  })

  test("stops for good when it is told to, rather than reconnecting", async () => {
    const socket = aSocket()
    let opened = 0

    const stop = listen({
      open: () => {
        opened += 1
        return socket
      },
      channels: [CHANNEL],
      onFire: () => {},
      wait: () => 0
    })
    socket.opens()
    stop()
    socket.drops()
    await new Promise((waited) => setTimeout(waited, 0))

    expect(socket.closed).toBe(1)
    expect(opened).toBe(1)
  })
})
