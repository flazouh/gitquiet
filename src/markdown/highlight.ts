import { Effect } from "effect"
import { createHighlighterCore, type HighlighterCore } from "shiki/core"
import { createJavaScriptRegexEngine } from "shiki/engine/javascript"

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

export const highlight = (
  code: string,
  language: string,
  theme: "light" | "dark"
): Effect.Effect<string | null> => {
  const lang = ALIASES[language] ?? language
  if (!LANGS.has(lang)) return Effect.succeed(null)

  return highlighter().pipe(
    Effect.map((core) =>
      core.codeToHtml(code, {
        lang,
        theme: theme === "dark" ? "github-dark-default" : "github-light-default",
        structure: "inline"
      })
    ),
    Effect.orElseSucceed(() => null)
  )
}
