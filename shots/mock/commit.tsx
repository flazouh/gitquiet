import { Option } from "effect"
import type { CommitDetail } from "../../src/domain/PullRequest"
import { CommitScreen } from "../../src/ui/CommitScreen"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf } from "./faces"
import { fileFrom } from "./patch"
import { daysAgo } from "./when"

/**
 * One commit, on the page GitHub keeps for it.
 *
 * The panel is the whole page here, which is what separates this picture from the pull
 * request one: there is nothing to merge, nobody's review to wait for and no branch
 * behind it, so the tree and the diff take the window. That is the argument, and it
 * only reads if the diff is real code in a repository somebody recognises.
 *
 * React for that reason, at `react/react`, which is where GitHub now redirects
 * `facebook/react` to. A commit from the Activity work, because the
 * change is small enough to fit on one screen and specific enough to be worth reading:
 * a portal nested under a hidden element was left visible.
 *
 * Nothing here is anybody's private repository.
 */

const REFERENCE = {
  owner: "react",
  repo: "react",
  sha: "b1f6d4a72e0c9583aa4f1d05c7e8b3924610fd7c"
} as const

const CONFIG_DOM = `
@@ -1216,7 +1216,23 @@ export function hideInstance(instance: Instance): void {
 export function hideTextInstance(textInstance: TextInstance): void {
   textInstance.nodeValue = '';
 }
 
+// A portal's children are mounted outside this subtree, so walking the fiber
+// tree never reaches them and \`display: none\` on the host instance hides
+// nothing. The container is the only handle we have on them.
+export function hidePortalInstance(portalInstance: Container): void {
+  if (portalInstance.nodeType === ELEMENT_NODE) {
+    const style = ((portalInstance: any): Instance).style;
+    style.setProperty('display', 'none', 'important');
+  }
+}
+
+export function unhidePortalInstance(portalInstance: Container): void {
+  if (portalInstance.nodeType === ELEMENT_NODE) {
+    ((portalInstance: any): Instance).style.display = '';
+  }
+}
+
 export function unhideInstance(instance: Instance, props: Props): void {
   instance.style.display = dangerousStyleValue(
     'display',
@@ -1281,6 +1297,12 @@ export function unhideTextInstance(
   textInstance.nodeValue = text;
 }
 
+export function portalContainerOf(instance: Container): Container {
+  return instance.nodeType === COMMENT_NODE
+    ? ((instance: any): Comment).parentNode
+    : instance;
+}
+
 export function clearContainer(container: Container): void {
   const nodeType = container.nodeType;
   if (nodeType === DOCUMENT_NODE) {
`

const ACTIVITY = `
@@ -218,5 +218,5 @@ function updateOffscreenComponent(
     if (enableActivity) {
-      nextState = {baseLanes: nextBaseLanes, cachePool: null};
+      nextState = {baseLanes: nextBaseLanes, cachePool: null, hidesPortals: true};
     }
     workInProgress.memoizedState = nextState;
     workInProgress.updateQueue = null;
`

const COMMIT_WORK = `
@@ -1881,7 +1881,16 @@ function hideOrUnhideAllChildren(finishedWork: Fiber, isHidden: boolean) {
         } else {
           unhideInstance(node.stateNode, node.memoizedProps);
         }
-      } else if (node.tag === HostText) {
+      } else if (node.tag === HostPortal) {
+        // Descending into a portal would hide the tree it renders into, which
+        // may be shared with something that is not inside this Activity. The
+        // container itself is the boundary, so it is what gets hidden.
+        if (isHidden) {
+          hidePortalInstance(node.stateNode.containerInfo);
+        } else {
+          unhidePortalInstance(node.stateNode.containerInfo);
+        }
+      } else if (node.tag === HostText) {
         const instance = node.stateNode;
         if (isHidden) {
           hideTextInstance(instance);
`

const BEGIN_WORK = `
@@ -3104,4 +3104,5 @@ function beginWork(
     case HostPortal:
+      pushHostContainer(workInProgress, workInProgress.stateNode.containerInfo);
       return updatePortalComponent(current, workInProgress, renderLanes);
     case ForwardRef: {
       const type = workInProgress.type;
`

const ACTIVITY_TEST = `
@@ -1512,4 +1512,30 @@ describe('Activity', () => {
     await act(() => root.render(<App show={false} />));
     expect(container.innerHTML).toBe('<span style="display: none">inner</span>');
   });
+
+  // @gate enableActivity
+  it('hides a portal nested under an element inside a hidden Activity', async () => {
+    const portalContainer = document.createElement('div');
+    document.body.appendChild(portalContainer);
+
+    function App({mode}) {
+      return (
+        <Activity mode={mode}>
+          <div>
+            {ReactDOM.createPortal(<span>portaled</span>, portalContainer)}
+          </div>
+        </Activity>
+      );
+    }
+
+    const root = ReactDOMClient.createRoot(container);
+    await act(() => root.render(<App mode="visible" />));
+    expect(portalContainer.style.display).toBe('');
+
+    await act(() => root.render(<App mode="hidden" />));
+    expect(portalContainer.style.display).toBe('none');
+
+    await act(() => root.render(<App mode="visible" />));
+    expect(portalContainer.style.display).toBe('');
+  });
 });
`

const FIXTURE_TEST = `
@@ -412,6 +412,18 @@ describe('ReactPortal', () => {
     expect(portalContainer.innerHTML).toBe('<div>portal</div>');
   });
 
+  it('leaves a portal beside a hidden Activity alone', async () => {
+    const portalContainer = document.createElement('div');
+
+    const root = ReactDOMClient.createRoot(container);
+    await act(() => root.render(<Beside container={portalContainer} />));
+
+    await act(() => root.render(<Beside container={portalContainer} hidden={true} />));
+
+    // Nothing hid it: the portal is a sibling of the Activity, not inside it.
+    expect(portalContainer.style.display).toBe('');
+  });
+
   it('does not update the portal when the container is the same', async () => {
     const root = ReactDOMClient.createRoot(container);
     await act(() => root.render(<Portal container={portalContainer} />));
`

/*
 * The rail sorts folders above loose files and everything by name, and the panel opens
 * on whichever file that leaves first. See `railOrder.ts`. So `react-dom-bindings` is
 * the only top folder that can come first here, and the file in it is the one carrying
 * the change the message is about, which is the file the picture should be of.
 *
 * The second test file was under `packages/react-dom` while it was being written, which
 * sorts above `react-dom-bindings` and opened the photograph on a fixture.
 */
const FILES = [
  fileFrom("packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js", CONFIG_DOM),
  fileFrom("packages/react-reconciler/src/ReactFiberActivityComponent.js", ACTIVITY),
  fileFrom("packages/react-reconciler/src/ReactFiberBeginWork.js", BEGIN_WORK),
  fileFrom("packages/react-reconciler/src/ReactFiberCommitWork.js", COMMIT_WORK),
  fileFrom("packages/react-reconciler/src/__tests__/ReactActivity-test.js", ACTIVITY_TEST),
  fileFrom("packages/react-reconciler/src/__tests__/ReactPortal-test.js", FIXTURE_TEST)
]

/**
 * The rest of the message, as GitHub renders it.
 *
 * Kept as their HTML because the panel draws it as theirs: reproducing their markdown
 * is a project and they have done it. The body is what makes a commit page worth
 * having over a diff, so a commit photographed without one is a commit photographed
 * with the interesting half missing.
 */
const BODY = [
  "<p>Walking the fiber tree to hide an <code>&lt;Activity mode=\"hidden\"&gt;</code>",
  "subtree stopped at portals, so a portal nested under an element inside one stayed",
  "on the screen. Hiding the portal's own children is wrong as well: the container may",
  "be shared with a tree that is not inside the Activity at all.</p>",
  "<p>So the container is the boundary. <code>hidePortalInstance</code> sets",
  "<code>display: none</code> on it and <code>unhidePortalInstance</code> puts it",
  "back, and the walk stops there rather than descending.</p>"
].join(" ")

export const COMMIT: CommitDetail = {
  sha: REFERENCE.sha,
  abbreviatedSha: REFERENCE.sha.slice(0, 7),
  headline: 'Hide portals nested under an element inside <Activity mode="hidden"> (#37142)',
  bodyHtml: Option.some(BODY),
  author: "s-almeida",
  avatarUrl: faceOf("s-almeida"),
  createdAt: daysAgo(2),
  files: FILES
}

export const COMMIT_VIEW: View = {
  name: "commit",
  caption:
    "One commit read the way a pull request is read, with the tree beside the code and the next file a key away",
  ...STORE,
  /* A drawn code cell rather than the host that will hold one. See `pullRequest.tsx`. */
  ready: "[data-code]",
  draw: () => (
    <CommitScreen
      reference={REFERENCE}
      load={settled(COMMIT)}
      preload={alreadyKnown(COMMIT)}
      recallRepositories={nothingRemembered()}
      fetchDiffs={settled([])}
      onUseGitHub={() => {}}
    />
  )
}
