set -eu
export SHDIR="$(dirname $0)"
export INSTALLATION_BASE="/graalvm-installs"
export INSTALL_DIR="${INSTALLATION_BASE}/${GRAALVM_VERSION}"

export DEFAULT_INSTALL_SYMLINK="${INSTALLATION_BASE}/default"