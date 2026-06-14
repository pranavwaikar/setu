#!/usr/bin/env bash
# install.sh — Setu CLI installer for Linux and macOS
# Usage: curl -fsSL <INSTALL_URL> | bash
set -euo pipefail

GITHUB_OWNER="${GITHUB_OWNER:-pranavwaikar}"
GITHUB_REPO="${GITHUB_REPO:-setu}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="setu"

# ─── helpers ──────────────────────────────────────────────────────────────────

say()  { printf "\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
err()  { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; exit 1; }
warn() { printf "\033[1;33m⚠ %s\033[0m\n" "$*" >&2; }

need_cmd() {
  if ! command -v "$1" &>/dev/null; then
    err "Required command not found: $1 — please install it and try again."
  fi
}

# ─── detect platform ──────────────────────────────────────────────────────────

detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux"  ;;
    Darwin*) echo "darwin" ;;
    *)       err "Unsupported OS: $(uname -s)" ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *) err "Unsupported architecture: $(uname -m)" ;;
  esac
}

# ─── fetch latest release tag ─────────────────────────────────────────────────

latest_tag() {
  need_cmd curl
  curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest" \
  | grep '"tag_name"' \
  | sed 's/.*"tag_name": *"\([^"]*\)".*/\1/'
}

# ─── main ─────────────────────────────────────────────────────────────────────

main() {
  need_cmd curl
  need_cmd tar
  need_cmd sha256sum || need_cmd shasum  # macOS uses shasum

  OS=$(detect_os)
  ARCH=$(detect_arch)
  TAG=$(latest_tag)

  if [ -z "$TAG" ]; then
    err "Could not determine latest release tag. Check your internet connection."
  fi

  ARCHIVE="setu_${OS}_${ARCH}.tar.gz"
  BASE_URL="https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/${TAG}"
  ARCHIVE_URL="${BASE_URL}/${ARCHIVE}"
  CHECKSUM_URL="${BASE_URL}/checksums.txt"

  say "Installing Setu ${TAG} (${OS}/${ARCH})"

  TMP_DIR=$(mktemp -d)
  trap 'rm -rf "$TMP_DIR"' EXIT

  # Download archive
  say "Downloading ${ARCHIVE}..."
  curl -fsSL --progress-bar -o "${TMP_DIR}/${ARCHIVE}" "${ARCHIVE_URL}" \
    || err "Download failed: ${ARCHIVE_URL}"

  # Download and verify checksum
  say "Verifying checksum..."
  curl -fsSL -o "${TMP_DIR}/checksums.txt" "${CHECKSUM_URL}" \
    || warn "Could not download checksums.txt — skipping verification."

  if [ -f "${TMP_DIR}/checksums.txt" ]; then
    cd "$TMP_DIR"
    if command -v sha256sum &>/dev/null; then
      grep "${ARCHIVE}" checksums.txt | sha256sum --check --status \
        || err "Checksum verification FAILED — aborting installation."
    else
      # macOS / BSD
      EXPECTED=$(grep "${ARCHIVE}" checksums.txt | awk '{print $1}')
      ACTUAL=$(shasum -a 256 "${ARCHIVE}" | awk '{print $1}')
      [ "$EXPECTED" = "$ACTUAL" ] \
        || err "Checksum verification FAILED — aborting installation."
    fi
    ok "Checksum verified."
    cd - >/dev/null
  fi

  # Extract
  say "Extracting..."
  tar -xzf "${TMP_DIR}/${ARCHIVE}" -C "${TMP_DIR}"

  BINARY="${TMP_DIR}/${BINARY_NAME}"
  if [ ! -f "$BINARY" ]; then
    # GoReleaser may nest inside a subdirectory
    BINARY=$(find "$TMP_DIR" -name "${BINARY_NAME}" -type f | head -1)
  fi
  [ -f "$BINARY" ] || err "Binary not found in archive."
  chmod +x "$BINARY"

  # Install
  say "Installing to ${INSTALL_DIR}/${BINARY_NAME}..."
  if [ -w "$INSTALL_DIR" ]; then
    mv "$BINARY" "${INSTALL_DIR}/${BINARY_NAME}"
  else
    sudo mv "$BINARY" "${INSTALL_DIR}/${BINARY_NAME}" \
      || err "Failed to install — try running with sudo or set INSTALL_DIR to a writable path."
  fi

  ok "Setu ${TAG} installed at ${INSTALL_DIR}/${BINARY_NAME}"
  printf "\nRun:\n  setu version\n  setu doctor\n\n"
}

main "$@"
