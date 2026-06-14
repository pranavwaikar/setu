// Package version holds build-time version metadata injected via ldflags.
package version

// These variables are set at build time via -ldflags.
// Example:
//
//	go build -ldflags "-X github.com/pranavwaikar/setu/cli/internal/version.Version=v1.2.3 \
//	  -X github.com/pranavwaikar/setu/cli/internal/version.Commit=abc1234 \
//	  -X github.com/pranavwaikar/setu/cli/internal/version.BuildDate=2024-01-01T00:00:00Z"
var (
	Version   = "dev"
	Commit    = "none"
	BuildDate = "unknown"
)
