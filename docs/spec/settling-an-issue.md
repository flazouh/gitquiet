# Closing an issue, and putting it back

Status: recorded, and exercised against a live repository.

How an issue is closed at GitHub, recovered off the wire on 2026-08-05 by pressing their
own button with a recorder over `fetch`, then driven from outside their bundle. The worked
example is [flazouh/stack-probe](https://github.com/flazouh/stack-probe) #77, a scratch
issue closed as completed, closed as not planned, and reopened, several times each.

Beside `raising-an-issue.md` and the same mechanism: one persisted GraphQL mutation on
`/_graphql`, addressed by a hash and a node id. Everything that document says about how the
hash is found, why the route answers 200 for a refusal, and why there is no dry run holds
here word for word and is not repeated.

## The three closes and the one reopen

```
POST https://github.com/_graphql
```

| What | `persistedQueryName` | Variables |
| --- | --- | --- |
| Close | `updateIssueStateMutationCloseMutation` | `{duplicateIssueId, id, newStateReason}` |
| Reopen | `updateIssueStateMutation` | `{id}` |

`newStateReason` is `COMPLETED`, `NOT_PLANNED` or `DUPLICATE`, which are their own three.
`duplicateIssueId` is sent on every close: `null` for the first two, and the node id of the
other issue for the third. Verified on 2026-08-06, #77 closed as a duplicate of #78:

```json
{"data":{"closeIssue":{"issue":{
  "id":"I_kwDOTndREM8AAAABLoOHsA","state":"CLOSED","stateReason":"DUPLICATE",
  "duplicateOf":{"number":78,"url":"https://github.com/flazouh/stack-probe/issues/78","id":"I_kwDOTndREM8AAAABLohEJg"}
}}}}
```

A node id is the only name that route takes, and nothing derives one from a number: the id
packs a repository row only GitHub holds. So the issue the reader names is read for its id
first — one request, normally out of the store, and also the check that the issue exists
before anything is closed. See `named` in `src/app/issue.ts`.

`id` is the issue's node id, `I_kwDOTndREM8AAAABLoOHsA` for #77. There is no `closeIssue`
taking an owner, a name and a number. GitHub serves it in the same payload the screen is
already reading, so nothing extra is fetched for it — see `IssueSnapshot.id`.

The answer echoes what was sent:

```json
{"data":{"closeIssue":{"issue":{
  "id":"I_kwDOTndREM8AAAABLoOHsA","state":"CLOSED","stateReason":"NOT_PLANNED","duplicateOf":null
}}}}
```

Nothing is kept from it. The header showed the new state on the press.

## Headers: theirs, less the two that are not checked

Their own button sends `X-Fetch-Nonce`, `X-GitHub-Client-Version` and
`GitHub-Verified-Fetch: true`. The client version is not checked and is not sent. The other
four are the same set `raising-an-issue.md` lists, and the write was verified with them.

## Who may press it, which their query answers sideways

`viewerCanClose` and `viewerCanReopen` are the obvious fields and GitHub does not send
either. Their persisted read carries thirteen `viewerCan…` fields and neither is among
them, so the control stood behind a permission that was false on every issue in the world.

Measured on two live issues:

| | `react/react` #35000 | `flazouh/stack-probe` #77 |
| --- | --- | --- |
| Reader may write here | no | yes |
| Reader raised it | no | yes |
| `viewerCanUpdateMetadata` | `false` | `true` |
| `viewerDidAuthor` | `false` | `true` |
| `viewerCanComment` | `true` | `true` |
| GitHub draws a Close button | no | yes |

So the pair is read instead, either one being enough: GitHub lets an author close their own
issue in a repository they cannot write to, which is most of the issues most people close.
`viewerCanClose` is still read first, in case a later deploy starts sending it.

## The older Rails route is closed here too

`POST /{owner}/{repo}/issues/{number}/close` still exists and answered 422 with GitHub's
CSRF page. Their issue page is React and carries no `input[name="authenticity_token"]` to
take a token from, and `GitHub-Verified-Fetch: true` does not stand in for one on that
route. The same finding as raising, on the same day.

## What is wrong with their own control, and what this one does instead

Read on 2026-08-06, mostly out of GitHub's own accessibility thread on this exact button,
[community/community #156844](https://github.com/community/community/discussions/156844),
where the replies are from the Issues team. Four faults, all of them answered here.

| Theirs | Ours |
| --- | --- |
| The reason picker hangs off an `aria-hidden` chevron. A reader on NVDA or Orca cannot reach it at all; the reporter tried Firefox and Chromium on Linux, then Firefox and Chrome on Windows. | A button and a menu of three items, which every screen reader already drives. |
| Choosing a reason closes nothing. It re-labels the button, and the reader has to find their way back to it. Their own engineer in that thread: "It's not obvious that you also have to go back and click the Close button after selecting the option". | One press, one close, and the header says so before GitHub answers. |
| The chosen reason is shown by a coloured glyph the screen reader never sees, so the change is silent. Their words: "this state change isn't shown when selecting Close as Not Planned - this is an (additional?) accessibility violation". | The state carries the word and announces it (`aria-live`), so "Closed as not planned" is said. |
| The duplicate opens a sub-menu that searches issue titles. Their own note: "It'd be interesting to see if that's confusing for users". | A field that takes `#78`, `owner/repo#78` or a pasted link, and says back the issue it read before the press. |

Two more, from outside that thread:

- Their control is at the foot of the conversation, under however many comments there are. A
  [Stack Overflow answer from June 2026](https://stackoverflow.com/questions/79960696) exists
  only to tell people to scroll to the bottom and find the triangle. Ours is on the title.
- Closing as a duplicate was asked for repeatedly before it shipped
  ([#82271](https://github.com/community/community/discussions/82271), Dec 2023; and again Oct
  2024), because closing a duplicate as "not planned" says something untrue about the work.
  It is one of the three here from the first day.

Not offered, and named so that the gap is a decision rather than an oversight: closing with a
comment in the one press their button offers. The page has a box now — see
`saying-something.md` — so this is two presses rather than none, and the one press is worth
adding when somebody asks for it.
