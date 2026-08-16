import { COMMIT_VIEW } from "../../../shots/mock/commit"
import { PULL_REQUEST_VIEW } from "../../../shots/mock/pullRequest"
import { WORKING_SET_VIEW } from "../../../shots/mock/workingSet"
import type { View } from "../../../shots/view"
import { forgetful } from "../../../src/app/settings"
import { DEFAULTS } from "../../../src/domain/Settings"
import type { Shot } from "../../../src/ui/onboarding/beats"
import { Held } from "../../../src/ui/onboarding/Held"
import { SettingsProvider } from "../../../src/ui/settings"
import { Theme } from "../../../src/ui/Theme"
import { WithinProvider } from "../../../src/ui/within"

/**
 * The screens the onboarding shows, running, under the same fixture data the site's own
 * pictures are drawn from.
 *
 * These were photographs until now: three PNGs built by the site's capture stage and
 * copied in beside the view. The argument for them was weight, and it was wrong — this
 * window already ships every one of these components, because it draws them for real the
 * moment somebody signs in. So the onboarding was carrying pictures of code that was
 * sitting in the same bundle. A picture also goes stale in a way the thing itself cannot:
 * two of the three were taken before the first Court was renamed.
 *
 * The fixtures come from `shots/`, which is the one place in this repository that owns
 * believable data, and where the site reads them from as well.
 */
const VIEWS: Record<Shot, View> = {
  "working-set": WORKING_SET_VIEW,
  "pull-request": PULL_REQUEST_VIEW,
  commit: COMMIT_VIEW
}

/**
 * Light, whatever the window is set to.
 *
 * The welcome is the site's gradient and the panel on it is white, in dark mode as in
 * light: the gradient is light in both. A screen inside that panel drawn in the reader's
 * dark theme is a black rectangle in a white card.
 *
 * One store for all three, made once. It is never written to — nothing in these fixtures
 * opens the settings — so there is nothing for them to disagree about.
 */
const LIGHT = forgetful({
  ...DEFAULTS,
  theme: { ...DEFAULTS.theme, appearance: "light" }
})

/**
 * One screen in the onboarding's picture row.
 *
 * `Held` does the measuring and the scaling, which is the part the site does the same
 * way. What is left here is what only a window can answer: the diff engine, the icons,
 * the markdown painter and the toaster are all already provided above this point, and
 * answering them again would fetch a second copy of a four-megabyte renderer.
 *
 * `WithinProvider` is the one of these three that is not about looks. Every screen
 * portals its bar rather than drawing it in place, and left to itself that portal goes to
 * the top of the document — which here is the window's title bar, over the region macOS
 * needs in order to let anybody move the window. Told this element, the bar stays inside
 * the panel.
 */
export const Fixture = ({ shot }: { readonly shot: Shot }) => {
  const view = VIEWS[shot]

  return (
    <Held view={view}>
      {(host) => (
        <WithinProvider value={host}>
          <SettingsProvider store={LIGHT}>
            <Theme scope="root" element={host}>
              {view.draw()}
            </Theme>
          </SettingsProvider>
        </WithinProvider>
      )}
    </Held>
  )
}
