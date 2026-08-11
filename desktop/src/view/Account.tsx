import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from "../components/ui/dropdown-menu"
import { useSettings } from "../../../src/ui/useSettings"
import type { Viewer } from "../shared/wire"
import { openOutside } from "./outside"
import { ask } from "./rpc"
import { type Scheme } from "./scheme"

/**
 * Who is signed in, in the corner, with what can be done about it.
 *
 * A face rather than a name, because the name was a word in a strip of other words
 * and read as a label rather than as a person; and a face is the same thing GitHub
 * put in that corner, so a reader arriving from their page does not have to be told
 * where their account went.
 *
 * The face opens a menu instead of doing something, because there is now more than
 * one thing to do here and a corner cannot hold them all: signing out was the only
 * one, and stood beside the name as a button that a slipped press could hit.
 */

/** The three positions, in the order a reader expects to find them. */
const SCHEMES: ReadonlyArray<{ readonly scheme: Scheme; readonly word: string }> = [
  { scheme: "system", word: "Match desktop" },
  { scheme: "light", word: "Light" },
  { scheme: "dark", word: "Dark" }
]

export const Account = ({
  viewer,
  onSettings,
  onSignedOut
}: {
  readonly viewer: Viewer
  readonly onSettings: () => void
  readonly onSignedOut: () => void
}) => {
  // Their own photograph, and their initial while it arrives or if it never does:
  // a broken image in the corner of every window is worse than a letter.
  const [drawn, setDrawn] = useState(true)
  // Same appearance knob as Settings → Appearance; the menu is the fast path.
  const { settings, change } = useSettings()
  const scheme = settings.theme.appearance
  const choose = (next: Scheme) =>
    change({ ...settings, theme: { ...settings.theme, appearance: next } })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-surface-4 text-[10px] font-medium text-muted-foreground outline-none ring-offset-1 ring-offset-surface-1 transition-[box-shadow,opacity] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:ring-2 data-[state=open]:ring-ring"
        aria-label={`Signed in as ${viewer.login}`}
      >
        {drawn ? (
          <img
            src={viewer.avatar}
            alt=""
            width={24}
            height={24}
            className="size-full object-cover"
            onError={() => setDrawn(false)}
          />
        ) : (
          viewer.login.slice(0, 1).toUpperCase()
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6} className="min-w-52">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-xs font-medium">{viewer.name ?? viewer.login}</span>
          <span className="text-xs font-normal text-muted-foreground">{viewer.login}</span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/*
          Settings first, because it is the only item here that changes this app.
          They used to be reachable from one small button on the pull request card
          and nowhere else, which meant the Working Set — the screen this app opens
          on — had no way into them at all. A corner that already holds who you are
          is where anybody looks for what you have chosen.
        */}
        {/*
          Which palette, beside the rest of what this app has been told rather
          than inside the sheet below it. The sheet is about how a diff is drawn
          and is asked for over the wire; this is one word about the window in
          front of you, and a reader comparing light against dark wants to press
          twice without a dialog opening and closing between the presses.
        */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Appearance</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup
              value={scheme}
              onValueChange={(next) => choose(next as Scheme)}
            >
              {SCHEMES.map((one) => (
                <DropdownMenuRadioItem key={one.scheme} value={one.scheme}>
                  {one.word}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuItem onSelect={onSettings}>Settings</DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Nothing about the window in here. Its size is the strip's business —
            double-click it — and a menu that offers what a gesture already does is
            a menu the reader has to read before they can find the thing that is
            only here. */}
        <DropdownMenuItem onSelect={() => openOutside(`https://github.com/${viewer.login}`)}>
          Your GitHub profile
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Last, and apart: the only item here that takes something away. */}
        <DropdownMenuItem
          variant="destructive"
          onSelect={() => {
            void ask("signOut", undefined).then(onSignedOut)
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
