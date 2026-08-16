import { Effect, Option } from "effect"
import type { IssueSnapshot, Label, Remark } from "../../src/domain/Issue"
import type { Participant } from "../../src/domain/PullRequest"
import { IssueScreen } from "../../src/ui/IssueScreen"
import { renderMarkdown } from "../../src/ui/renderMarkdown"
import { alreadyKnown, nothingRemembered, settled, STORE, type View } from "../view"
import { faceOf, MOCK_VIEWER } from "./faces"
import { daysAgo, hoursAgo } from "./when"

/**
 * One issue worth photographing.
 *
 * `microsoft/vscode#328399` as it stands: a real regression, reported by the person
 * who hit it, with the labels their triagers put on it and the people who turned up
 * over the following week to say they have it too. Nothing here is invented, for the
 * reason the Working Set's rows are not: an invented report reads as filler at a
 * glance, and a reader deciding whether this interface is for them is reading exactly
 * the kind of thing they read all day.
 *
 * An issue in somebody else's repository rather than one of the reader's own, because
 * this page needs four things at once and only a week-old argument has all four: a
 * body with formatting in it, several people who do not agree, labels a team actually
 * uses, and somebody it was given to.
 */

const VIEWER = MOCK_VIEWER

/**
 * Faces drawn locally as inline SVG data URIs, so no real person's picture appears
 * in a public marketing screenshot and no network fetch races the shutter.
 *
 * The same shared helper every mock file uses. The conversation folds to one line per
 * person, so the face is most of what each line is. Every login on this page is
 * invented; none is a real GitHub account.
 */

const person = (login: string): Participant => ({
  login,
  isAutomated: false,
  faceUrl: faceOf(login)
})

const REFERENCE = { owner: "microsoft", repo: "vscode", number: 328399 }

const TITLE =
  "macOS: VS Code 1.131 blocks Local Network access for integrated terminal/Remote-SSH (regression, works on 1.130)"

/**
 * The labels with the colours GitHub holds for them.
 *
 * Their own six hex digits, taken from the repository, rather than a colour hashed
 * from the name as a Working Set row does. This is the route that sends the colour,
 * so the header draws what it was given: a team's palette is part of how they read
 * their own list, and `regression` in the wrong red says the wrong thing about it.
 */
const LABELS: ReadonlyArray<Label> = [
  {
    name: "bug",
    colour: "8D6673",
    description: Option.some("Issue identified by VS Code Team member as probable bug")
  },
  {
    name: "info-needed",
    colour: "E2A1C2",
    description: Option.some("Issue requires more information from poster")
  },
  {
    name: "macos",
    colour: "006b75",
    description: Option.some("Issues with VS Code on MAC/OS X")
  },
  {
    name: "regression",
    colour: "8D6673",
    description: Option.some("Something that used to work is now broken")
  }
]

/**
 * What was written, as it was written.
 *
 * Markdown rather than the HTML the page draws, with the rendering done below by the
 * same function the write box previews with. Two copies of one paragraph in a file
 * nobody renders twice would be two things to keep in step, and the point of the
 * picture is a body that reads like a body: numbered steps, commands in code, and a
 * paragraph of what was already ruled out.
 */
const BODY = `Does this issue occur when all extensions are disabled?: Yes

- VS Code Version: 1.131.0
- OS Version: macOS (darwin arm64) —macOS 26.6 (25G72)
Steps to Reproduce:
1. On macOS, with an app-level "Local Network" permission previously granted to VS Code, open the integrated terminal or use Remote-SSH to connect to a device on the local LAN (e.g. \`192.168.1.x\`).
2. Observe that any network call to a local/private IP fails at the OS level — e.g. \`ping 192.168.1.2\` inside the VS Code integrated terminal returns \`ping: sendto: No route to host\`, and \`ssh 192.168.1.2\` returns \`ssh: connect to host 192.168.1.2 port 22: No route to host\`.
3. Run the identical command (\`ping 192.168.1.2\` or \`ssh 192.168.1.2\`) in Terminal.app (or iTerm) on the same machine, same network — it succeeds immediately.
4. Confirm this is scoped to VS Code's process tree, not general connectivity or SSH config, since ping (a non-SSH, non-auth-dependent command) fails identically.
5. Downgrade to VS Code 1.130 — same commands, same machine, same network — LAN access works correctly in both the integrated terminal and via Remote-SSH.

Additional context:
- \`System Settings → Privacy & Security → Local Network\` shows VS Code's toggle in an ambiguous/inconsistent state; toggling off/on and relaunching does not resolve the issue on 1.131.
- \`tccutil reset LocalNetwork com.microsoft.VSCode\` (and \`tccutil reset LocalNetwork\` system-wide) fail to reset the permission, including when run with \`sudo\` and from Recovery Mode.
- Suspect a regression in 1.131 related to how the app's Local Network TCC entitlement is being requested or retained, causing macOS to silently deny LAN traffic from VS Code's spawned child processes even when the toggle appears enabled.
- Workaround: rolling back to 1.130 restores normal LAN access without any permission changes.`

/**
 * One thing said on the issue.
 *
 * The id is a key and nothing else here, since nothing on this stage is written and
 * so nothing is ever addressed by it. GitHub's own node ids are what a page carries;
 * a name built from the login and the hour is what a reader of this file can check
 * against the row above it, and it stays unique when somebody answers twice, which on
 * this issue two people do.
 */
const said = (login: string, hoursBack: number, body: string): Remark => ({
  id: `IC_${login}_${hoursBack}`,
  author: person(login),
  body,
  html: renderMarkdown(body),
  createdAt: hoursAgo(hoursBack)
})

/**
 * Everything said about it, oldest first, as the timeline gives them.
 *
 * Ten of the eleven comments on the issue, because the conversation folds to one line
 * each and ten is what carries the panel to the bottom edge of the frame. The one left
 * out is an answer somebody sent by email, which arrived as a screenful of quoted
 * message and folds to a line of somebody else's words. Each carries the opening of what
 * was written, cut at a sentence: the fold shows the first line and the rest is one
 * press away, so a comment quoted to its last paragraph would be words nobody sees in
 * the photograph and a longer file for everybody reading it.
 */
const SAID: ReadonlyArray<Remark> = [
  said(
    "f-benton",
    164,
    `I have the same issue in Visual Studio Code - Insiders (1.132.0-insider). Connectivity to local network devices fails with No route to host error.

Tried resetting permissions in System Settings → Privacy & Security → Local Network without success (using macOS 26.5.2)

In visual Studio Code 1.131.0 works fine; I can do ping, telnet, ssh to local network nodes.`
  ),
  said(
    "m-koersen",
    122,
    `I have the same issue on 1.131.0, the workaround of rolling back to 1.130.0 "fixed" it for me too. In my normal terminal doing a ping worked fine, but not in VSCode.`
  ),
  said(
    "c-liang",
    102,
    `I have the same issue.
I have to set below to make it work.
\`\`\`bash
"remote.SSH.useExecServer": false, // Use exec SSH server
\`\`\``
  ),
  said(
    "i-lukas",
    88,
    `This problem not only about ssh.
Extensions cant see devices in local network when you try to connect.`
  ),
  said(
    "m-elven",
    56,
    "Same problem here. Downgraded to 1.129 and I can finally get VSCode to connect again to remote hosts"
  ),
  said(
    "i-novak",
    43,
    "I have tried a couple of different steps but unable to repro on my machine (26.6 25G70)."
  ),
  said(
    "r-torres",
    32,
    "This is a very annoying issue, remove local networks from Vscode. 1.131 and 1.132 affected. I changed my Settings.json to block updates."
  ),
  said(
    "m-koersen",
    11,
    `I ran the bisect, first 1.129 - 1.130, but I couldn't reproduce it like that (it always keeps working). Then I tried \`-g 1.129 -b 1.131\` and also then I couldn't reproduce it.

Two findings however:

1. Today it automatically updated to 1.132, so the first thing I did was do a test, and I noticed it was actually working, then I stopped the ping. So I think for the first 20 seconds or so it worked, after that it stopped working.
2. Running the ping as root does work:

\`\`\`console
sh-3.2$ ping 192.168.1.121
ping: sendto: No route to host

sh-3.2$ sudo ping 192.168.1.121
64 bytes from 192.168.1.121: icmp_seq=0 ttl=64 time=4.019 ms
\`\`\``
  ),
  said(
    "t-verbon",
    9,
    `I am running macOS 26.6 and I also have this issue. I run my mongodb in a docker on local network.`
  ),
  said(
    "r-torres",
    8,
    `I believe Electron was updated after 1.130, that might be the issue.

From 1.131 they introduced the newer Electron version:

| VS Code | Electron |
|---------|----------|
| 1.131.0 | 42.7.0 |
| 1.130.0 | 42.6.0 |`
  )
]

/**
 * The issue itself.
 *
 * `allowed` is GitHub's answer about the reader rather than a guess, and the reader
 * here is a stranger to this repository: they may say something and they may not
 * close, label or assign anything. Photographed that way on purpose. A Close control
 * over somebody else's issue would be a control that is refused the moment it is
 * pressed, which is a picture of something this extension does not do.
 */
const SNAPSHOT: IssueSnapshot = {
  reference: REFERENCE,
  id: "I_kwDOAn8RLM8AAAABK8hv9g",
  title: TITLE,
  description: { markdown: BODY, html: renderMarkdown(BODY) },
  state: "open",
  closing: Option.none(),
  openedAt: daysAgo(7),
  author: person("t-ahanu"),
  labels: LABELS,
  assignees: [person("a-kim")],
  remarks: SAID,
  reactions: [{ kind: "THUMBS_UP", count: 13, viewerReacted: false }],
  allowed: { comment: true, close: false, reopen: false, label: false, assign: false },
  viewer: Option.some(person(VIEWER))
}

export const ISSUE_VIEW: View = {
  name: "issue",
  caption:
    "One issue in the order anybody asks in: what it is, what was written, and what everybody said about it",
  ...STORE,
  draw: () => (
    <IssueScreen
      reference={REFERENCE}
      load={settled({ snapshot: SNAPSHOT })}
      preload={alreadyKnown({ snapshot: SNAPSHOT })}
      recallRepositories={nothingRemembered()}
      /*
       * Wired up so the box at the foot is drawn, and answering never, because a
       * capture that posted a comment to GitHub would be a capture nobody could take
       * twice. The box is signed with the reader's own face, which is the half of it
       * worth photographing.
       */
      postRemark={() => Effect.never}
      signedIn={() => true}
      onStepAside={() => {}}
    />
  )
}
