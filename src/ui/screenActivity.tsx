import { createContext, type ReactNode, useContext } from "react"
import { usePreparedActive } from "./usePreparedActive"

const ScreenActivity = createContext(true)

/** Says whether a cached screen still owns document-wide controls. */
export const ScreenActivityProvider = ({
  active,
  root,
  children
}: {
  readonly active: boolean
  readonly root?: Element
  readonly children: ReactNode
}) => {
  const connected = usePreparedActive(root)
  return <ScreenActivity.Provider value={active && connected}>{children}</ScreenActivity.Provider>
}

export const useScreenActivity = (): boolean => useContext(ScreenActivity)
