export const HIGHLIGHT_REQUEST = "gitquiet:highlight-request"
export const HIGHLIGHT_ANSWER = "gitquiet:highlight-answer"

export type HighlightRequest = {
  readonly kind: typeof HIGHLIGHT_REQUEST
  readonly code: string
  readonly language: string
  readonly theme: string
}

export type HighlightAnswer = {
  readonly kind: typeof HIGHLIGHT_ANSWER
  readonly html: string | null
}

export const isHighlightRequest = (message: unknown): message is HighlightRequest =>
  typeof message === "object" &&
  message !== null &&
  "kind" in message &&
  message.kind === HIGHLIGHT_REQUEST &&
  "code" in message &&
  typeof message.code === "string" &&
  "language" in message &&
  typeof message.language === "string" &&
  "theme" in message &&
  typeof message.theme === "string"

export const isHighlightAnswer = (message: unknown): message is HighlightAnswer =>
  typeof message === "object" &&
  message !== null &&
  "kind" in message &&
  message.kind === HIGHLIGHT_ANSWER &&
  "html" in message &&
  (typeof message.html === "string" || message.html === null)
