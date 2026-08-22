import * as Menu from "@radix-ui/react-dropdown-menu"
import * as Bubble from "@radix-ui/react-tooltip"
import { useId, useState, type ReactNode } from "react"
import { useArt } from "./art"
import { DIFF_KNOBS, THEME_KNOBS, TREE_KNOBS, type Knob, type Settings } from "../domain/Settings"
import { ROOT_ID } from "./mount"
import { sampleOf } from "./SettingsPreview"

/**
 * Where everything this menu opens is drawn.
 *
 * Inside our own root, because the theme is a set of inline custom properties on
 * that element and not on `<html>`: the rest of the document is GitHub's page,
 * and our names on their root would repaint their chrome. A panel portaled to
 * `document.body` instead reads the stylesheet's defaults, which are the light
 * pack — a white menu with near-black text over a dark page. See `outside.ts`,
 * written after the bar was paid for that once.
 *
 * Asked for on every render rather than held: the root is made by the mount and
 * remade whenever the page is taken over again, so a reference kept here would
 * be a reference to an element no longer in the document.
 */
const inOurs = (): HTMLElement | null =>
  typeof document === "undefined" ? null : document.getElementById(ROOT_ID)

export type SettingsMenuProps = {
  readonly settings: Settings
  readonly onChange: (settings: Settings) => void
  /**
   * What this button is called, where it stands beside another way into the same
   * knobs.
   *
   * A screen with a files band carries two: the sheet in the bar, which is where
   * the knobs are read about, and this menu above the diff. Two buttons on one
   * screen answering to the same name is two identical buttons to anybody
   * listening to the page rather than looking at it.
   */
  readonly label?: string
}

const ITEM =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs text-ink outline-none data-[highlighted]:bg-hover"

/**
 * What a setting does and what each choice looks like.
 *
 * Every one of these knobs is a trade — width against context, calm against
 * scannability — and a two-word label can only name the trade, never say which
 * side you are choosing. So: the whole explanation, then a small mockup of each
 * choice, because "bars" and "plus and minus" are pictures long before they are
 * words. The bubble opens to the left, since the choices open to the right.
 */
const Explains = ({
  knob,
  chosen,
  open,
  onOpenChange
}: {
  readonly knob: Knob<string, string>
  readonly chosen: string | undefined
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}) => {
  const art = useArt()
  const Info = art.info

  return (
  <Bubble.Root open={open} onOpenChange={onOpenChange} delayDuration={0}>
    <Bubble.Trigger asChild>
      <span
        // The menu row is a button in all but name: a pointer landing here must
        // not count as landing on the row and choosing something.
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className="flex shrink-0 items-center text-ink-muted opacity-60 hover:opacity-100"
      >
        <Info size={12} />
      </span>
    </Bubble.Trigger>
    <Bubble.Portal container={inOurs()}>
      <Bubble.Content
        side="left"
        align="start"
        sideOffset={10}
        collisionPadding={8}
        className="z-50 flex max-w-80 flex-col gap-2 rounded-md border border-line bg-raised px-2.5 py-2 text-xs leading-relaxed text-ink-muted shadow-pop"
      >
        <p>{knob.note}</p>
        {knob.choices.map((choice) => {
          const sample = sampleOf(knob.key, choice.value)
          return sample === null ? null : (
            <div key={choice.value} className="flex flex-col gap-1">
              <span
                className={choice.value === chosen ? "text-ink" : undefined}
              >{`${choice.label}${choice.value === chosen ? " · in use" : ""}`}</span>
              {sample}
            </div>
          )
        })}
      </Bubble.Content>
    </Bubble.Portal>
  </Bubble.Root>
  )
}

/**
 * One knob: its name, what it is set to, and both ways of finding out more.
 *
 * The submenu is held open by this component rather than by Radix so that the
 * bubble can shut it. Hovering the row opens the choices and hovering the
 * information icon opens the explanation, and since the icon sits inside the
 * row, both would otherwise be open at once with the explanation underneath.
 */
const Row = ({
  knob,
  chosen,
  onPick
}: {
  readonly knob: Knob<string, string>
  readonly chosen: string | undefined
  readonly onPick: (key: string, value: string) => void
}) => {
  const [wanted, setWanted] = useState(false)
  const [explaining, setExplaining] = useState(false)

  return (
    <Menu.Sub open={wanted && !explaining} onOpenChange={setWanted}>
      {/* Opened on the first pointer that touches the row, rather than on
          Radix's hundred-millisecond hesitation: this is a settled menu of
          knobs, not a navigation bar where a passing cursor should be ignored,
          and the hesitation reads as the menu being slow. */}
      <Menu.SubTrigger className={ITEM} onPointerMove={() => setWanted(true)}>
        <span className="flex-1">{knob.label}</span>
        <span className="text-ink-muted">
          {knob.choices.find((choice) => choice.value === chosen)?.label}
        </span>
        <Explains knob={knob} chosen={chosen} open={explaining} onOpenChange={setExplaining} />
      </Menu.SubTrigger>
      <Menu.Portal container={inOurs()}>
        <Menu.SubContent
          sideOffset={4}
          className="t-dropdown z-50 min-w-40 rounded-md border border-line bg-raised p-1 shadow-pop"
        >
          <Menu.RadioGroup value={chosen} onValueChange={(value) => onPick(knob.key, value)}>
            {knob.choices.map((choice) => (
              <Menu.RadioItem key={choice.value} value={choice.value} className={ITEM}>
                {/* The tick has a column of its own: labels that shift right
                    when chosen are labels the eye has to find again. */}
                <span className="w-3 text-ink-muted">
                  <Menu.ItemIndicator>✓</Menu.ItemIndicator>
                </span>
                {choice.label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.SubContent>
      </Menu.Portal>
    </Menu.Sub>
  )
}

const Group = ({
  knobs,
  chosen,
  onPick
}: {
  readonly knobs: ReadonlyArray<Knob<string, string>>
  readonly chosen: Record<string, string>
  readonly onPick: (key: string, value: string) => void
}) => (
  <>
    {knobs.map((knob) => (
      <Row key={knob.key} knob={knob} chosen={chosen[knob.key]} onPick={onPick} />
    ))}
  </>
)

/**
 * One named run of knobs.
 *
 * A group rather than a heading followed by loose rows, and named by that
 * heading, because two of these sections hold a knob whose label is the section
 * name — Appearance holds Appearance — and a bare heading leaves nothing to tell
 * the two apart. Anybody reading the menu by its structure, a screen reader or a
 * test, is told which run a row is in.
 */
const Section = ({
  name,
  children
}: {
  readonly name: string
  readonly children: ReactNode
}) => {
  const named = useId()

  return (
    <Menu.Group aria-labelledby={named}>
      <Menu.Label
        id={named}
        className="px-2 pt-1.5 pb-1 text-[11px] font-semibold text-ink-muted"
      >
        {name}
      </Menu.Label>
      {children}
    </Menu.Group>
  )
}

/**
 * Everything the screens can be told to do, behind one button.
 *
 * Built from the schema rather than written out: a knob added there appears
 * here, in the right section, with its choices and its current value, and there
 * is no second list to forget to update. Each knob is a submenu because the
 * alternative — every choice of every knob in one column — is forty rows deep
 * and unreadable, and because a submenu shows what is currently chosen on the
 * row itself, which is the thing being looked for most of the time.
 *
 * The same three sections the sheet in the bar opens on, in the same order, so
 * whichever one a reader learned first tells them where to look in the other.
 */
export const SettingsMenu = ({
  settings,
  onChange,
  label = "Display settings"
}: SettingsMenuProps) => {
  const art = useArt()
  const More = art.more
  const [open, setOpen] = useState(false)
  const pickTheme = (key: string, value: string) =>
    onChange({ ...settings, theme: { ...settings.theme, [key]: value } })
  const pickDiff = (key: string, value: string) =>
    onChange({ ...settings, diff: { ...settings.diff, [key]: value } })
  const pickTree = (key: string, value: string) =>
    onChange({ ...settings, tree: { ...settings.tree, [key]: value } })

  // No wait before an explanation appears and none before it goes: both are the
  // same pointer movement, and a delay on either turns reading two of these
  // into a wait.
  return (
    <Bubble.Provider delayDuration={0} skipDelayDuration={0} disableHoverableContent>
      <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
        <Menu.Trigger
          aria-label={label}
          className="flex shrink-0 items-center rounded-md px-1.5 py-1 text-ink-muted hover:bg-hover hover:text-ink"
        >
          <More size={16} />
        </Menu.Trigger>
        <Menu.Portal container={inOurs()} forceMount>
          <Menu.Content
            forceMount
            hidden={!open}
            align="end"
            sideOffset={4}
            className="t-dropdown z-50 min-w-56 rounded-md border border-line bg-raised p-1 text-xs shadow-pop"
          >
            {/* First, and whole: three knobs, none of them advanced, and the
                one section here that is about the product rather than about
                this screen. */}
            <Section name="Appearance">
              <Group knobs={THEME_KNOBS} chosen={settings.theme} onPick={pickTheme} />
            </Section>
            <Section name="Diff">
              <Group
                knobs={DIFF_KNOBS.filter((knob) => !knob.advanced)}
                chosen={settings.diff}
                onPick={pickDiff}
              />
            </Section>
            <Section name="Files">
              <Group
                knobs={TREE_KNOBS.filter((knob) => !knob.advanced)}
                chosen={settings.tree}
                onPick={pickTree}
              />
            </Section>
            <Menu.Separator className="my-1 h-px bg-line" />
            <Menu.Sub>
              <Menu.SubTrigger className={ITEM}>
                <span className="flex-1">Advanced</span>
                <span className="text-ink-muted">›</span>
              </Menu.SubTrigger>
              <Menu.Portal container={inOurs()}>
                <Menu.SubContent
                  sideOffset={4}
                  className="t-dropdown z-50 min-w-56 rounded-md border border-line bg-raised p-1 text-xs shadow-pop"
                >
                  <Section name="Diff">
                    <Group
                      knobs={DIFF_KNOBS.filter((knob) => knob.advanced)}
                      chosen={settings.diff}
                      onPick={pickDiff}
                    />
                  </Section>
                  <Section name="Files">
                    <Group
                      knobs={TREE_KNOBS.filter((knob) => knob.advanced)}
                      chosen={settings.tree}
                      onPick={pickTree}
                    />
                  </Section>
                </Menu.SubContent>
              </Menu.Portal>
            </Menu.Sub>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </Bubble.Provider>
  )
}
