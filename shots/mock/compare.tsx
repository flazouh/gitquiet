import type { Changed, Comparing } from "../../src/domain/compare"
import { CompareScreen } from "../../src/ui/CompareScreen"
import { STORE, type View } from "../view"

/**
 * A branch against its base, with a filter their own page has never had.
 *
 * The shape of a real comparison rather than a tidy one: a spec and a plan that grew,
 * a screen and its test that arrived together, and a module deleted because the screen
 * replaced it. That mix is what makes the filter worth photographing — twelve files
 * across four directories is exactly the point at which Community #165765's complaint
 * starts to bite, and a picture of three tidy files would not show it.
 */

const COMPARING: Comparing = {
  repo: { owner: "flazouh", repo: "gitquiet" },
  base: "main",
  head: "claude/gist-screen"
}

const CHANGED: ReadonlyArray<Changed> = [
  { path: "docs/spec/gists.md", anchor: "#diff-01", added: 82, deleted: 37, kind: "modified" },
  { path: "plans/007-give-the-gists-a-screen.md", anchor: "#diff-02", added: 126, deleted: 0, kind: "added" },
  { path: "src/app/ownGists.ts", anchor: "#diff-03", added: 78, deleted: 0, kind: "added" },
  { path: "src/app/ownGists.test.ts", anchor: "#diff-04", added: 71, deleted: 0, kind: "added" },
  { path: "src/domain/gist.ts", anchor: "#diff-05", added: 96, deleted: 2, kind: "modified" },
  { path: "src/domain/gistExport.ts", anchor: "#diff-06", added: 74, deleted: 0, kind: "added" },
  { path: "src/domain/gistList.ts", anchor: "#diff-07", added: 88, deleted: 1, kind: "modified" },
  { path: "src/github/gistList.ts", anchor: "#diff-08", added: 68, deleted: 3, kind: "modified" },
  { path: "src/github/gistView.ts", anchor: "#diff-09", added: 110, deleted: 0, kind: "added" },
  { path: "src/ui/GistListScreen.tsx", anchor: "#diff-10", added: 214, deleted: 0, kind: "added" },
  { path: "src/ui/GistScreen.tsx", anchor: "#diff-11", added: 167, deleted: 0, kind: "added" },
  { path: "src/ui/gistSearch.ts", anchor: "#diff-12", added: 0, deleted: 69, kind: "removed" }
]

export const COMPARE_VIEW: View = {
  name: "compare",
  caption: "Two branches compared, filtered by path — the thing their compare page has never had",
  ...STORE,
  draw: () => (
    <CompareScreen
      comparing={COMPARING}
      changed={CHANGED}
      reading={false}
      failed={false}
      onStepAside={() => {}}
    />
  )
}
