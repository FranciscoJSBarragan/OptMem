#!/bin/sh
# OptMem installer. Run it again to update: it only replaces the tool, and
# `memo init` never touches memories that already exist.
#
#   curl -fsSL https://raw.githubusercontent.com/VictorTaelin/OptMem/main/install.sh | sh

set -e
DIR="$HOME/.optmem"

mkdir -p "$DIR"
curl -fsSL https://raw.githubusercontent.com/VictorTaelin/OptMem/main/memo -o "$DIR/memo.new"
mv "$DIR/memo.new" "$DIR/memo"
chmod +x "$DIR/memo"

exec "$DIR/memo" init
