import { SettingsSheet } from "../../../src/ui/SettingsDialog"
import { useSettings } from "../../../src/ui/useSettings"

/**
 * The reader's choices, opened from the window rather than from a screen.
 *
 * The shared sheet comes with its own small button, which is right on a pull
 * request card — the knobs are about how a diff is drawn, and the card is where a
 * diff is — and wrong for this window, whose first screen is a list with no diff
 * on it and therefore no way in. So the window holds the sheet, the account menu
 * opens it, and both screens keep whatever they draw for themselves.
 *
 * The store is the window's one store, so a choice made here is the same choice
 * the card behind it is already listening for.
 */
export const Settings = ({ onClose }: { readonly onClose: () => void }) => {
  const { settings, change } = useSettings()

  return <SettingsSheet settings={settings} onChange={change} onClose={onClose} />
}
