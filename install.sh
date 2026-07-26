#!/bin/sh
# OptMem installer. Run it again to update: it only replaces the tool, and
# `memo init` never touches memories that already exist.
#
#   curl -fsSL https://raw.githubusercontent.com/VictorTaelin/OptMem/main/install.sh | sh

set -e
DIR="$HOME/.optmem"
SRC="https://raw.githubusercontent.com/VictorTaelin/OptMem/main"

mkdir -p "$DIR"
for f in memo blocks.py; do
  curl -fsSL "$SRC/$f" -o "$DIR/$f.new"
  mv "$DIR/$f.new" "$DIR/$f"
done
chmod +x "$DIR/memo"

exec "$DIR/memo" init
