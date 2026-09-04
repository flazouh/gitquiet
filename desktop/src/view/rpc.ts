import { Electroview } from "electrobun/view"
import type { Wire } from "../shared/wire"

/**
 * The one way this side asks the other side anything.
 *
 * Electrobun wants the view's RPC built before the interface is drawn, and a
 * second `Electroview` would be a second socket answering half the replies. So
 * it is made here, once, and every component asks through {@link ask}.
 *
 * No handlers: nothing in the main process needs to call into the interface. It
 * holds the token and answers questions, and a screen that has just asked for
 * something is the screen that wants to know the answer.
 */
/**
 * Thirty seconds, because the default is one.
 *
 * Electrobun bounds every request at 1000ms unless told otherwise, which is a
 * sensible bound for a bridge between two halves of one app and a hopeless one
 * for a bridge whose far side is talking to GitHub. Reading the whole Working
 * Set is four searches against their GraphQL API and takes about six seconds on
 * a good connection; every one of those reads was rejected at one second, and
 * the interface — which cannot tell a timed-out bridge from a refusal — drew the
 * screen it draws when GitHub says no. A working read looked like being signed
 * out, which is the kind of fault that costs an evening.
 *
 * The bound is kept rather than removed: a promise nobody will ever settle is
 * worse than a slow one, because the loading bones spin forever and no error is
 * ever drawn. Thirty seconds is longer than any read here should take and short
 * enough that a reader learns something went wrong.
 */
const PATIENCE = 30_000

/**
 * The requests that wait on a person rather than on GitHub.
 *
 * Both sign-ins are one request held open while somebody opens a browser, reads
 * a code, types it, and gets past two-factor. Thirty seconds is nothing like
 * enough, and the deadline is Electrobun's: it starts a timer in the function
 * that *sends* a request, so each side bounds what it asks of the other. The
 * fifteen minutes set in `bun/index.ts` bounds the main process asking the
 * window, which is the opposite direction and does not help here.
 *
 * Fifteen minutes because GitHub's device code expires in fifteen, and the
 * browser door gives up after ten on its own.
 */
const WAITS_ON_A_PERSON: ReadonlyArray<string> = ["signInThroughBrowser", "finishSignIn"]
const LONG_PATIENCE = 15 * 60 * 1000

/*
 * The bridge is given the longest of them, and each request is held to its own
 * below. Bounded per request rather than once for all of them, because a bridge
 * that waits fifteen minutes on a list of pull requests is a window that spins
 * forever when something has gone wrong, and a bridge that waits thirty seconds
 * on a person is the sign-in this app already shipped broken.
 */
const view = new Electroview({
  rpc: Electroview.defineRPC<Wire>({ maxRequestTime: LONG_PATIENCE, handlers: {} })
})

type Requests = Wire["bun"]["requests"]

/**
 * Asks the main process for one thing, and waits.
 *
 * Typed off the wire so a name that is not a request, or params of the wrong
 * shape, is a compile error here rather than a promise that never settles.
 *
 * Rejects when the answer does not arrive in time. Every caller has to say what
 * it puts on screen then: a promise that neither settles nor rejects is a
 * spinner that spins for the rest of the run.
 */
export const ask = <K extends keyof Requests>(
  what: K,
  params: Requests[K]["params"]
): Promise<Requests[K]["response"]> => {
  // The cast is at the one place the untyped bridge is crossed. Electrobun's
  // request proxy is indexed by string, so the wire's own types are reasserted
  // here rather than being lost into every caller.
  const send = (
    view.rpc as unknown as { request: Record<string, ((p: unknown) => Promise<unknown>) | undefined> }
  ).request[what as string]
  if (typeof send !== "function") {
    return Promise.reject(new Error(`GitQuiet's window has no way to ask for ${String(what)}.`))
  }

  const asked = send(params) as Promise<Requests[K]["response"]>

  const patience = WAITS_ON_A_PERSON.includes(what as string) ? LONG_PATIENCE : PATIENCE
  if (patience === LONG_PATIENCE) return asked

  return new Promise<Requests[K]["response"]>((resolve, reject) => {
    const late = setTimeout(
      () => reject(new Error(`GitQuiet's window waited ${patience / 1000}s for ${String(what)}.`)),
      patience
    )
    asked.then(resolve, reject).finally(() => clearTimeout(late))
  })
}
