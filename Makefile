BINARY_NAME := setu
BUILD_DIR   := dist
CLI_DIR     := cli
MODULE      := github.com/pranavwaikar/setu/cli

# Version metadata (overridden by GoReleaser in CI)
VERSION     := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT      := $(shell git rev-parse --short HEAD 2>/dev/null || echo "none")
BUILD_DATE  := $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

LDFLAGS := -s -w \
  -X $(MODULE)/internal/version.Version=$(VERSION) \
  -X $(MODULE)/internal/version.Commit=$(COMMIT) \
  -X $(MODULE)/internal/version.BuildDate=$(BUILD_DATE)

.PHONY: build test release install lint clean help

## build: Compile a local development binary
build:
	@echo "==> Building $(BINARY_NAME) $(VERSION)..."
	@cd $(CLI_DIR) && go build -ldflags "$(LDFLAGS)" -o ../$(BINARY_NAME) .
	@echo "    Binary: ./$(BINARY_NAME)"

## test: Run all unit tests
test:
	@echo "==> Running tests..."
	@cd $(CLI_DIR) && go test -v -race ./...

## lint: Run golangci-lint (requires golangci-lint in PATH)
lint:
	@echo "==> Linting..."
	@cd $(CLI_DIR) && golangci-lint run ./...

## install: Build and install setu to /usr/local/bin
install: build
	@echo "==> Installing to /usr/local/bin/$(BINARY_NAME)..."
	@install -m 0755 $(BINARY_NAME) /usr/local/bin/$(BINARY_NAME)
	@echo "    Installed."

## release: Run GoReleaser locally (snapshot, no publish)
release:
	@echo "==> Running GoReleaser snapshot..."
	@goreleaser release --snapshot --clean

## clean: Remove build artifacts
clean:
	@echo "==> Cleaning..."
	@rm -f $(BINARY_NAME)
	@rm -rf $(BUILD_DIR)

## help: Print available make targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //' | column -t -s ':'
