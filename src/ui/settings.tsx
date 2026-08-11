import { createContext, useContext, useMemo, type ReactNode } from "react"
import { forgetful } from "../app/settings"
import type { Store } from "../ports/Settings"

/**
 * Where this screen keeps what the reader chose.
 *
 * The interface knows a settings store by its three calls and not by what is
 * behind them. Inside the extension that is Chrome's synced storage; on a
 * desktop build it would be a file, and on a website a row somewhere. The shell
 * says which, and nothing in here has to be told.
 *
 * Outside a provider the choices last as long as the page does, which is what a
 * screen in a test gets and what a browser with the storage permission taken
 * away gets. Both are the same thing from here, and neither is a reason to
 * refuse to draw.
 */
const Kept = createContext<Store | undefined>(undefined)

export const SettingsProvider = ({
  store,
  children
}: {
  readonly store: Store
  readonly children: ReactNode
}) => <Kept.Provider value={store}>{children}</Kept.Provider>

export const useSettingsStore = (): Store => {
  const provided = useContext(Kept)
  // Built once per screen rather than per render: a new store is a new read, a
  // new state, and a render loop.
  const held = useMemo(() => provided ?? forgetful(), [provided])
  return held
}
