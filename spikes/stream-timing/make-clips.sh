#!/bin/sh
# Builds the spike's placeholder clips as HLS ladders (issue #4). Not the Seed Collection.
#
#   FFMPEG=/path/to/ffmpeg sh make-clips.sh [vp9|h264]
#
# vp9 (default) plays in open-source Chromium, which has no H.264; h264 matches what Cloudflare
# Stream delivers and plays in Chrome, Safari and Firefox. Each clip is 60 s at 30 fps with a
# keyframe every 2 s, three renditions, 2 s fMP4 segments, and a test tone so audio is present.
set -eu
FFMPEG="${FFMPEG:-ffmpeg}"
CODEC="${1:-vp9}"
OUT="$(dirname "$0")/media/$CODEC"

if [ "$CODEC" = "h264" ]; then
  VIDEO="-c:v libx264 -preset veryfast -profile:v high -pix_fmt yuv420p"
  AUDIO="-c:a aac -b:a 96k"
else
  VIDEO="-c:v libvpx-vp9 -deadline realtime -cpu-used 8 -row-mt 1 -pix_fmt yuv420p"
  AUDIO="-c:a libopus -b:a 96k"
fi

clip() {
  name="$1"; width="$2"; height="$3"
  dir="$OUT/$name"
  rm -rf "$dir"; mkdir -p "$dir"
  # Three renditions: about a third, half and full size, with bitrates around a 1.5 Mbps link.
  # shellcheck disable=SC2086
  "$FFMPEG" -hide_banner -loglevel error -y \
    -f lavfi -i "testsrc2=size=${width}x${height}:rate=30:duration=60" \
    -f lavfi -i "sine=frequency=440:sample_rate=48000:duration=60" \
    -filter_complex "[0:v]split=3[a][b][c];[a]scale=w=iw/3:h=ih/3[v0];[b]scale=w=iw/2:h=ih/2[v1];[c]null[v2]" \
    -map "[v0]" -map "[v1]" -map "[v2]" -map 1:a \
    $VIDEO -g 60 -keyint_min 60 -sc_threshold 0 \
    -b:v:0 350k -maxrate:v:0 400k -bufsize:v:0 800k \
    -b:v:1 800k -maxrate:v:1 900k -bufsize:v:1 1800k \
    -b:v:2 1800k -maxrate:v:2 2000k -bufsize:v:2 4000k \
    $AUDIO \
    -f hls -hls_time 2 -hls_playlist_type vod -hls_segment_type fmp4 \
    -hls_segment_filename "$dir/%v/seg%03d.m4s" -hls_fmp4_init_filename init.mp4 \
    -master_pl_name master.m3u8 \
    -var_stream_map "v:0,agroup:aud,name:low v:1,agroup:aud,name:mid v:2,agroup:aud,name:high a:0,agroup:aud,name:audio,default:yes" \
    "$dir/%v/index.m3u8"
  echo "built $dir/master.m3u8"
}

clip landscape 1280 720
clip vertical 720 1280
