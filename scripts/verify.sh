#!/usr/bin/env bash
# verify.sh — Post-install verification for Setu CLI
set -euo pipefail

BINARY="${1:-setu}"

pass() { printf "\033[1;32m✔ %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$*" >&2; FAILED=1; }

FAILED=0

echo ""
echo "Setu CLI — Installation Verification"
echo "─────────────────────────────────────"

# 1. Binary exists and is executable
if command -v "$BINARY" &>/dev/null; then
  pass "Binary found: $(command -v "$BINARY")"
else
  fail "Binary not found in PATH: $BINARY"
fi

# 2. Version command works
if "$BINARY" version &>/dev/null 2>&1; then
  VERSION=$("$BINARY" version 2>&1 | head -3)
  pass "Version command works"
  echo "    $VERSION" | sed 's/^/    /'
else
  fail "Version command failed"
fi

# 3. Help works
if "$BINARY" --help &>/dev/null 2>&1; then
  pass "Help command works"
else
  fail "Help command failed"
fi

# 4. Doctor runs without crash
if "$BINARY" doctor &>/dev/null 2>&1; then
  pass "Doctor command exits cleanly"
else
  fail "Doctor command crashed"
fi

echo "─────────────────────────────────────"
if [ "$FAILED" -eq 0 ]; then
  echo -e "\033[1;32mAll checks passed!\033[0m"
  exit 0
else
  echo -e "\033[1;31mSome checks failed — see above.\033[0m" >&2
  exit 1
fi
