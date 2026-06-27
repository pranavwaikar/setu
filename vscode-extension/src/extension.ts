import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import * as https from 'https';
import { spawn, ChildProcess } from 'child_process';

interface PortMapping {
    subdomain: string;
    port: string;
}

interface SetuConfig {
    api_key?: string;
    gateway?: string;
    port_mappings?: PortMapping[];
}

export function activate(context: vscode.ExtensionContext) {
    const activeTunnels = new Map<string, ChildProcess>();
    const outputChannel = vscode.window.createOutputChannel("Setu Tunnels");

    // Tunnels Tree Data Provider
    const treeDataProvider = new TunnelTreeProvider(activeTunnels);
    vscode.window.registerTreeDataProvider('setu-tunnels-view', treeDataProvider);

    // Initialize context state
    function updateLoginContext() {
        const homedir = os.homedir();
        const configPath = path.join(homedir, '.setu', 'config.json');
        let loggedIn = false;
        if (fs.existsSync(configPath)) {
            try {
                const data = fs.readFileSync(configPath, 'utf8');
                const config: SetuConfig = JSON.parse(data);
                if (config.api_key && config.api_key.trim().length > 0) {
                    loggedIn = true;
                }
            } catch (e) { }
        }
        vscode.commands.executeCommand('setContext', 'setu.isLoggedIn', loggedIn);
    }
    updateLoginContext();

    // Status Bar Item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'setu.refreshTunnels';
    statusBarItem.tooltip = 'Setu Tunnels Status';
    updateStatusBar(statusBarItem, activeTunnels);
    context.subscriptions.push(statusBarItem);

    // Helper to start a tunnel process
    function startTunnelProcess(subdomain: string, port: string) {
        if (activeTunnels.has(subdomain)) {
            vscode.window.showWarningMessage(`Tunnel for subdomain '${subdomain}' is already active.`);
            return;
        }

        outputChannel.appendLine(`[INFO] Starting tunnel: ${subdomain} -> localhost:${port}`);

        // Spawn "setu expose <port> --subdomain <subdomain>"
        const child = spawn('setu', ['expose', port, '--subdomain', subdomain], {
            shell: true,
            env: { ...process.env }
        });

        child.stdout.on('data', (data) => {
            const output = data.toString();
            outputChannel.append(output);
        });

        child.stderr.on('data', (data) => {
            const output = data.toString();
            outputChannel.append(`[ERROR] ${output}`);
        });

        child.on('close', (code) => {
            outputChannel.appendLine(`[INFO] Tunnel process for '${subdomain}' exited with code ${code}`);
            activeTunnels.delete(subdomain);
            treeDataProvider.refresh();
            updateStatusBar(statusBarItem, activeTunnels);
        });

        activeTunnels.set(subdomain, child);
        treeDataProvider.refresh();
        updateStatusBar(statusBarItem, activeTunnels);

        const url = `https://${subdomain}.setu.helios-logic.com`;
        // Auto-open traffic inspector by default
        vscode.commands.executeCommand('setu.openInspector');

        vscode.window.showInformationMessage(`Tunnel active: ${url}`, 'Open URL').then(selection => {
            if (selection === 'Open URL') {
                vscode.env.openExternal(vscode.Uri.parse(url));
            }
        });
    }

    // Command: Start Tunnel
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.startTunnel', (item: TunnelItem) => {
            if (!item || item.isPlaceholder) {
                return;
            }
            startTunnelProcess(item.mapping.subdomain, item.mapping.port);
        })
    );

    // Command: Stop Tunnel
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.stopTunnel', (item: TunnelItem) => {
            if (!item || item.isPlaceholder) {
                return;
            }
            const child = activeTunnels.get(item.mapping.subdomain);
            if (child) {
                outputChannel.appendLine(`[INFO] Stopping tunnel for subdomain '${item.mapping.subdomain}'`);
                // Kill process tree on macOS/Linux
                child.kill('SIGTERM');
                activeTunnels.delete(item.mapping.subdomain);
                treeDataProvider.refresh();
                updateStatusBar(statusBarItem, activeTunnels);
                vscode.window.showInformationMessage(`Stopped tunnel: ${item.mapping.subdomain}`);
            }
        })
    );

    // Command: Refresh List
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.refreshTunnels', () => {
            treeDataProvider.refresh();
            updateStatusBar(statusBarItem, activeTunnels);
            vscode.window.showInformationMessage('Setu tunnel list refreshed.');
        })
    );

    // Command: Expose active workspace port
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.exposeWorkspace', async () => {
            const port = await vscode.window.showInputBox({
                prompt: 'Enter local port to expose',
                placeHolder: '3000',
                value: '3000',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0 || num > 65535) {
                        return 'Please enter a valid port number (1-65535)';
                    }
                    return null;
                }
            });

            if (!port) return;

            const subdomain = await vscode.window.showInputBox({
                prompt: 'Enter desired subdomain (leave blank for random)',
                placeHolder: 'my-subdomain'
            });

            const finalSubdomain = subdomain ? subdomain.trim() : '';

            // If a subdomain is provided, update configuration in ~/.setu/config.json
            if (finalSubdomain) {
                saveMappingToConfig(finalSubdomain, port);
            }

            // Expose the port immediately
            startTunnelProcess(finalSubdomain || 'temp-tunnel-' + Math.floor(Math.random() * 10000), port);
        })
    );

    // Command: Open Traffic Inspector panel
    let inspectorPanel: vscode.WebviewPanel | undefined = undefined;
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.openInspector', () => {
            if (inspectorPanel) {
                inspectorPanel.reveal(vscode.ViewColumn.Active);
                return;
            }

            inspectorPanel = vscode.window.createWebviewPanel(
                'setuInspector',
                'Setu Traffic Inspector',
                vscode.ViewColumn.Active,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            inspectorPanel.onDidDispose(() => {
                inspectorPanel = undefined;
            }, null, context.subscriptions);

            const inspectHtmlPath = path.join(context.extensionPath, 'media', 'inspect.html');
            if (fs.existsSync(inspectHtmlPath)) {
                let html = fs.readFileSync(inspectHtmlPath, 'utf8');
                // Replace relative paths with absolute 127.0.0.1:4500 paths
                html = html.replace(/fetch\('\/inspect\/subdomains'\)/g, "fetch('http://127.0.0.1:4500/inspect/subdomains')");
                html = html.replace(/fetch\(`\/inspect\/replay/g, "fetch(`http://127.0.0.1:4500/inspect/replay");
                html = html.replace(/fetch\('\/inspect\/replay'/g, "fetch('http://127.0.0.1:4500/inspect/replay'");
                html = html.replace("const wsUrl = `${proto}//${window.location.host}/inspect/ws`;", "const wsUrl = `ws://127.0.0.1:4500/inspect/ws`;");

                // Add CSP meta tag after charset
                html = html.replace('<meta charset="UTF-8">', '<meta charset="UTF-8">\n    <meta http-equiv="Content-Security-Policy" content="default-src * \'unsafe-inline\' \'unsafe-eval\'; img-src * data:; media-src *; frame-src *; connect-src *;">');

                inspectorPanel.webview.html = html;
            } else {
                inspectorPanel.webview.html = `<h3>Error: inspect.html not found under media directory</h3>`;
            }
        })
    );

    // Command: Login to Account
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.login', async () => {
            let gateway = await vscode.window.showInputBox({
                prompt: 'Enter Setu gateway/website URL',
                value: 'setu.helios-logic.com',
                placeHolder: 'setu.helios-logic.com'
            });

            if (!gateway) return;
            let cleanGateway = gateway.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');

            const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Setu API Key',
                placeHolder: 'sk_...',
                password: true
            });

            if (!apiKey) return;
            const trimmedKey = apiKey.trim();

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Validating API Key with gateway...",
                cancellable: false
            }, async (progress) => {
                const result = await validateApiKeyWithGateway(cleanGateway, trimmedKey);
                if (result.valid) {
                    const homedir = os.homedir();
                    const configDir = path.join(homedir, '.setu');
                    const configPath = path.join(configDir, 'config.json');

                    try {
                        if (!fs.existsSync(configDir)) {
                            fs.mkdirSync(configDir, { recursive: true });
                        }

                        let config: SetuConfig = {};
                        if (fs.existsSync(configPath)) {
                            const data = fs.readFileSync(configPath, 'utf8');
                            config = JSON.parse(data);
                        }

                        config.api_key = trimmedKey;
                        config.gateway = cleanGateway;
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');

                        treeDataProvider.refresh();
                        updateLoginContext();
                        vscode.window.showInformationMessage(
                            `Setu: Logged in successfully as ${result.firstName || ''} ${result.lastName || ''} (${result.email || ''})!`
                        );
                    } catch (e) {
                        vscode.window.showErrorMessage(`Failed to save config: ${e}`);
                    }
                } else {
                    vscode.window.showErrorMessage(`Setu login failed: ${result.error}`);
                }
            });
        })
    );

    // Command: Logout
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.logout', async () => {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to log out of Setu?',
                'Yes',
                'No'
            );

            if (confirm !== 'Yes') return;

            const homedir = os.homedir();
            const configPath = path.join(homedir, '.setu', 'config.json');

            if (fs.existsSync(configPath)) {
                try {
                    const data = fs.readFileSync(configPath, 'utf8');
                    const config: SetuConfig = JSON.parse(data);
                    config.api_key = '';
                    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
                    treeDataProvider.refresh();
                    updateLoginContext();
                    vscode.window.showInformationMessage('Setu: Logged out successfully.');
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to clear API key: ${e}`);
                }
            } else {
                vscode.window.showInformationMessage('Setu: Already logged out.');
            }
        })
    );

    // Command: Add Port Mapping
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.addMapping', async () => {
            const subdomain = await vscode.window.showInputBox({
                prompt: 'Enter subdomain to claim (e.g. my-app)',
                placeHolder: 'my-app',
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Subdomain is required';
                    }
                    if (!/^[a-z0-9-]+$/.test(value.trim())) {
                        return 'Subdomain can only contain lowercase letters, numbers, and dashes';
                    }
                    return null;
                }
            });

            if (!subdomain) return;

            const port = await vscode.window.showInputBox({
                prompt: 'Enter local port to map (e.g. 3000)',
                placeHolder: '3000',
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0 || num > 65535) {
                        return 'Please enter a valid port number (1-65535)';
                    }
                    return null;
                }
            });

            if (!port) return;

            saveMappingToConfig(subdomain.trim(), port.trim());
            treeDataProvider.refresh();
            vscode.window.showInformationMessage(`Setu: Added port mapping for ${subdomain.trim()}`);
        })
    );

    // Command: Edit Port Mapping
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.editMapping', async (item: TunnelItem) => {
            if (!item || item.isPlaceholder) return;

            const port = await vscode.window.showInputBox({
                prompt: `Enter new local port for subdomain '${item.mapping.subdomain}'`,
                placeHolder: item.mapping.port,
                value: item.mapping.port,
                validateInput: (value) => {
                    const num = parseInt(value);
                    if (isNaN(num) || num <= 0 || num > 65535) {
                        return 'Please enter a valid port number (1-65535)';
                    }
                    return null;
                }
            });

            if (!port) return;

            saveMappingToConfig(item.mapping.subdomain, port.trim());
            treeDataProvider.refresh();
            vscode.window.showInformationMessage(`Setu: Updated port mapping for ${item.mapping.subdomain}`);
        })
    );

    // Command: Delete Port Mapping
    context.subscriptions.push(
        vscode.commands.registerCommand('setu.deleteMapping', async (item: TunnelItem) => {
            if (!item || item.isPlaceholder) return;

            const confirm = await vscode.window.showWarningMessage(
                `Are you sure you want to delete the mapping for ${item.mapping.subdomain}?`,
                'Yes',
                'No'
            );

            if (confirm !== 'Yes') return;

            const homedir = os.homedir();
            const configPath = path.join(homedir, '.setu', 'config.json');

            if (fs.existsSync(configPath)) {
                try {
                    const data = fs.readFileSync(configPath, 'utf8');
                    const config: SetuConfig = JSON.parse(data);
                    if (config.port_mappings) {
                        config.port_mappings = config.port_mappings.filter(m => m.subdomain !== item.mapping.subdomain);
                        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
                        treeDataProvider.refresh();
                        vscode.window.showInformationMessage(`Setu: Deleted port mapping for ${item.mapping.subdomain}`);
                    }
                } catch (e) {
                    vscode.window.showErrorMessage(`Failed to delete mapping: ${e}`);
                }
            }
        })
    );
}

export function deactivate() { }

function updateStatusBar(statusBarItem: vscode.StatusBarItem, activeTunnels: Map<string, ChildProcess>) {
    const count = activeTunnels.size;
    if (count > 0) {
        statusBarItem.text = `$(plug) Setu: ${count} Active`;
        statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        statusBarItem.show();
    } else {
        statusBarItem.text = `$(plug) Setu: Off`;
        statusBarItem.backgroundColor = undefined;
        statusBarItem.show();
    }
}

function saveMappingToConfig(subdomain: string, port: string) {
    const homedir = os.homedir();
    const configDir = path.join(homedir, '.setu');
    const configPath = path.join(configDir, 'config.json');

    try {
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        let config: SetuConfig = {};
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(data);
        }

        if (!config.port_mappings) {
            config.port_mappings = [];
        }

        // Remove duplicates
        config.port_mappings = config.port_mappings.filter(m => m.subdomain !== subdomain);

        config.port_mappings.push({ subdomain, port });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {
        console.error("Failed to save mapping to config.json:", e);
    }
}

class TunnelTreeProvider implements vscode.TreeDataProvider<TunnelItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TunnelItem | undefined | null | void> = new vscode.EventEmitter<TunnelItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TunnelItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private activeTunnels: Map<string, ChildProcess>) { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: TunnelItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TunnelItem): Thenable<TunnelItem[]> {
        if (element) {
            return Promise.resolve([]);
        }

        const config = this.loadConfig();
        if (!config || !config.api_key) {
            return Promise.resolve([
                new TunnelItem(
                    "Not logged in",
                    "Click the Key icon to login",
                    vscode.TreeItemCollapsibleState.None,
                    { subdomain: '', port: '' },
                    false,
                    true
                )
            ]);
        }

        if (!config.port_mappings || config.port_mappings.length === 0) {
            return Promise.resolve([
                new TunnelItem(
                    "No active mappings",
                    "Click the + icon to add a mapping",
                    vscode.TreeItemCollapsibleState.None,
                    { subdomain: '', port: '' },
                    false,
                    true
                )
            ]);
        }

        const items = config.port_mappings.map(mapping => {
            const isConnected = this.activeTunnels.has(mapping.subdomain);
            return new TunnelItem(
                `${mapping.subdomain}.${config.gateway || 'setu.helios-logic.com'}`,
                `→ localhost:${mapping.port}`,
                vscode.TreeItemCollapsibleState.None,
                mapping,
                isConnected
            );
        });

        return Promise.resolve(items);
    }

    private loadConfig(): SetuConfig | null {
        const homedir = os.homedir();
        const configPath = path.join(homedir, '.setu', 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const data = fs.readFileSync(configPath, 'utf8');
                return JSON.parse(data);
            } catch (e) {
                console.error("Failed to parse config:", e);
            }
        }
        return null;
    }
}

class TunnelItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly mapping: PortMapping,
        public readonly isConnected: boolean,
        public readonly isPlaceholder: boolean = false
    ) {
        super(label, collapsibleState);
        this.tooltip = `${this.label} ${this.description}`;
        this.contextValue = isPlaceholder ? 'placeholder' : (isConnected ? 'connected' : 'disconnected');

        if (!isPlaceholder) {
            this.iconPath = isConnected
                ? new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'))
                : new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconQueued'));
        }
    }
}

function validateApiKeyWithGateway(gateway: string, apiKey: string): Promise<{ valid: boolean; email?: string; firstName?: string; lastName?: string; error?: string }> {
    return new Promise((resolve) => {
        const scheme = gateway === 'setu.helios-logic.com' ? 'https' : 'http';
        const url = `${scheme}://${gateway}/api/auth/me`;
        const client = scheme === 'https' ? https : http;

        const req = client.get(url, {
            headers: {
                'X-API-Key': apiKey
            },
            timeout: 5000
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const user = JSON.parse(data);
                        resolve({
                            valid: true,
                            email: user.email,
                            firstName: user.firstName,
                            lastName: user.lastName
                        });
                    } catch (e) {
                        resolve({ valid: false, error: 'Failed to parse response JSON' });
                    }
                } else {
                    resolve({ valid: false, error: `Server returned status code ${res.statusCode}` });
                }
            });
        });

        req.on('error', (err) => {
            resolve({ valid: false, error: err.message });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ valid: false, error: 'Request timed out' });
        });
    });
}

