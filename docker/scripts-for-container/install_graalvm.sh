#!/bin/sh

GRAALVM_VERSION="$1"

eval "$(cat "$(dirname $0)/env.sh")"

ARCH=""
case "$(uname -m)" in
    x86_64)
        ARCH="x64" 
        ;;
    aarch64)
        ARCH="aarch64"
        ;;
    *)
        echo "Unsupported processor arch"
        exit 1
        ;;
esac

mkdir -p "${INSTALLATION_BASE}" # -p here because it is ok if any version exists
mkdir "${INSTALL_DIR}" # No -p because we don't want it to be ok if we overwrite a version

BIN_TAR_FILE="${INSTALL_DIR}/bin.tar.gz"
echo "Downloading graalvm ${GRAALVM_VERSION}" >&2

curl -o "${BIN_TAR_FILE}" "https://download.oracle.com/graalvm/${GRAALVM_VERSION}/latest/graalvm-jdk-${GRAALVM_VERSION}_linux-${ARCH}_bin.tar.gz"

echo "Extracting graalvm ${GRAALVM_VERSION}" >&2

mkdir "${INSTALL_DIR}/tmp"

tar -zxvf "${BIN_TAR_FILE}" -C "${INSTALL_DIR}/tmp"

mv "${INSTALL_DIR}/tmp"/*/* "${INSTALL_DIR}"

echo "Deleting download of graalvm ${GRAALVM_VERSION}" >&2

rm "${BIN_TAR_FILE}"

"${SHDIR}/set_default_graalvm_version.sh" "${GRAALVM_VERSION}"