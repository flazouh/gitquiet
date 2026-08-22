# Release video reference: Base44

The reference Alex picked: https://www.youtube.com/watch?v=FXLmWojBELE — 50s.
Studied frame by frame (20 samples at 2.5s intervals) plus the full caption
track. Re-download for study with:

    yt-dlp --extractor-args "youtube:player_client=android" \
      -f "b[height<=720]" --write-auto-subs --sub-langs en \
      -o "base44.%(ext)s" "https://www.youtube.com/watch?v=FXLmWojBELE"

## What it actually does

**One continuous story, not a feature list.** The whole video builds a single
fictional product — "trailride", a bike renting app — and every beat advances
that one build: prompt typed → app blooms → integrations → GitHub push →
an NPM library dropped in → security → one-click deploy. The features are
chapters of one story, so there is no enumeration feel.

**The user's own action starts it.** After a four-word hook, the first thing
that happens is a prompt being typed into a composer. The product answers.
Cause and effect, not montage.

**Two worlds alternate.** Warm cream scenes (#efece4-ish) and near-black
charcoal scenes trade off roughly every other beat. The rhythm of light/dark
is what reads as pace, more than any single transition.

**Cinematic inserts between UI beats.** Real photographic footage — a rider on
a trail with the app's route line composited onto the landscape, a macro 3D
render of a derailleur — as domain metaphors. They are what makes it feel like
a film rather than a screen tour. Roughly 20% of runtime.

**Transitions are colour washes.** Frames melt into soft orange/pastel blur
washes rather than cutting. (GitQuiet's pastel BED gradient is practically
this exact device already — brand-true adaptation is free.)

**UI floats as objects.** No browser chrome anywhere. Cards fan out in a
collage, the full app sits slightly angled on cream or on blurred photo
backgrounds, a phone mock floats centered. Desktop and mobile mix.

**Type moments are tiny and kinetic.** "Build apps" between animated code
glyphs (/ < > *), a typed "→ gi|" with a live caret on dark, a code editor
close-up with syntax colours typing itself.

**VO is short imperative bursts** timed to scene turns, ~6 words each:
"Prompted. Foundation set. Structure's good to go." … "Ready? Deploy in one
click with full control and zero compromise. Base 44, build it your way."

**CTA is small.** A modest button-styled "Build it" on cream. No giant end card.

## The grammar, extracted

1. ~50s, scene turnover every 2.5–3.5s, nothing holds longer than 4s.
2. One example threaded through everything; features are its chapters.
3. Light/dark world alternation carries the energy.
4. Domain-metaphor footage between UI beats (not UI, not text — film).
5. Colour-wash transitions in the brand palette.
6. UI always chrome-less, floating, slightly dimensional.
7. VO in imperative fragments; name spoken twice (open + close).
8. One accent colour on the UI beats; product logo colour reserved for lockups.

## Mapping to GitQuiet (a starting point, not a script)

The one-example thread: a single pull request's day — it lands in Needs You,
opened in 287ms, everything unresolved above the diff, CI fails and opens on
the line that broke, settled. The four groups are the chapters.

The two worlds already exist: the near-black page (#121212) and the pastel
BED. The wash-transition device is the BED gradient itself. The metaphor
inserts are the open question — "quiet" and "fast" both film well, and this
is where the fresh eye should spend its taste.
