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

const view = new Electroview({
  rpc: Electroview.defineRPC<Wire>({ maxRequestTime: PATIENCE, handlers: {} })
})

type Requests = Wire["bun"]["requests"]

/**
 * Asks the main process for one thing, and waits.
 *
 * Typed off the wire so a name that is not a request, or params of the wrong
 * shape, is a compile error here rather than a promise that never settles.
 */
export const ask = <K extends keyof Requests>(
  what: K,
  params: Requests[K]["params"]
): Promise<Requests[K]["response"]> =>
  // The cast is at the one place the untyped bridge is crossed. Electrobun's
  // request proxy is indexed by string, so the wire's own types are reasserted
  // here rather than being lost into every caller.
  (view.rpc as unknown as { request: Record<string, (p: unknown) => Promise<unknown>> }).request[
    what as string
  ]!(params) as Promise<Requests[K]["response"]>
