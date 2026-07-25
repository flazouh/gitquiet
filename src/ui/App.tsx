import { type PullRequestRef, toUrl } from "../domain/PullRequestRef"
import type { PullRequestHeader } from "../github/PageHeader"
import { Button } from "./button"

export type AppProps = {
  readonly reference: PullRequestRef
  readonly header: PullRequestHeader
}

export const App = ({ reference, header }: AppProps) => (
  <main className="mx-auto max-w-3xl p-8 font-sans text-neutral-900">
    <p className="text-sm text-neutral-500">
      {reference.owner}/{reference.repo}
    </p>
    <h1 className="mt-1 text-2xl font-semibold">{header.title}</h1>
    <p className="mt-1 text-sm text-neutral-500">#{header.number}</p>
    <div className="mt-6">
      <Button asChild variant="outline">
        <a href={toUrl(reference)}>Open on GitHub</a>
      </Button>
    </div>
  </main>
)
