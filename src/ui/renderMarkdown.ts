import MarkdownIt from "markdown-it"

/**
 * Markdown as everyone else renders it.
 *
 * CommonMark plus tables and strikethrough, which is what a README is written
 * in, from the library that defines the reference implementation of it rather
 * than from a handful of regular expressions of our own.
 *
 * Raw HTML in the source is printed, not run. This text comes from a branch
 * anyone can open a pull request from, and the one thing a diff viewer must
 * never do is execute the diff.
 */
const renderer = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  typographer: false
})

export const renderMarkdown = (text: string): string => renderer.render(text)
