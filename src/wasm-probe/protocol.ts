/**
 * What the probe's three parties say to each other, in one file so that none of
 * them has to guess. Modelled on `src/markdown/mermaidProtocol.ts`, which does
 * the same job for the diagram renderer.
 */

import type { Attempt } from "./attempt"

export const WASM_PROBE = "gitquiet/wasm-probe" as const
export const WASM_PROBE_WORK = "gitquiet/wasm-probe-work" as const
export const WASM_PROBE_ANSWER = "gitquiet/wasm-probe-answer" as const

/** Asked from a page; heard by the worker, which opens the offscreen document. */
export type WasmProbe = { readonly kind: typeof WASM_PROBE }

/**
 * The same question on its second hop, and a different word for it on purpose.
 *
 * `runtime.sendMessage` reaches every context of the extension, the sender
 * included. A worker that relayed the question under the word it heard would
 * hear its own relay, open the document again, relay again — which is what this
 * did, and what it reported was a TypeError from inside the polyfill rather than
 * anything about a loop. `mermaidProtocol.ts` has two words for the same reason.
 */
export type WasmProbeWork = { readonly kind: typeof WASM_PROBE_WORK }

export type WasmProbeAnswer = {
  readonly kind: typeof WASM_PROBE_ANSWER
  /** One per context reached. Absent contexts are absent, not empty. */
  readonly attempts: ReadonlyArray<Attempt>
  /** Why a context could not be reached at all, where that happened. */
  readonly notes: ReadonlyArray<string>
}

export const isWasmProbe = (message: unknown): message is WasmProbe =>
  typeof message === "object" &&
  message !== null &&
  (message as { kind?: unknown }).kind === WASM_PROBE

export const isWasmProbeWork = (message: unknown): message is WasmProbeWork =>
  typeof message === "object" &&
  message !== null &&
  (message as { kind?: unknown }).kind === WASM_PROBE_WORK
