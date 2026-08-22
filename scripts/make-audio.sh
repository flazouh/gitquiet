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

echo "music: 30s, quiet minimal electronic, instrumental"
curl -sf -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "prompt": "Calm minimal electronic for a developer tool launch video. Unhurried beat around 104 BPM, warm analog keys, soft bass, quiet confidence. Starts sparse, gentle lift at 8 seconds, settles, clean resolved ending on the last two seconds. Modern, precise, restrained. No vocals.",
    "music_length_ms": 30000,
    "model_id": "music_v1",
    "force_instrumental": true
  }' --output video/public/music.mp3
echo "wrote video/public/music.mp3 ($(stat -f%z video/public/music.mp3) bytes)"

VOICE_ID=$(curl -sf "https://api.elevenlabs.io/v1/voices" -H "xi-api-key: $ELEVENLABS_API_KEY" \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['voices'][0]['voice_id'])")
echo "voice-over: voice $VOICE_ID"
curl -sf -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "text": "Less to hold in your head. GitQuiet, the fastest and quietest way to work on GitHub. Everything you are in, one list. Rest on a row, and it reads ahead. Press, and it is readable in two hundred eighty seven milliseconds. One list, four groups. Only the first asks anything of you. Every unresolved thread, above the diff. When CI fails, it opens on the line that broke. The rest settles on its own. GitQuiet. Free on Chrome.",
    "model_id": "eleven_multilingual_v2"
  }' --output video/public/vo.mp3
echo "wrote video/public/vo.mp3 ($(stat -f%z video/public/vo.mp3) bytes)"
