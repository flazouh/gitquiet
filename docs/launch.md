# Launch copy

Every piece here is cut from `README.md` rather than written fresh, so the site,
the store listing and the posts say the same thing to anyone who clicks through.

## What the numbers may say

Measured 2026-08-16 on `microsoft/vscode`, signed in, medians. Reproduce with
`scripts/benchmark-click-flow.js`, after disabling every copy of the extension in
`chrome://extensions`.

| Flow | GitHub | GitQuiet |
| --- | --- | --- |
| press a row, rested on it first | 2132ms | 67ms to the DOM, 287ms to pixels |
| press a row, no rest | 2138ms | 1635ms |
| open by URL, to a diff | 3999ms | 2922ms |

Quote 287ms, not 67ms. 67ms is when the condition is met in the DOM and 287ms is
when the page is on the screen, and the recording can be held to 287. Never quote
either without saying the reader rested on the row: most of the gap is the
prefetch, and the cold case is half a second rather than thirty times.

## Assets

| File | Size | Where |
| --- | --- | --- |
| `Launch` | 1080x1350, 18s | X, first post |
| `Courts` | 1080x1350, 15s | X, second post |
| `Race` | 1920x1080, 3.5s | HN, Reddit |
| `site/public/store/working-set.png` | 1280x800 | Reddit image posts |

`Launch` is the race and the Working Set in one piece. They shipped separately
first, and the race alone ran 3.6s, which is a third of the shortest launch
video measured: the six worth copying ran 17 to 48 seconds, and the one that
reached eight million views ran 23. A clip that short loops before it is read.

`RaceTall` still builds and is the race on its own, for anywhere that wants it
without the second half.

```bash
cd video && bunx remotion render Launch out/launch.mp4
```

---

## The release video

`Release` is the flagship: 26s, six beats, remocn components on the site's own
palette, one accent (the mark's purple) spent on the landed 287, the punched
heading and the CTA. Composed at remocn's 1280x720 standard.

```bash
cd video && bunx remotion render Release out/release.mp4 --scale=1.5
```

It renders silent until the audio exists. `ELEVENLABS_API_KEY=...
scripts/make-audio.sh` writes `video/public/music.mp3` (26s instrumental) and
`video/public/vo.mp3` (the voice-over below), then re-render. The key never
touches the repo.

Voice-over script, timed to the beats:

> GitHub keeps showing you the page you just left. Same pull request, same
> click. GitQuiet is readable in under three hundred milliseconds. GitQuiet.
> The fastest and quietest way to work on GitHub. Everything you are in, one
> list. The first group is what needs you. Every unresolved thread, above the
> diff. And when CI fails, it opens on the line that broke. Free on Chrome.
> gitquiet dot com.

## Show HN

Tuesday to Thursday, 08:00 to 10:00 ET. Not the weekend.

**Title**

```
Show HN: GitQuiet, a different place to do your GitHub work
```

**Body**

```
Hi HN. GitQuiet is the fastest and quietest way to work on GitHub. There is
no account and no server of mine: it uses the GitHub session you already have,
and your code and reviews stay in your browser. Every review, comment and merge
goes back through GitHub, so a colleague who has never installed it sees your
work exactly as usual.

GitHub splits a pull request by record type: Conversation, Commits, Checks,
Files. None of those four tabs answers the question you opened it with, so you
read all of them and work it out again on the next visit. GitQuiet is its own
interface on the same data. Everything you are in arrives in one list, in four
groups that every screen uses: Needs You, Waiting, Running, Settled.

It also reads a pull request ahead when the pointer rests on its row. Resting
for a moment and then pressing opens it in about 290ms against GitHub's 2100ms
on microsoft/vscode. Pressing with no rest is about 1600ms against 2100ms, so
most of that gap is the prefetch rather than the rendering, and I would rather
say so than have somebody find it. The benchmark scripts and the medians are in
the repo.

Source, the four groups and every screen it opens on are in the README. Happy
to answer anything.
```

The first paragraph is the privacy answer on purpose. Across three comparable
threads, the top comment on a GitHub tool was always about who gets access to
the code, and the closest 2026 comparison, Better Hub, was buried at 38 points
mostly on that.

---

## r/SideProject

Same day as the Show HN. Image post, `working-set.png`, body as the first
comment if the form will not take both.

**Title**

```
I built a different place to do my GitHub work, and the first group is what needs me
```

**Body**

```
GitHub splits a pull request by record type: Conversation, Commits, Checks,
Files. None of those four tabs answers the question you opened it with, so you
read all of them and work it out again on the next visit.

GitQuiet is its own interface on the same data. Everything you are in arrives in
one list, in four groups:

- Needs You: you can act on it now
- Waiting: someone else has to act
- Running: a machine is still working
- Settled: finished

It opens on the URLs you already use, in Primer tokens and Octicons, so it
follows whichever theme you have. Their header, nav and repository tabs are left
exactly as they are.

No account and no server of mine. It uses the GitHub session you already have,
and your code and reviews stay in your browser.

Chrome: https://chromewebstore.google.com/detail/gitquiet/ichobjnihnofjkpoegikjhefmoekaahe
Site: https://gitquiet.com
```

---

## r/chrome_extensions

Same day, same image, different title so the two do not read as one crosspost.

**Title**

```
A Chrome extension that gives GitHub pull request review its own interface
```

Body as above.

---

## X thread

Five posts, two videos. The replies are not footnotes: on the closest
comparable each self-reply pulled twenty to thirty thousand views of its own.
Answer every real reply after that, which is where the long tail comes from.

**Post 1**, `RaceTall`

```
Introducing GitQuiet

GitQuiet is the fastest and quietest way to work on GitHub.

- Every PR you're in, in one list: Needs You / Waiting / Running / Settled
- Opens on the URLs you already use, and in its own window soon
- No account, no server. Your own GitHub session

gitquiet.com
```

**Post 2**, `Courts`

```
Every pull request you are in, from every repository, on one screen.

Needs You is the only one of the four that asks anything of you. The other
three are there so you can stop checking them.
```

**Post 3**, text

```
No account and no server of mine.

It uses the GitHub session you already have. Your code and your reviews stay
in your browser, and every review, comment and merge goes back through GitHub,
so a colleague who has never installed it sees your work exactly as usual.
```

**Post 4**, image, the screens grid from the README

```
It is not one screen. Pull requests, issues, commits, checks, runs, repository
home, and the rest.
```

**Post 5**, text

```
It's open source, AGPL. The benchmark scripts are in there too, including the
one that says the speed only holds when you rest on the row first.

github.com/flazouh/gitquiet
```

---

## r/webdev

Saturday only, and the next window is 2026-08-22. Set the **Showoff Saturday**
flair and keep it out of the title: every post carrying the prefix on the day I
checked sat at 0 or 1 point, and none of the year's top ten used it.

Worth holding until the HN thread has given you a line to quote.

**Title**

```
I built somewhere else to do my GitHub work, around one question: does this need me?
```

Body as r/SideProject.

---

## Not to do

- r/programming bans "I Made This" project posts outright.
- r/github sends self-promotion to a pinned megathread.
- Do not lead anywhere with the cold number. It is real and it is unremarkable,
  and putting both numbers in a headline invites the reader to average them.
