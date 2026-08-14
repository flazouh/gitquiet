import { Effect } from "effect"
import { createHighlighterCore, type HighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"
import { LOADERS } from "../syntax/loaders"

const ALIASES: Readonly<Record<string, string>> = {
  sh: "shellscript",
  bash: "shellscript",
  console: "shellscript",
  shell: "shellscript",
  zsh: "shellscript",
  ts: "typescript",
  js: "javascript"
}

const LANGS = new Set(["shellscript", "typescript", "javascript", "json", "jsonc", "diff"])

let loaded: HighlighterCore | undefined

const highlighter = () => {
  if (loaded !== undefined) return Effect.succeed(loaded)

  return Effect.tryPromise({
    try: () =>
      createHighlighterCore({
        engine: createJavaScriptRegexEngine(),
        langs: [
          import("@shikijs/langs/shellscript"),
          import("@shikijs/langs/typescript"),
          import("@shikijs/langs/javascript"),
          import("@shikijs/langs/json"),
          import("@shikijs/langs/jsonc"),
          import("@shikijs/langs/diff")
        ],
        themes: [
          import("@shikijs/themes/github-light-default"),
          import("@shikijs/themes/github-dark-default")
        ]
      }),
    catch: () => "highlighter-failed" as const
  }).pipe(
    Effect.tap((core) =>
      Effect.sync(() => {
        loaded = core
      })
    )
  )
}

const themeOf = (mod: unknown): unknown => {
  if (mod !== null && typeof mod === "object" && "default" in mod) return (mod as { default: unknown }).default
  return mod
}

const loaderOf = (theme: string) =>
  Object.hasOwn(LOADERS, theme) ? LOADERS[theme as keyof typeof LOADERS] : undefined

const withTheme = (core: HighlighterCore, theme: string) => {
  if (core.getLoadedThemes().includes(theme)) return Effect.void
  const load = loaderOf(theme)
  if (load === undefined) return Effect.fail("highlighter-failed" as const)
  return Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: load,
      catch: () => "highlighter-failed" as const
    })
    yield* Effect.tryPromise({
      try: () => core.loadTheme(themeOf(mod) as never),
      catch: () => "highlighter-failed" as const
    })
  })
}

export const highlight = (
  code: string,
  language: string,
  theme: string
): Effect.Effect<string | null> => {
  const lang = ALIASES[language] ?? language
  if (!LANGS.has(lang)) return Effect.succeed(null)

  return highlighter().pipe(
    Effect.flatMap((core) =>
      withTheme(core, theme).pipe(
        Effect.map(() =>
          core.codeToHtml(code, {
            lang,
            theme,
            structure: "inline"
          })
        )
      )
    ),
    Effect.orElseSucceed(() => null)
  )
}
