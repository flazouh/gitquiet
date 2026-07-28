import * as Sentry from "@sentry/browser"

export type Surface = "content-script" | "service-worker" | "prefetch"

const readEnvironmentValue = (key: string): string | undefined => {
  const environment: unknown = import.meta.env
  if (typeof environment !== "object" || environment === null) return undefined
  const value: unknown = Reflect.get(environment, key)
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/**
 * Without a DSN this is a no-op, so local development reports nothing and
 * builds carrying one report from every surface.
 */
export const initialiseErrorReporting = (surface: Surface): void => {
  const dsn = readEnvironmentValue("VITE_SENTRY_DSN")
  if (dsn === undefined) return

  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    initialScope: { tags: { surface } }
  })
}

export const reportError = (error: unknown): void => {
  Sentry.captureException(error)
}
