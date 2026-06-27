# Setu VS Code Extension

Expose local servers to the internet with secure public URLs, manage active tunnels, and inspect HTTP traffic directly from VS Code.

## Features

- **Tunnels Sidebar Panel**: Manage your tunnel mappings directly from the VS Code Activity Bar. Click Start/Stop inline actions on configured subdomains.
- **Expose Port Action**: Run the `Setu: Expose Active Port` command to quickly spin up a tunnel on any port and automatically save it to your config.
- **Embedded Traffic Inspector**: Launch the `Setu: Open Traffic Inspector` command to open the real-time HTTP traffic dashboard inside a native editor panel, featuring Request/Response inspection and **Edit & Replay**.
- **Tunnels Status Bar**: Visual status bar item displaying the number of active tunnels.

## Prerequisites

- **Setu CLI**: Make sure you have installed the CLI command:
  ```bash
  curl -fsSL https://raw.githubusercontent.com/pranavwaikar/setu/main/scripts/install.sh | bash
  ```

## Development and Verification

### 1. Build
Inside the `vscode-extension` directory, install dependencies and compile the TypeScript code:
```bash
npm install
npm run compile
```

### 2. Run / Test
1. Open this workspace in VS Code.
2. Open the file `vscode-extension/src/extension.ts`.
3. Press `F5` (or click `Run and Debug` -> `Run Extension`).
4. This spawns a new **Extension Development Host** window where the extension is loaded.
5. Check the **Activity Bar** for the **Setu Tunnels** icon ⚡.
