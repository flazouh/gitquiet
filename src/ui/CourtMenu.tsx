import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { CheckIcon } from "@primer/octicons-react"
import { COURTS, type Court } from "../domain/Attention"
import { courtArt } from "./Icon"
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
 * Dressed as one of GitHub's own overlays — their surface, their border, their
 * shadow, their button — so it does not announce itself as coming from
 * somewhere else.
 */
export const CourtMenu = ({ label, value, onChange }: CourtMenuProps) => {
  const Current = courtArt[value]

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={label}
        className="btn btn-sm btn-invisible flex! items-center px-1.5! text-[var(--fgColor-muted)] opacity-0 group-hover/item:opacity-100 group-focus-within/item:opacity-100 data-[state=open]:opacity-100"
      >
        <Current />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-30 min-w-44 rounded-md border border-line bg-raised py-1 shadow-pop"
        >
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(chosen) => onChange(chosen as Court)}
          >
            {COURTS.map((court) => {
              const Art = courtArt[court]
              return (
                <DropdownMenu.RadioItem
                  key={court}
                  value={court}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm outline-hidden select-none data-highlighted:bg-hover"
                >
                  <span className="flex w-4 justify-center text-ink-muted">
                    {court === value ? <CheckIcon /> : <Art />}
                  </span>
                  {courtName(court)}
                </DropdownMenu.RadioItem>
              )
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
