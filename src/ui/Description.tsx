import { Folded } from "./Folded"
import { Markdown } from "./Markdown"
import { Section } from "./Section"

/**
 * What the Author wrote: the first screenful of it, and the rest on a click.
 *
 * The fold itself is {@link Folded}, which a discussion's body uses as well. What is left here
 * is the one thing particular to a pull request: the description is markdown this codebase
 * parses, where a discussion's body is the article GitHub already rendered.
 */
export const Description = ({
  markdown,
  owner,
  repo,
  foldable = true
}: {
  readonly markdown: string
  readonly owner?: string
  readonly repo?: string
  readonly foldable?: boolean
}) => (
  <Section name="Description">
    <Folded foldable={foldable}>
      <Markdown markdown={markdown} owner={owner} repo={repo} />
    </Folded>
  </Section>
)
