import type { Wall } from "../../src/github/signOn"
import { SignOn } from "../../src/ui/SignOn"
import { STORE, type View } from "../view"

const WALL: Wall = {
  organisation: "OpenRouterIncubator",
  action: "https://github.com/orgs/OpenRouterIncubator/saml/initiate",
  fields: [
    ["authenticity_token", "fixture-token"],
    ["add_account", ""]
  ],
  backTo: "https://github.com/OpenRouterIncubator/ori/pull/2198"
}

export const SIGN_ON_VIEW: View = {
  name: "sign-on",
  caption:
    "An organisation sign-on wall that keeps the requested page visible and leaves the identity check to its provider",
  ...STORE,
  draw: () => (
    <SignOn
      wall={WALL}
      chosen="ask"
      onChoose={() => {}}
      cameRound={false}
      onContinue={() => {}}
      onStepAside={() => {}}
    />
  )
}
