#!/usr/bin/env bash
# Music and voice-over for video/src/Release.tsx, via ElevenLabs.
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

echo "music: 26s, energetic minimal electronic, instrumental"
curl -sf -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "prompt": "Energetic minimal electronic for a developer tool launch video. Clean driving beat around 122 BPM, warm analog synth bass, crisp hats. Starts sparse, builds at 4 seconds, full groove through the middle, clean resolved ending on the last two seconds. Modern, precise, confident. No vocals.",
    "music_length_ms": 26000,
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
    "text": "GitHub keeps showing you the page you just left. Same pull request, same click. GitQuiet is readable in under three hundred milliseconds. GitQuiet. The fastest and quietest way to work on GitHub. Everything you are in, one list. The first group is what needs you. Every unresolved thread, above the diff. And when CI fails, it opens on the line that broke. Free on Chrome. gitquiet dot com.",
    "model_id": "eleven_multilingual_v2"
  }' --output video/public/vo.mp3
echo "wrote video/public/vo.mp3 ($(stat -f%z video/public/vo.mp3) bytes)"
