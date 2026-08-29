import type { MergeWay } from "./wire"

/**
 * Which of the ways a repository allows to put on the button.
 *
 * This window cannot answer the question the way the extension does. The
 * extension reads GitHub's own merge box, which names a default per pull
 * request; the documented REST repository object names none at all, only which
 * of the three are allowed. So one is chosen here, and it is our choice rather
 * than GitHub's — which is worth saying plainly, because a comment claiming
 * GitHub's authority for it would be wrong and would outlive whoever wrote it.
 *
 * The choice is the first the repository allows, in GitHub's own order. That
 * order is already the one `waysToMerge` builds and the one the extension keeps
 * for its own list, and taking the first of it needs no claim about defaults.
 * The reader sees which way on the button before they press it either way.
 *
 * Undefined where a repository allows nothing, which is a repository nobody can
 * merge into. The caller says so rather than posting a way GitHub would refuse.
 */
export const preferredWay = (ways: ReadonlyArray<MergeWay>): MergeWay | undefined => ways[0]
