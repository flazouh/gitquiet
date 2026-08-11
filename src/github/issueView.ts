/**
 * One issue, in this codebase's words.
 *
 * The counterpart of `snapshot.ts` next door, and a much shorter one: a pull
 * request is assembled from six routes that disagree about how to spell a
 * person, and an issue arrives whole from one.
 */

import { Effect, Option, Schema } from "effect"
import type { Allowed, Closing, IssueSnapshot, Label, Reaction } from "../domain/Issue"
import type { IssueRef } from "../domain/issues"
import type { Participant, Remark } from "../domain/PullRequest"
import { AddedComment, IssueViewRoute } from "./wire"

export const decodeIssueView = Schema.decodeUnknownEffect(IssueViewRoute)

type Said = IssueViewRoute["data"]["repository"]["issue"]
type Speaker = NonNullable<Said["author"]>

/**
 * Somebody who spoke, as this codebase names people.
 *
 * A missing one is `ghost`, which is what GitHub renders for an account that is
 * gone and what everything else here does with the same absence.
 */
const personFrom = (speaker: Speaker | null | undefined): Participant => ({
  login: speaker?.login ?? "ghost",
  isAutomated: speaker?.__typename === "Bot",
  faceUrl: Option.fromNullishOr(speaker?.avatarUrl)
})

/**
 * Their word for why a closed issue closed, in ours.
 *
 * An unfamiliar reason is no reason rather than a failure: GitHub added
 * `DUPLICATE` to this field years after the other two, and a read that refused
 * the whole issue over a word it had not met would have broken on the day.
 */
const CLOSING_OF: Record<string, Closing> = {
  COMPLETED: "completed",
  NOT_PLANNED: "discarded",
  DUPLICATE: "duplicate",
  REOPENED: "completed"
}

const closingIn = (said: Said): Option.Option<Closing> =>
  said.state === "OPEN"
    ? Option.none()
    : Option.fromNullishOr(said.stateReason === null ? undefined : CLOSING_OF[said.stateReason ?? ""])

const labelsIn = (said: Said): ReadonlyArray<Label> =>
  (said.labels?.edges ?? []).flatMap((edge) =>
    edge.node === null
      ? []
      : [
          {
            name: edge.node.name,
            colour: edge.node.color,
            description: Option.fromNullishOr(edge.node.description)
          }
        ]
  )

/**
 * The reactions somebody actually gave.
 *
 * Their payload lists all eight kinds on every issue with a count of zero for
 * the seven nobody chose, and drawing those would be seven grey pills under
 * every description.
 */
const reactionsIn = (said: Said): ReadonlyArray<Reaction> =>
  (said.reactionGroups ?? []).flatMap((group) => {
    const count = group.reactors?.totalCount ?? 0
    return count === 0
      ? []
      : [{ kind: group.content, count, viewerReacted: group.viewerHasReacted }]
  })

/**
 * A permission GitHub answered null for, which is a no.
 *
 * Null is what these fields carry for a reader who is signed out or looking at
 * a repository they cannot write to, and a control drawn on the strength of an
 * unknown is a control that fails when it is pressed.
 */
const may = (answer: boolean | null | undefined): boolean => answer === true

/**
 * Whether this reader may close the issue, which their query answers sideways.
 *
 * `viewerCanClose` and `viewerCanReopen` are asked for below and GitHub has never sent
 * either: their persisted query carries thirteen `viewerCan…` fields and neither is among
 * them, so a control standing on those alone could never appear. Both are still read first,
 * because a field that arrives one day is a better answer than this one.
 *
 * Failing that, the pair that was measured. On `react/react` #35000, where the reader has no
 * write access and did not raise it, both are false and GitHub draws no button; on
 * `flazouh/stack-probe` #77, where they have both, both are true and GitHub draws one.
 * Either is enough on its own — an author may close their own issue in a repository they
 * cannot write to, which is most issues most people close.
 */
const maySettle = (said: Said): boolean =>
  may(said.viewerCanUpdateMetadata) || may(said.viewerDidAuthor)

const allowedIn = (said: Said): Allowed => ({
  comment: may(said.viewerCanComment),
  close: may(said.viewerCanClose) || maySettle(said),
  reopen: may(said.viewerCanReopen) || maySettle(said),
  label: may(said.viewerCanLabel),
  assign: may(said.viewerCanAssign)
})

/**
 * What was said, out of everything that happened.
 *
 * Their timeline holds two dozen kinds of item and this reads one of them. The
 * rest are events — a label added, a title changed, a cross reference from
 * somewhere else — and those are a record of the issue moving rather than of
 * anybody saying anything. An item without a body is dropped for the same
 * reason, whatever it calls itself.
 *
 * Hidden comments go with them. GitHub folds those away as spam or off topic,
 * and a reader who wants one can ask their page for it.
 */
const remarksIn = (said: Said): ReadonlyArray<Remark> =>
  (said.frontTimelineItems?.edges ?? []).flatMap((edge) => {
    const node = edge.node
    if (node === null || node.__typename !== "IssueComment") return []
    if (node.isHidden === true) return []

    const html = node.bodyHTML
    const id = node.id
    if (typeof html !== "string" || typeof id !== "string") return []

    return [
      {
        id,
        author: personFrom(node.author),
        body: node.body ?? "",
        html,
        createdAt: node.createdAt ?? ""
      }
    ]
  })

/** One decoded payload as an issue, which is a rename and nothing more. */
export const issueIn = (reference: IssueRef, route: IssueViewRoute): IssueSnapshot => {
  const said = route.data.repository.issue

  return {
    reference,
    id: said.id,
    title: said.title,
    description: { markdown: said.body, html: said.bodyHTML },
    state: said.state === "OPEN" ? "open" : "closed",
    closing: closingIn(said),
    openedAt: said.createdAt,
    author: personFrom(said.author),
    labels: labelsIn(said),
    assignees: (said.assignedActors?.nodes ?? []).flatMap((node) =>
      node === null ? [] : [personFrom(node)]
    ),
    remarks: remarksIn(said),
    reactions: reactionsIn(said),
    allowed: allowedIn(said),
    viewer: Option.map(Option.fromNullishOr(route.data.safeViewer), personFrom)
  }
}

/** Decoded and renamed, for a caller holding raw JSON. */
export const issueFrom = (
  reference: IssueRef,
  raw: unknown
): Effect.Effect<IssueSnapshot, unknown> =>
  decodeIssueView(raw).pipe(Effect.map((route) => issueIn(reference, route)))

export const decodeAddedComment = Schema.decodeUnknownEffect(AddedComment)

/**
 * The comment their mutation just made, as a Remark.
 *
 * The same shape their read gives, built the same way, so a comment posted a moment ago and a
 * comment read back an hour later are the same thing on the screen.
 */
export const remarkFrom = (said: AddedComment): Remark => {
  const node = said.data.addComment.timelineEdge.node

  return {
    id: node.id,
    author: personFrom(node.author),
    body: node.body ?? "",
    html: node.bodyHTML,
    createdAt: node.createdAt ?? new Date().toISOString()
  }
}
