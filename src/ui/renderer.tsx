import { Effect } from "effect"
import { createContext, useContext, type ReactNode } from "react"
import { DiffEngineUnavailable, type DiffEngine } from "../ports/Renderer"

/** Gets hold of a renderer, however this platform gets hold of one. */
export type LoadEngine = Effect.Effect<DiffEngine, DiffEngineUnavailable>

/**
 * No renderer, which is what a pane falls back to when nothing was provided.
 *
 * A failure rather than a stub that draws nothing: the pane already has to
 * handle a renderer it could not fetch, and says so in words a reader can act
 * on. Having the same thing happen outside a provider means the case is
 * exercised by every screen rendered without one, rather than only by the
 * unlucky visit where a browser refuses the chunk.
 */
const NOTHING: LoadEngine = Effect.fail(
  new DiffEngineUnavailable({ cause: "no renderer was provided to this screen" })
)

const Renderer = createContext<LoadEngine>(NOTHING)

/**
 * Says how this screen gets a diff renderer.
 *
 * The interface knows a renderer by its contract and not by where it comes
 * from. Inside the extension that is a four-and-a-half-megabyte chunk behind an
 * extension URL, fetched on the first file anybody opens; on a desktop build it
 * would be an import at the top of a file. Both are the shell's business, and
 * this is where the shell says which.
 */
export const RendererProvider = ({
  load,
  children
}: {
  readonly load: LoadEngine
  readonly children: ReactNode
}) => <Renderer.Provider value={load}>{children}</Renderer.Provider>

export const useRenderer = (): LoadEngine => useContext(Renderer)
