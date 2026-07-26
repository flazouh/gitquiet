# Local patches to installed components

Everything in this directory is installed from the
[Fluid Functionalism](https://www.fluidfunctionalism.com) registry and is meant
to be re-installable:

```sh
bunx --bun shadcn@latest add https://www.fluidfunctionalism.com/r/<name>.json --overwrite
```

Re-installing discards the patches below, so they are listed here to be
re-applied. Each is marked in the source with `Local patch (see PATCHES.md)`.
Prefer fixing a problem in the bridge (`src/ui/bridge.css`) or in a wrapper of
our own over editing a component, so this list stays short.

## dropdown.tsx — guard the arrow-key focus move

`items[next].focus()` becomes `items[next]?.focus()`. The index is always in
range because it is computed modulo the item count, but `noUncheckedIndexedAccess`
cannot see that, and the neighbouring `Home` / `End` branches are already
written with `?.`.
