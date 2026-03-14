#!/bin/sh
if [[ -z "./username.txt" ]]; then
    echo "Expected username.txt to exist in the current directory. Exiting..."
    exit 1
fi
docker build -f docker/Dockerfile -t native-minecraft-server .