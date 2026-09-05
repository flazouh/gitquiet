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
# The read is six clips, one per beat, joined with short gaps so the picture
# can cut 0.3s ahead of each clip. Re-running shifts clip lengths slightly;
# the beat lengths in Day.tsx were cut to the clips this produced on
# 2026-09-06 (gitquiet-notes, research/hook-cut.md has the timeline).
set -euo pipefail

[ -n "${ELEVENLABS_API_KEY:-}" ] || { echo "ELEVENLABS_API_KEY is not set" >&2; exit 1; }
cd "$(dirname "$0")/.."
WORK=$(mktemp -d)

echo "music: quiet minimal electronic, instrumental"
curl -sf -X POST "https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{
    "prompt": "Calm minimal electronic for a developer tool launch video. Unhurried beat around 104 BPM, warm analog keys, soft bass, quiet confidence. Starts sparse, gentle lift at 8 seconds, settles, clean resolved ending on the last two seconds. Modern, precise, restrained. No vocals.",
    "music_length_ms": 94000,
    "model_id": "music_v1",
    "force_instrumental": true
  }' --output "$WORK/music.mp3"

# The API ignores music_length_ms; cut to the picture's 70.94s with a fade
# so the track ends with the picture instead of mid-phrase.
ffmpeg -y -v error -i "$WORK/music.mp3" -t 70.94 \
  -af "afade=t=out:st=68.2:d=2.7" video/public/music.mp3
echo "wrote video/public/music.mp3 (70.94s)"

# Mark: ElevenLabs' conversational voice, Alex's pick 2026-09-04. The v3
# endpoint rejects previous_text/next_text, so each clip stands alone.
VOICE_ID=UgBBYS2sOqTuMpoF3BR0
BEATS=(
  "So there's this box on GitHub. Hide whitespace. You tick it, open the next PR, it's unticked again. Every single PR. Nine hundred and twenty nine upvotes on that."
  "So I built this."
  "Here it's a setting. You flip it once, and it stays that way."
  "You leave a review comment, someone pushes a commit on that line, and it drops out of Files changed. The rest are collapsed, so find in page can't see them. Here, every unresolved thread sits above the diff. New commit, still there. And find in page works, it's real text."
  "And the one I started with. Nothing on a GitHub page tells you if it needs you. So everything you're part of lands in one list, and only the top group, Needs You, wants anything from you."
  "It runs on the GitHub URLs you already use. Your team sees normal GitHub. You can't comment on an untouched line yet. It's free and open source, Chrome, Firefox and Safari. So yeah guys, would love to have your feedback on this!"
)
# Silence before each clip, then a tail. Serial, because parallel calls 429.
GAPS=(1.0 0.6 1.2 1.0 1.0 1.0)
TAIL=2.5
INPUTS=()
for i in "${!BEATS[@]}"; do
  BODY=$(python3 -c 'import json,sys;print(json.dumps({"text":sys.argv[1],"model_id":"eleven_v3_conversational","voice_settings":{"stability":0.35,"similarity_boost":0.75,"style":0.32}}))' "${BEATS[$i]}")
  for attempt in 1 2 3 4; do
    if curl -sf -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE_ID?output_format=mp3_44100_128" \
      -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
      -d "$BODY" --output "$WORK/clip-$i.mp3"; then
      echo "clip $i: $(ffprobe -v error -show_entries format=duration -of csv=p=0 "$WORK/clip-$i.mp3")s"
      break
    fi
    [ "$attempt" = 4 ] && { echo "clip $i failed four times" >&2; exit 1; }
    sleep $((attempt * 4))
  done
  INPUTS+=(-f lavfi -t "${GAPS[$i]}" -i anullsrc=r=44100:cl=mono -i "$WORK/clip-$i.mp3")
done
INPUTS+=(-f lavfi -t "$TAIL" -i anullsrc=r=44100:cl=mono)
N=$(( ${#BEATS[@]} * 2 + 1 ))
STREAMS=$(for ((k = 0; k < N; k++)); do printf '[%d]' "$k"; done)
ffmpeg -y -v error "${INPUTS[@]}" \
  -filter_complex "${STREAMS}concat=n=$N:v=0:a=1,aformat=sample_rates=44100:channel_layouts=mono[a]" \
  -map "[a]" -b:a 128k video/public/vo.mp3
echo "wrote video/public/vo.mp3 ($(ffprobe -v error -show_entries format=duration -of csv=p=0 video/public/vo.mp3)s)"
rm -rf "$WORK"
