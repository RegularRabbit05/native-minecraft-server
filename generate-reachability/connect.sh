#!/usr/bin/env bash
args="$(node ping-wait.js)"
echo "Server started up, connecting"
node connect_server.js $args
