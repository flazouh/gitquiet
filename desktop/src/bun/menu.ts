import type { ApplicationMenuItemConfig } from "electrobun/bun"

/**
 * The menu bar, which is where a mac keeps half of what a window can do.
 *
 * A window with no menu is a window that does not quit on Command+Q, does not
 * close on Command+W, and — the one that surprises people — cannot be copied out
 * of, because in a webview the editing keys are the menu's key equivalents being
 * sent down the responder chain rather than anything the page listens for. So
 * this is not decoration for the top of the screen. It is the keyboard.
 *
 * Roles rather than actions, everywhere one exists. A role is handed to macOS,
 * which sends the standard selector to whatever has the keyboard, so Command+C
 * copies the selection the reader made — in the diff, in a comment box, in a
 * title — without this process knowing anything about what is selected.
 */

/** Electrobun's own shape, so what is written here is what it will take. */
export type Item = ApplicationMenuItemConfig

/**
 * An item worth asking a question of, which is any of them but a rule.
 *
 * The shape rather than the union: a divider has no label, no role and no key, so
 * every question this file's tests ask would have to narrow past it first.
 */
export type Chosen = {
  readonly label?: string
  readonly role?: string
  readonly accelerator?: string
  readonly submenu?: ReadonlyArray<Item>
}

/**
 * The modifiers the native wrapper will read, lowercased as it lowercases them.
 *
 * Kept as data because it is the one thing here that fails silently. Electron
 * spells two of these `Cmd` and `Alt`; this layer does not know either word, and
 * an accelerator it cannot parse is dropped — the item is drawn with no key
 * beside it, which looks like a menu that was written carelessly rather than one
 * that was written wrongly.
 */
export const MODIFIERS: ReadonlyArray<string> = [
  "command",
  "commandorcontrol",
  "control",
  "ctrl",
  "meta",
  "option",
  "shift",
  "super"
]

const divider = { type: "divider" } as const

/**
 * The four menus, in the order every mac application puts them.
 *
 * Named after the application rather than after the product, because the first
 * menu on a mac is the application and macOS draws its name there whatever this
 * says.
 *
 * No zoom entry, deliberately. The webview already answers Command with `=`, `-`
 * and `0` through `pageZoomFromPress`, and a key equivalent on a menu item is
 * answered by the menu first and then by the page: one press, two steps up the
 * ladder. What is under View instead is full screen, which nothing else claims.
 */
export const macMenu = (name: string): Array<Item> => [
  {
    label: name,
    submenu: [
      { role: "about", label: `About ${name}` },
      divider,
      { role: "hide", accelerator: "Command+H" },
      { role: "hideOthers", accelerator: "Command+Option+H" },
      { role: "showAll" },
      divider,
      { role: "quit", accelerator: "Command+Q" }
    ]
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo", accelerator: "Command+Z" },
      { role: "redo", accelerator: "Command+Shift+Z" },
      divider,
      { role: "cut", accelerator: "Command+X" },
      { role: "copy", accelerator: "Command+C" },
      { role: "paste", accelerator: "Command+V" },
      { role: "selectAll", accelerator: "Command+A" }
    ]
  },
  {
    label: "View",
    submenu: [{ role: "toggleFullScreen", accelerator: "Control+Command+F" }]
  },
  {
    label: "Window",
    submenu: [
      { role: "minimize", accelerator: "Command+M" },
      { role: "zoom" },
      divider,
      { role: "close", accelerator: "Command+W" }
    ]
  }
]

/** A rule between items, which is the one shape here with nothing to say. */
const isRule = (item: Item): item is Extract<Item, { type: "divider" | "separator" }> =>
  "type" in item && (item.type === "divider" || item.type === "separator")

/** Every item in the tree but the rules, flattened, for the questions asked of all of them. */
export const everyItemIn = (menu: ReadonlyArray<Item>): ReadonlyArray<Chosen> =>
  menu.flatMap((item) => (isRule(item) ? [] : [item, ...everyItemIn(item.submenu ?? [])]))
