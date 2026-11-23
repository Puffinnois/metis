#!/bin/bash
# Samples the memory of the app running on a profile every 5 s until it exits: the resident memory of
# every process whose command line names the profile, summed, and the largest single process (the
# main one). Writes one line a sample to <out>, and the peaks at the end.
# usage: scripts/lib/sample-memory.sh <profile dir> <out file>
profile="$1"
out="$2"
: > "$out"
peak_total=0
peak_main=0
seen=0
while true; do
  # ps lists every process with its resident set in KiB; keep those whose arguments name the profile,
  # leaving out this script's own pipeline (ps, awk), which names it too.
  read -r total main < <(ps -eo rss=,args= | awk -v p="user-data-dir=$profile" '
    index($0, p) && $0 !~ /sample-memory|awk / { t += $1; if ($1 > m) m = $1 }
    END { printf "%d %d\n", t, m }')
  if [ "${total:-0}" -gt 0 ]; then
    seen=1
    [ "$total" -gt "$peak_total" ] && peak_total=$total
    [ "$main" -gt "$peak_main" ] && peak_main=$main
    echo "$(date +%s) $total $main" >> "$out"
  elif [ "$seen" = 1 ]; then
    break
  fi
  sleep 5
done
printf 'peak_total_gb %.2f\npeak_main_gb %.2f\n' "$(echo "$peak_total / 1048576" | bc -l)" "$(echo "$peak_main / 1048576" | bc -l)" >> "$out"
