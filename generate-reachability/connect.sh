#!/usr/bin/env bash
MINECRAFT_USERNAME="$1"
ARGS="$(node ping-wait.js)"
readonly MINECRAFT_USERNAME ARGS

echo "Server started up, connecting"
node connect_server.js $ARGS "$MINECRAFT_USERNAME"
