import { Tick01Icon } from "@hugeicons/core-free-icons"
import * as Menu from "@radix-ui/react-dropdown-menu"
import { COURTS, type Court } from "../domain/Attention"
import { courtName } from "./copy"
import { Icon, courtArt } from "./Icon"

export type CourtMenuProps = {
  /** Says which item this menu corrects, since the trigger itself is terse. */
  readonly label: string
  readonly value: Court
  readonly onChange: (court: Court) => void
}

/**
 * Corrects one item's Court. A menu rather than three buttons per row: the
 * correction is rare, and thirty rows of segmented controls would drown the
 * items they belong to. The floating panel earns a shadow because it genuinely
 * sits above the page; it still has no border.
 */
export const CourtMenu = ({ label, value, onChange }: CourtMenuProps) => (
  <Menu.Root>
    {/* The trigger carries no visible Court name: every item in a row already
        shares that row's Court, so printing it on each line is noise. The
        accessible name still says which item and which Court. */}
    <Menu.Trigger
      aria-label={label}
      className="flex size-6 shrink-0 items-center justify-center rounded-sm text-ink-dim opacity-40 transition-[color,background-color,opacity] duration-instant ease-out focus-visible:opacity-100 group-hover/item:opacity-100 hover:bg-panel-active hover:text-ink data-[state=open]:bg-panel-active data-[state=open]:text-ink data-[state=open]:opacity-100"
    >
      <Icon of={courtArt[value]} size="sm" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content
        align="end"
        sideOffset={4}
        className="min-w-44 rounded-lg bg-panel p-1 shadow-pop"
      >
        <Menu.RadioGroup
          value={value}
          onValueChange={(next) => {
            const court = COURTS.find((candidate) => candidate === next)
            if (court !== undefined) onChange(court)
          }}
        >
          {COURTS.map((court) => (
            <Menu.RadioItem
              key={court}
              value={court}
              className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1 text-sm text-ink-muted outline-none data-[highlighted]:bg-panel-hover data-[highlighted]:text-ink data-[state=checked]:text-ink"
            >
              <Icon of={courtArt[court]} size="sm" className="text-ink-dim" />
              <span className="flex-1">{courtName(court)}</span>
              <Menu.ItemIndicator>
                <Icon of={Tick01Icon} size="sm" className="text-accent-ink" />
              </Menu.ItemIndicator>
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>
)
