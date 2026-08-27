#!/usr/bin/env bash
# Music and voice-over for video/src/Day.tsx (the Release composition), via ElevenLabs.
#
# Needs ELEVENLABS_API_KEY in the environment. The composition mounts the two
# files only when they exist, so this script is the whole difference between
# the silent cut and the finished one:
#
#     ELEVENLABS_API_KEY=... scripts/make-audio.sh
#     cd video && bunx remotion render Release out/release.mp4 --scale=1.5
#
# Endpoints are the ones documented in the local music skill's api reference;
# the voice for the VO is whichever voice the account lists first, so no voice
# id is hard-coded here.
set -euo pipefail

[ -n "${ELEVENLABS_API_KEY:-}" ] || { echo "ELEVENLABS_API_KEY is not set" >&2; exit 1; }
cd "$(dirname "$0")/.."

echo "music: ~94s, quiet minimal electronic, instrumental"
curl -sf -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "prompt": "Calm minimal electronic for a developer tool launch video. Unhurried beat around 104 BPM, warm analog keys, soft bass, quiet confidence. Starts sparse, gentle lift at 8 seconds, settles, clean resolved ending on the last two seconds. Modern, precise, restrained. No vocals.",
    "music_length_ms": 94000,
    "model_id": "music_v1",
    "force_instrumental": true
  }' --output video/public/music.mp3
echo "wrote video/public/music.mp3 ($(stat -f%z video/public/music.mp3) bytes)"

# The API ignores music_length_ms and returns ~48s; cut to the video's 29.5s
# with a fade so the track ends with the picture instead of mid-phrase.
ffmpeg -y -v error -i video/public/music.mp3 -t 92.04 \
  -af "afade=t=out:st=89.3:d=2.7" video/public/music-cut.mp3
mv video/public/music-cut.mp3 video/public/music.mp3
echo "trimmed music to 29.53s with a fade"

# Alice: ElevenLabs' British English educator voice. Alex's pick 2026-08-27.
# The shipped cut was generated through /with-timestamps so the picture could
# be cut to her sentences; re-running this script shifts timings slightly.
VOICE_ID=Xb7hH8MSUJpSbSDYk0k2
echo "voice-over: voice $VOICE_ID (Alice)"
curl -sf -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "text": "This is GitHub. It'\''s where your work lives, and it can be a frustrating place to work. One pull request is spread across four separate tabs. And the heavy pages are slow. GitHub'\''s own engineering blog measures them in whole seconds. Introducing GitQuiet. A faster, quieter GitHub. In GitQuiet, everything you'\''re part of arrives in one list, separated into four groups: Needs You, Waiting, Running, and Settled. Only the first group asks anything of you. The others are there so you can stop checking them. When you rest on a row, GitQuiet reads the pull request ahead. Press it, and it'\''s readable in two hundred and eighty-seven milliseconds. Here'\''s a pull request. The description sits in a card, and everything owed to you sits in one rail. Files are shown next to their diffs. The conversation is compact, and unresolved threads stay above the diff, so nothing gets lost when new commits arrive. Your verdict and the merge controls live in one place, and GitQuiet remembers what you'\''ve seen. When a check fails, the run opens on the line that broke. Issues, commits, actions, and the inbox all use the same four groups. There'\''s no account and no server. GitQuiet uses your own GitHub session, and your code stays in your browser. GitQuiet. Free on Chrome. gitquiet dot com.",
    "model_id": "eleven_multilingual_v2"
  }' --output video/public/vo.mp3
echo "wrote video/public/vo.mp3 ($(stat -f%z video/public/vo.mp3) bytes)"
