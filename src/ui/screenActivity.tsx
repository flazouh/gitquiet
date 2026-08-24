import { createContext, type ReactNode, useContext } from "react"
import { usePreparedActive } from "./usePreparedActive"

type Activity = {
  readonly active: boolean
  readonly root?: Element
}

const ScreenActivity = createContext<Activity>({ active: true })

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
  return (
    <ScreenActivity.Provider value={{ active: active && connected, root }}>
      {children}
    </ScreenActivity.Provider>
  )
}

export const useScreenActivity = (): boolean => useContext(ScreenActivity).active

/** The container this React tree owns, including while it is prepared off-page. */
export const useScreenRoot = (): Element | undefined => useContext(ScreenActivity).root
