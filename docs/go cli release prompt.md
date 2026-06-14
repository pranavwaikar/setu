Build a complete release and distribution system for my Go CLI application named `setu`.

## Context

I already have a working Go CLI binary called `setu`.

The goal is to allow users to install and update Setu from GitHub Releases.

I do NOT have a fixed domain yet.

The solution must work entirely using GitHub Releases first and allow a custom domain to be added later without major changes.

## Requirements

### Repository Structure

Create all necessary files and folders.

```text
.
├── .github/
│   └── workflows/
│       └── release.yml
├── scripts/
│   ├── install.sh
│   ├── install.ps1
│   └── verify.sh
├── .goreleaser.yaml
├── Makefile
├── README.md
└── cmd/
```

---

## GitHub Actions

Create a GitHub Actions workflow that:

1. Runs on version tags

Example:

```bash
git tag v1.0.0
git push origin v1.0.0
```

2. Builds binaries for:

* linux/amd64
* linux/arm64
* darwin/amd64
* darwin/arm64
* windows/amd64

3. Generates:

* archives
* checksums

4. Creates a GitHub Release automatically

5. Uploads all artifacts to the release

---

## GoReleaser

Create a production-ready `.goreleaser.yaml`.

Requirements:

* Build all target platforms
* Generate SHA256 checksums
* Create GitHub Releases
* Include version metadata

Binary name:

```text
setu
```

Version command:

```bash
setu version
```

Must display:

```text
Version
Commit
Build Date
```

using ldflags.

---

## Installer Scripts

Create:

### Linux/macOS

```bash
scripts/install.sh
```

Features:

* Detect operating system
* Detect architecture
* Download latest release from GitHub
* Verify checksum
* Install into:

```text
/usr/local/bin
```

* Gracefully handle unsupported systems

Users should be able to run:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | bash
```

---

### Windows

Create:

```powershell
scripts/install.ps1
```

Features:

* Detect architecture
* Download latest release
* Verify checksum
* Add executable to PATH if needed

---

## Self Update System

Implement:

```bash
setu update
```

Behavior:

1. Check latest GitHub release.
2. Compare current version.
3. Download matching binary.
4. Verify checksum.
5. Replace executable safely.
6. Roll back if update fails.

Requirements:

* Cross-platform
* No third-party update service
* Use GitHub Releases API

---

## Doctor Command

Implement:

```bash
setu doctor
```

Output:

```text
Version
OS
Architecture
Executable Path
GitHub Connectivity
Update Availability
```

---

## Makefile

Create targets:

```bash
make build
make test
make release
make install
make lint
```

---

## Version Package

Create an internal package:

```text
internal/version
```

Expose:

```go
Version
Commit
BuildDate
```

Use ldflags during release builds.

---

## README

Generate a professional README including:

### Installation

Linux/macOS

```bash
curl -fsSL <INSTALL_URL> | bash
```

For now use a placeholder variable:

```text
INSTALL_URL
```

because I do not own a domain yet.

### Manual Download

Explain downloading binaries from GitHub Releases.

### Updating

```bash
setu update
```

### Diagnostics

```bash
setu doctor
```

### Version

```bash
setu version
```

---

## Configuration

Do NOT hardcode:

* domains
* URLs
* repository owner

Use environment variables or constants.

Example:

```env
GITHUB_OWNER=
GITHUB_REPO=
```

The codebase should be reusable even if the repository is renamed.

---

## Code Quality

Requirements:

* Idiomatic Go
* Go 1.24+
* Cobra commands
* Unit tests for update logic
* Structured logging
* Error handling
* Cross-platform support

Produce all code, configuration files, GitHub workflows, scripts, and documentation needed for a fully working GitHub Releases based distribution system.
