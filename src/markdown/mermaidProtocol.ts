export const MERMAID_REQUEST = "gitquiet:mermaid:request"
export const MERMAID_WORK = "gitquiet:mermaid:work"
export const MERMAID_ANSWER = "gitquiet:mermaid:answer"
export const MERMAID_UNAVAILABLE = "gitquiet:mermaid:unavailable"

export type MermaidRequest = {
  readonly kind: typeof MERMAID_REQUEST
  readonly code: string
}

export type MermaidWork = {
  readonly kind: typeof MERMAID_WORK
  readonly code: string
}

export type MermaidAnswer = {
  readonly kind: typeof MERMAID_ANSWER
  readonly svg: string | null
}

export type MermaidUnavailable = {
  readonly kind: typeof MERMAID_UNAVAILABLE
}

export const isMermaidRequest = (value: unknown): value is MermaidRequest =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === MERMAID_REQUEST &&
  "code" in value &&
  typeof value.code === "string"

export const isMermaidWork = (value: unknown): value is MermaidWork =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === MERMAID_WORK &&
  "code" in value &&
  typeof value.code === "string"

export const isMermaidAnswer = (value: unknown): value is MermaidAnswer =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === MERMAID_ANSWER &&
  "svg" in value &&
  (typeof value.svg === "string" || value.svg === null)

