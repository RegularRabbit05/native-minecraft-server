#!/bin/sh

GRAALVM_VERSION="$1"

eval "$(cat "$(dirname $0)/env.sh")"

echo "Updating default graalvm version to ${GRAALVM_VERSION}" >&2

ln -sf "${INSTALL_DIR}" "${DEFAULT_INSTALL_SYMLINK}"