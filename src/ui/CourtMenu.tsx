import { useState } from "react"
import { Button } from "../components/ui/button"
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger
} from "../components/ui/dropdown"
import { MenuItem } from "../components/ui/menu-item"
import { COURTS, type Court } from "../domain/Attention"
import { Icon, asIcon, courtArt } from "./Icon"
import { courtName } from "./copy"

export type CourtMenuProps = {
  /** Says which item this menu corrects, since the trigger itself is terse. */
  readonly label: string
  readonly value: Court
  readonly onChange: (court: Court) => void
}

/**
 * Corrects one item's Court. A menu rather than three buttons per row: the
 * correction is rare, and thirty rows of segmented controls would drown the
 * items they belong to.
 *
 * The trigger is quiet until the row is hovered or focused. A control the
 * Participant needs a few times a week should not be shouting on every line.
 */
export const CourtMenu = ({ label, value, onChange }: CourtMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownTrigger
        render={
          <Button
            aria-label={label}
            variant="ghost"
            size="icon-sm"
            active={open}
            className="opacity-40 transition-opacity duration-instant ease-out group-hover/item:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <Icon of={courtArt[value]} size="sm" />
          </Button>
        }
      />
      <DropdownContent align="end" checkedIndex={COURTS.indexOf(value)}>
        {COURTS.map((court, index) => (
          <MenuItem
            key={court}
            index={index}
            label={courtName(court)}
            icon={asIcon(courtArt[court])}
            checked={court === value}
            onSelect={() => onChange(court)}
          />
        ))}
      </DropdownContent>
    </DropdownMenu>
  )
}
