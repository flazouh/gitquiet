/**
 * The two functions of Sentry's this extension uses, and nothing else.
 *
 * Imported for its side effect on the bundle rather than for tidiness: a
 * dynamic `import("@sentry/browser")` hands back the whole namespace, so
 * nothing can be dropped and replay, feedback and canvas ride along — four
 * hundred kilobytes of code for a `captureException`. Naming the two exports
 * here lets the bundler prune the rest, and `sentry.ts` imports this file
 * dynamically instead.
 */
export { captureException, init } from "@sentry/browser"
