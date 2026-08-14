/**
 * The number GitHub's upload route wants, which is not the id everything else here uses.
 *
 * Their writes address a repository by node id — `R_kgDOTndREA` — but `/upload/policies/assets`
 * takes the old numeric one, and refuses with a 422 for a missing or wrong one. There is no
 * payload on the page carrying it: it is in a meta tag, and has been since long before their
 * React pages, under two names depending on which page was served.
 *
 * A meta tag on its own says nothing about which repository it belongs to, and their app
 * navigates without loading, so a document can carry the meta of the repository the reader was
 * looking at a moment ago. That is why nothing here is handed back unless a payload on the same
 * document says the document is about the repository being asked about. See `scoped.ts`, which
 * is the other half of this and does the same for the node id.
 */

import { Option } from "effect"
import type { RepoRef } from "../domain/PullRequestRef"
import { UploadedAsset, UploadPolicy } from "./wire"
import { whereverItIs } from "./wherever"

export const decodeUploadPolicy = whereverItIs(UploadPolicy)
export const decodeUploadedAsset = whereverItIs(UploadedAsset)

type Page = Pick<Document, "querySelector">

const contentOf = (page: Page, name: string): Option.Option<string> =>
  Option.fromNullishOr(page.querySelector(`meta[name="${name}"]`)?.getAttribute("content"))

/**
 * The repository's number, off whichever of the two metas this page carries.
 *
 * An issue page carries `octolytics-dimension-repository_id`. The page for a new issue carries
 * only `hovercard-subject-tag`, as `repository:1316442384`. Both were measured on the same
 * repository and both said the same number.
 */
export const repositoryNumberOn = (page: Page): Option.Option<string> => {
  const plain = contentOf(page, "octolytics-dimension-repository_id")
  if (Option.isSome(plain) && /^\d+$/.test(plain.value)) return plain

  const tagged = contentOf(page, "hovercard-subject-tag")
  if (Option.isSome(tagged)) {
    const [kind, number] = tagged.value.split(":")
    if (kind === "repository" && number !== undefined && /^\d+$/.test(number)) {
      return Option.some(number)
    }
  }

  return Option.none()
}

/**
 * The same number, handed back only where the page agrees whose it is.
 *
 * `belongs` is `scopedRepositoryIn` in every real caller: something on the document that names
 * the owner and the repository. Taken as an argument so this stays one rule about one meta tag
 * and the test does not have to build a payload to say what the meta should do.
 */
export const repositoryNumberFor = (
  page: Page,
  reference: RepoRef,
  belongs: (reference: RepoRef) => boolean
): Option.Option<string> =>
  belongs(reference) ? repositoryNumberOn(page) : Option.none()
