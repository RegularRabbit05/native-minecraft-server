#!/usr/bin/env bash
ARGS="$(node ping-wait.js)"
readonly ARGS

echo "Server started up, connecting"
node connect_server.js $ARGS
