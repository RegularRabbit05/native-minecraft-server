# Needs buildkit
FROM debian:13 AS build
ENV GRAALVM_VERSION=25

COPY ./docker/scripts-for-container /scripts

COPY ./docker/apk.js /workspace/apk.js

RUN apt -y update && apt install -y cmake nodejs npm git jq curl musl-dev musl-tools unzip  && \
    cd /workspace/apk.js && \
    npm i --include prod && \
    files="$(node index.js fetch --deps --debfile zlib-static | grep -oP "(?<=Deb package file: ).*?(?=')")" && \
    dpkg -i $files && \
    ln -s /usr/lib/libz.a /usr/lib/x86_64-linux-musl/libz.a 

# Install graalvm
RUN chmod +x /scripts/* && \
    /scripts/install_graalvm.sh "${GRAALVM_VERSION}"
# Grab the repository
COPY . /workspace/native-minecraft-server 

# Build into native statically linked executable
RUN --mount=type=bind,source=./cache/profiles,target=/workspace/native-minecraft-server/generate-reachability/profiles,ro=false \
    --mount=type=bind,source=./username.txt,target=/workspace/username.txt \
    export MINECRAFT_USERNAME="$(cat /workspace/username.txt)" && \
    cd /workspace/native-minecraft-server && \
    GRAALVM_HOME="/graalvm-installs/default" PATH="/graalvm-installs/default/bin:$PATH" bash ./build.sh --static --libc=musl

FROM scratch
COPY --from=build /workspace/native-minecraft-server/native-minecraft-server /bin/native-minecraft-server
CMD ["/bin/native-minecraft-server"]