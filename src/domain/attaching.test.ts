import { describe, expect, test } from "bun:test"
import { pictured, placed, swapped, waiting, written } from "./attaching"

describe("the mark that stands where a file will be", () => {
  test("says nothing at all where a draft is posted before the bytes land", () => {
    // A comment renders as nothing. Their own box writes "Uploading …" as words, which is a
    // sentence the reader never wrote arriving in a comment they did.
    expect(waiting("shot.png")).toBe('<!-- Uploading "shot.png"... -->')
  })

  test("tells two of the same name apart, because a paste twice is a paste twice", () => {
    expect(waiting("shot.png", 1)).not.toBe(waiting("shot.png", 0))
  })

  test("goes on a line of its own where the line has words on it", () => {
    const put = placed("Look at this", 12, "MARK")

    expect(put.text).toBe("Look at this\nMARK")
    expect(put.caret).toBe(17)
  })

  test("adds no line where the caret already stands on an empty one", () => {
    expect(placed("Look at this\n", 13, "MARK").text).toBe("Look at this\nMARK")
  })

  test("keeps what was written after the caret, and parts from it", () => {
    expect(placed("before\nafter", 6, "MARK").text).toBe("before\nMARK\nafter")
  })
})

describe("what is written once GitHub has the bytes", () => {
  test("writes an image at the size it really is, so a screenshot arrives its own size", () => {
    expect(written({ name: "wide.png", href: "https://x/1", width: 1600, height: 900 })).toBe(
      '<img width="1600" height="900" alt="wide" src="https://x/1" />'
    )
  })

  test("names the picture in the alt text, where their own box writes Image every time", () => {
    // "Image" tells a screen reader nothing. The file name was already there and is a
    // description, and it sits in the box where anybody can type over it.
    const said = written({ name: "login-error_2.png", href: "https://x/1", width: 8, height: 8 })

    expect(said).toContain('alt="login error 2"')
  })

  test("writes a link for anything that is not a picture", () => {
    expect(written({ name: "trace.zip", href: "https://x/2" })).toBe(
      "[trace.zip](https://x/2)"
    )
  })

  test("keeps a quote in a name from ending the alt text early", () => {
    const said = written({ name: 'a "big" one.png', href: "https://x/3", width: 2, height: 2 })

    expect(said).toBe('<img width="2" height="2" alt="a \'big\' one" src="https://x/3" />')
  })

  test("counts an SVG as a file, GitHub drawing none of them in a comment", () => {
    expect(pictured("image/svg+xml")).toBe(false)
    expect(pictured("image/png")).toBe(true)
    expect(pictured("application/zip")).toBe(false)
  })
})

describe("swapping the mark for what it stood for", () => {
  const mark = waiting("shot.png")

  test("puts the image where the mark was, wherever the mark has got to", () => {
    const text = `written after\n${mark}\nand before`

    expect(swapped(text, mark, "<img />")).toBe("written after\n<img />\nand before")
  })

  test("takes the mark out where GitHub would not have the file", () => {
    expect(swapped(`one\n${mark}`, mark, "")).toBe("one\n")
  })

  test("does nothing where the reader has deleted the mark themselves", () => {
    expect(swapped("nothing of the kind", mark, "<img />")).toBeUndefined()
  })

  test("swaps the first of two marks, which is the one that landed", () => {
    const two = `${waiting("a.png")}\n${waiting("a.png", 1)}`

    expect(swapped(two, waiting("a.png"), "<img />")).toBe(`<img />\n${waiting("a.png", 1)}`)
  })
})
