# Spec: Themes

Status: agreed

## Problem

The extension paints with GitHub Primer tokens so it blends into github.com. The
desktop app paints with its own Fluid Functionalism surface ladder and Inter.
Shared screens in `src/ui` therefore look like two products. We want one look by
default, and a way for the reader to pick other looks without leaving either shell.

## Decision

Both shells use the same theme model: **Appearance × Pack × Art**.

| Axis | Values | Default |
| --- | --- | --- |
| Appearance | `system` \| `light` \| `dark` | `system` |
| Pack | `match`, `gitquiet`, `github`, `cursor`, and other editor/terminal packs — see `THEME_KNOBS` | `match` |
| Art | `match` \| `github` \| `gitquiet` | `match` |

- **System** means the OS preference (`prefers-color-scheme`), in both shells.
- **Match** means the place rather than the reader. On GitHub's page it resolves to
  the `github` pack and to Octicons; in the desktop window it resolves to the
  `gitquiet` pack and to Hugeicons. `packOf` and `setOf` do the resolving, and each
  shell hands its own answer down as `here` — `Theme here="github"` and
  `ArtProvider here={OCTICONS}` in the extension, ours in the window.
- **Gitquiet** is the desktop app's own look, and the window's answer to `match`.
- **GitHub** is a static Primer-like light/dark pack, not live page variables.
- **Art** is which set every glyph is drawn from, whole rather than per glyph: a
  screen drawn half in one set and half in another shows the seam.
- **Font** is Inter in every pack and both shells.
- Settings stores stay **independent** per shell; same defaults, no sync in v1.

`match` is why a reader who never opens the settings sees an extension that looks
like GitHub and a window that looks like Gitquiet, from one settings object with
one set of defaults.

GitHub's own chrome (site header, repo nav, PR title and tabs) is unchanged. Only
the interface inside our root is themed.

## Out of scope (v1)

- Syncing theme choice between desktop and extension
- Live Primer / following GitHub high-contrast or colourblind packs
- Pack-specific fonts
- Custom user-authored packs

## Settings shape

Two knobs under a new `theme` group on `Settings`, beside `page`, `diff`, and
`tree`. Same knob machinery as the rest of `src/domain/Settings.ts`: words as
values, fallbacks for unknown stored data, menu built from the declarations.

```ts
settings.theme.appearance // "system" | "light" | "dark"
settings.theme.pack       // "gitquiet" | "anthropic" | "cursor" | "github" | … (see THEME_KNOBS)
```

Shown in Settings as an **Appearance** section: Appearance row, Theme (pack) row.

## Runtime contract

1. Components keep spelling colours as shared utilities (`bg-canvas`, `text-ink`,
   `border-line`, …). They do not name packs.
2. A theme engine maps `(appearance, pack)` onto the CSS variables those utilities
   read (`--color-canvas`, `--color-ink`, …).
3. Resolved appearance is `light` or `dark`. When Appearance is `system`, resolve
   from `prefers-color-scheme` and update when the OS preference changes.
4. Extension entry stops treating Primer page variables as the source of truth for
   our UI tokens. `primer.css` either becomes a pack definition or is replaced by
   the shared theme packs; GitHub page vars may remain only where non-UI code still
   needs them.
5. Desktop `style.css` keeps owning the window chrome it already owns; the shared
   screens' colour vocabulary is answered by the same pack tables the extension uses.
6. Inter is loaded in the extension the same way the desktop already loads it (or
   an equivalent ship of the variable font), scoped so it does not restyle GitHub's
   chrome outside our root.

## Acceptance

1. Fresh install (both shells): pack Gitquiet, appearance System; UI matches today's
   desktop look under the OS scheme.
2. Changing Appearance or Pack in Settings updates the UI without reload.
3. Each shipped pack has a distinct light and dark surface/ink pair.
4. Unknown or missing stored theme values fall back to the defaults above.
5. Desktop and extension theme choices do not overwrite each other.
6. Diff syntax theme (`diff.syntax`) stays a separate knob; this spec does not
   change it.

## Related

- Current Primer bridge: `src/ui/primer.css`
- Desktop tokens: `desktop/src/view/style.css`
- Settings knobs: `src/domain/Settings.ts`
- Prior delivery decision (Primer-on-page): `docs/spec/pull-request-review.md`
  (superseded for UI colour/type only; delivery and data decisions stand)
