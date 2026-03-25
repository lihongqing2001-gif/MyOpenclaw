#!/bin/bash
set -euo pipefail

SRC="$HOME/Desktop"
DST="/Volumes/For Win/99_Archive/Unsorted"
INDEX="/Volumes/For Win/structure-index.txt"

if [ ! -d "$DST" ]; then
  /usr/bin/printf "Archive skipped: destination not available (%s)\n" "$DST"
  exit 0
fi

shopt -s nullglob

DATE_SUFFIX=$(/bin/date +%Y%m%d)

for item in "$SRC"/*; do
  name=$(basename "$item")
  if [ "$name" = ".DS_Store" ] || [ "$name" = ".localized" ]; then
    continue
  fi

  target="$DST/$name"
  if [ -e "$target" ]; then
    target="$DST/${name}_${DATE_SUFFIX}"
    if [ -e "$target" ]; then
      i=1
      while [ -e "${target}_$i" ]; do
        i=$((i + 1))
      done
      target="${target}_$i"
    fi
  fi

  if [ -d "$item" ]; then
    /usr/bin/rsync -a --remove-source-files --no-perms --no-owner --no-group --omit-dir-times --no-times "$item/" "$target/"
    /usr/bin/find "$item" -type d -empty -delete
    /bin/rmdir "$item" 2>/dev/null || true
  else
    /bin/mv "$item" "$target"
  fi
  /usr/bin/printf "Moved: %s -> %s\n" "$item" "$target"
  done

find "/Volumes/For Win" -maxdepth 4 -mindepth 1 -type d \
  \( -path "*/.Spotlight-V100" -o -path "*/.TemporaryItems" -o -path "*/.Trashes" -o -path "*/.fseventsd" -o -path "*/$RECYCLE.BIN" \) -prune -o -type d -print > "$INDEX"

/usr/bin/printf "Updated index: %s\n" "$INDEX"
