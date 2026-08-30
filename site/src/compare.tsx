import "@fontsource-variable/inter"
import { mount } from "./mount"
import { comparedAt, COMPARED, type Compared } from "./compare/pages"
import {
  Above,
  AddToChrome,
  Aside,
  Footer,
  HELD,
  INSTALL_AT,
  Nav,
  Quietly,
  SkipTo,
  Source
} from "./Shell"
import "./index.css"

const slugOf = (pathname: string): string => {
  const path = pathname.replace(/\/$/, "").replace(/\.html$/, "")
  return path.split("/").pop() ?? ""
}

const Compare = ({ page }: { readonly page: Compared }) => {
  const others = COMPARED.filter((other) => other.slug !== page.slug)

  return (
    <>
      <SkipTo id="axis" says="Skip to the comparison" />

      <Above>
        <Nav>
          <Source />
          <Aside at={INSTALL_AT}>Downloads</Aside>
          <AddToChrome />
        </Nav>

        <div className="pb-16 pt-10 sm:pt-16">
          <p className="eyebrow m-0">
            GitQuiet vs {page.name}
          </p>
          <h1 className="m-0 mt-4 max-w-3xl text-balance text-[clamp(2.1rem,5.5vw,3.4rem)] font-semibold leading-[1.05] tracking-[-0.04em]">
            {page.h1}
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink/70">{page.dek}</p>
          <div className="mt-10">
            <AddToChrome big />
          </div>
        </div>
      </Above>

      <main className={HELD}>
        <section id="axis" className="grid gap-12 border-t border-rule py-16 md:grid-cols-2">
          <div>
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{page.name}</h2>
            <p className="m-0 mt-4 text-[16px] leading-relaxed text-muted">{page.they}</p>
            {page.themAt === undefined ? (
              <p className="m-0 mt-4 text-[15px] leading-relaxed text-ink/60">No site of its own.</p>
            ) : (
              <p className="m-0 mt-4 text-[15px] leading-relaxed text-ink/60">
                <Quietly at={page.themAt}>{page.themAt.replace(/^https:\/\//, "")}</Quietly>
              </p>
            )}
          </div>
          <div>
            <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">GitQuiet</h2>
            <p className="m-0 mt-4 text-[16px] leading-relaxed text-muted">{page.we}</p>
          </div>
        </section>

        <section className="border-t border-rule py-16">
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">The axis</h2>
          <p className="m-0 mt-4 max-w-2xl text-[16px] leading-relaxed text-muted">{page.axis}</p>
        </section>

        <section className="border-t border-rule py-16">
          <h2 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">Also compared to</h2>
          <ul className="m-0 mt-6 flex list-none flex-col gap-3 p-0">
            {others.map((other) => (
              <li key={other.slug}>
                <Quietly at={`/compare/${other.slug}`}>
                  GitQuiet vs {other.name}
                </Quietly>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <div className={HELD}>
        <Footer />
      </div>
    </>
  )
}

const page = comparedAt(slugOf(location.pathname))
if (page === undefined) {
  throw new Error(`no comparison for ${location.pathname}`)
}

mount("page", <Compare page={page} />)
