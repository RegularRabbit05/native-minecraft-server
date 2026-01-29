#!/usr/bin/env bash
if [[ -z "${GRAALVM_HOME:-}" ]]; then
    echo "\$GRAALVM_HOME is not set. Please provide a GraalVM installation. Exiting..."
    exit 1
fi

if [[ ! -x "$(which node)" ]]; then
    echo "node is not found on path. Please install node.js. Exiting..."
    exit 1
fi

if [[ ! -x "$(which npm)" ]]; then
    echo "npm is not found on path. Please install node.js and npm. Exiting..."
    exit 1
fi

npm i

PATH="$GRAALVM_HOME/bin:$PATH"
./connect.sh &

CONNECT_PID="$!"
readonly CONNECT_PID

java -agentlib:native-image-agent=config-output-dir=reachability-config --enable-native-access=ALL-UNNAMED -jar ../build/server.jar -nogui &

SERVER_PID="$!"
readonly SERVER_PID

trap "echo 'Terminated'; kill -SIGTERM \"$SERVER_PID\"; kill -SIGTERM \"$CONNECT_PID\"; exit" SIGTERM # Clean up if ^C happens before this finishes

wait "$CONNECT_PID"

sleep 1

# Send SIGTERM to the server
if [ -n "$SERVER_PID" ]; then
    kill -SIGTERM "$SERVER_PID"
    echo "Sent SIGTERM to the minecraft server"
else
    echo "the minecraft server is not running, did it crash?"
fi