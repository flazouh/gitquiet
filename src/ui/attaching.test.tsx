import { afterEach, describe, expect, test } from "bun:test"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Deferred, Effect } from "effect"
import { useState } from "react"
import type { Uploaded } from "../domain/attaching"
import { Writing } from "./Writing"

afterEach(cleanup)

/**
 * A picture, as far as the box is concerned.
 *
 * Nothing here decodes one: the box measures a picture with an `Image`, which in this DOM
 * never loads and never fails, so a test that used a real image type would wait forever for a
 * width. The measuring is the browser's and is watched on a real page instead.
 */
const file = (name: string, type = "application/zip") =>
  new File([new Uint8Array(8)], name, { type })

const Box = ({
  onUpload
}: {
  readonly onUpload?: (file: File) => Effect.Effect<Uploaded, unknown>
}) => {
  const [text, setText] = useState("")

  return (
    <Writing
      text={text}
      onText={setText}
      placeholder="Say something"
      onEscape={() => {}}
      onSend={() => {}}
      onUpload={onUpload}
    />
  )
}

const took = (href: string) => (one: File) => Effect.succeed({ name: one.name, href })

/** What a clipboard with files on it looks like, of which the box reads three things. */
const carrying = (...files: ReadonlyArray<File>) =>
  ({
    files,
    items: files.map((one) => ({ kind: "file", type: one.type, getAsFile: () => one })),
    types: ["Files"],
    getData: () => ""
  }) as unknown as DataTransfer

describe("a file dropped or pasted into the box", () => {
  test("writes a link where the file is not a picture", async () => {
    render(<Box onUpload={took("https://github.com/user-attachments/1")} />)

    await userEvent.paste(carrying(file("trace.zip")))

    await waitFor(() =>
      expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
        "[trace.zip](https://github.com/user-attachments/1)"
      )
    )
  })

  test("stands a mark in the words until the bytes are theirs", async () => {
    const waited = Effect.runSync(Deferred.make<Uploaded, never>())
    render(<Box onUpload={() => Deferred.await(waited)} />)

    await userEvent.paste(carrying(file("trace.zip")))

    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    expect(box.value).toBe('<!-- Uploading "trace.zip"... -->')
    // A comment, so a draft posted in the middle of an upload says nothing rather than
    // saying "Uploading", which is what their own box would post.
    expect(screen.getByText("Attaching a file…")).toBeTruthy()

    act(() => Effect.runSync(Deferred.succeed(waited, { name: "trace.zip", href: "https://x/1" })))
    await waitFor(() => expect(box.value).toBe("[trace.zip](https://x/1)"))
  })

  test("keeps what was typed while the bytes were going up", async () => {
    const waited = Effect.runSync(Deferred.make<Uploaded, never>())
    render(<Box onUpload={() => Deferred.await(waited)} />)

    await userEvent.paste(carrying(file("trace.zip")))
    await userEvent.type(screen.getByRole("textbox"), "and here is why")

    act(() => Effect.runSync(Deferred.succeed(waited, { name: "trace.zip", href: "https://x/1" })))

    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    await waitFor(() => expect(box.value).toContain("[trace.zip](https://x/1)"))
    expect(box.value).toContain("and here is why")
  })

  test("takes the mark back out and repeats what GitHub said about it", async () => {
    render(
      <Box
        onUpload={() =>
          Effect.fail({ reason: "rejected", detail: "Yowza, that's a big file." })
        }
      />
    )

    await userEvent.paste(carrying(file("huge.zip")))

    await waitFor(() => expect(screen.getByText("Yowza, that's a big file.")).toBeTruthy())
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("")
  })

  test("says something of its own where GitHub said nothing", async () => {
    render(<Box onUpload={() => Effect.fail(new Error("off"))} />)

    await userEvent.paste(carrying(file("huge.zip")))

    await waitFor(() => expect(screen.getByText("huge.zip could not be attached.")).toBeTruthy())
  })

  test("gives two files two marks, so one refused takes only its own away", async () => {
    const first = Effect.runSync(Deferred.make<Uploaded, never>())
    const second = Effect.runSync(Deferred.make<Uploaded, never>())
    render(
      <Box
        onUpload={(one) => (one.name === "a.zip" ? Deferred.await(first) : Deferred.await(second))}
      />
    )

    await userEvent.paste(carrying(file("a.zip"), file("b.zip")))

    const box = screen.getByRole("textbox") as HTMLTextAreaElement
    expect(screen.getByText("Attaching 2 files…")).toBeTruthy()

    act(() => Effect.runSync(Deferred.succeed(second, { name: "b.zip", href: "https://x/b" })))
    await waitFor(() => expect(box.value).toContain("[b.zip](https://x/b)"))
    expect(box.value).toContain('<!-- Uploading "a.zip"... -->')

    act(() => Effect.runSync(Deferred.succeed(first, { name: "a.zip", href: "https://x/a" })))
    await waitFor(() => expect(box.value).toContain("[a.zip](https://x/a)"))
  })

  test("does nothing with a file where nothing is wired up to take one", async () => {
    render(<Box />)

    await userEvent.paste(carrying(file("trace.zip")))

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("")
  })

  test("offers a control for it, drag and paste being things nobody can see", () => {
    render(<Box onUpload={took("https://x/1")} />)

    expect(screen.getByRole("button", { name: "Attach a file" })).toBeTruthy()
  })

  test("offers no control where nothing would take the file", () => {
    render(<Box />)

    expect(screen.queryByRole("button", { name: "Attach a file" })).toBeNull()
  })
})
