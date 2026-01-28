#!/usr/bin/env bash
if [[ -z "${GRAALVM_HOME:-}" ]]; then
    echo "\$GRAALVM_HOME is not set. Please provide a GraalVM installation. Exiting..."
    exit 1
fi

PATH="$GRAALVM_HOME/bin:$PATH"
./connect.sh &

connectPid="$!"
java -agentlib:native-image-agent=config-output-dir=reflection-config --enable-native-access=ALL-UNNAMED -jar ../build/server.jar -nogui &

serverPid="$!"
trap "echo 'Terminated'; kill -SIGTERM \"$serverPid\"; kill -SIGTERM \"$connectPid\"; exit" SIGTERM # Clean up if ^C happens before this finishes
wait "$connectPid"

sleep 1

# Send SIGTERM to the server
if [ -n "$serverPid" ]; then
    kill -SIGTERM "$serverPid"
    echo "Sent SIGTERM to the minecraft server"
else
    echo "the minecraft server is not running, did it crash?"
fi