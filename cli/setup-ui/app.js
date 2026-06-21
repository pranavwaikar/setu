let config = { api_key: "", gateway: "", port_mappings: [] };
let claimedSubdomains = [];
let userFirstName = "";
let userLastName = "";

// WebSocket and traffic states
let ws;
let subdomainTransactions = {}; // subdomain -> [tx1, tx2, ...]
let selectedTxIds = {}; // subdomain -> txId
let tunnelStates = {}; // subdomain -> { active: true/false, port: "" }
let activeTabs = {}; // subdomain -> 'req' or 'resp'

async function init() {
    try {
        // Fetch config from local Go server
        const configResp = await fetch('/api/config');
        if (configResp.ok) {
            config = await configResp.json();
            if (!config.port_mappings) config.port_mappings = [];
            document.getElementById('api-key-input').value = config.api_key || '';
            document.getElementById('gateway-input').value = config.gateway || config.tunnel_domain || 'setu.helios-logic.com';
            
            // Dynamically set dashboard link
            const dashboardLink = document.getElementById('dashboard-link');
            if (dashboardLink && config.dashboard_url) {
                dashboardLink.href = config.dashboard_url;
                dashboardLink.innerText = config.dashboard_url;
            }
            
            updateSubdomainSuffix();
        }
        
        await fetchTunnelStatus();
        await updateStatus();
        connectWS();
    } catch (err) {
        showToast("Failed to initialize setup panel", "error");
    }
}

async function fetchTunnelStatus() {
    try {
        const resp = await fetch('/api/tunnels/status');
        if (resp.ok) {
            const data = await resp.json();
            tunnelStates = data.tunnels || {};
        }
    } catch (err) {
        console.error("Failed to fetch tunnel status", err);
    }
}

function connectWS() {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${proto}//${window.location.host}/inspect/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log("WebSocket connected");
    };
    
    ws.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting...");
        setTimeout(connectWS, 2000);
    };
    
    ws.onmessage = (event) => {
        try {
            const tx = JSON.parse(event.data);
            if (tx.subdomain) {
                if (!subdomainTransactions[tx.subdomain]) {
                    subdomainTransactions[tx.subdomain] = [];
                }
                // Check if transaction already exists (avoid duplicates if replayed)
                const exists = subdomainTransactions[tx.subdomain].some(t => t.id === tx.id);
                if (!exists) {
                    subdomainTransactions[tx.subdomain].unshift(tx);
                    if (subdomainTransactions[tx.subdomain].length > 100) {
                        subdomainTransactions[tx.subdomain].pop();
                    }
                    // Re-render traffic panel if open
                    const panel = document.getElementById(`traffic-${tx.subdomain}`);
                    if (panel && panel.classList.contains('show')) {
                        renderTrafficList(tx.subdomain);
                    }
                }
            }
        } catch (e) {
            console.error("Error parsing WS message", e);
        }
    };
}

async function updateStatus() {
    const statusDot = document.getElementById('header-status-dot');
    const statusText = document.getElementById('header-status-text');

    if (!config.api_key) {
        statusDot.className = "status-dot";
        statusText.innerText = "Auth Required - API Key not set";
        renderSubdomainsEmpty("Please set up your API Key first");
        return;
    }

    try {
        // Test authentication & fetch subdomains
        const validationResp = await fetch('/api/validate-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: config.api_key })
        });

        if (validationResp.ok) {
            const validationResult = await validationResp.json();
            if (validationResult.valid) {
                statusDot.className = "status-dot active";
                statusText.innerText = 'Connected: ' + validationResult.email;
                userFirstName = validationResult.firstName || "";
                userLastName = validationResult.lastName || "";
                updateSubdomainSuffix();
                
                // Valid key, fetch subdomains
                await fetchSubdomains();
            } else {
                statusDot.className = "status-dot";
                statusText.innerText = "Invalid API Key";
                renderSubdomainsEmpty("Invalid API Key. Please verify in the Auth tab.");
            }
        } else {
            statusDot.className = "status-dot";
            statusText.innerText = "API Offline";
            renderSubdomainsEmpty("Unable to reach Setu API backend.");
        }
    } catch (err) {
        statusDot.className = "status-dot";
        statusText.innerText = "Network Error";
        renderSubdomainsEmpty("Network connection failed.");
    }
}

async function saveAuth() {
    const apiKeyInput = document.getElementById('api-key-input').value.trim();
    const gatewayInput = document.getElementById('gateway-input').value.trim() || "127.0.0.1:8080";
    
    const btn = document.getElementById('save-auth-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Validating...';
    btn.disabled = true;

    try {
        // First test validation with backend
        const validationResp = await fetch('/api/validate-key', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ api_key: apiKeyInput })
        });

        if (!validationResp.ok) {
            throw new Error("API validation failed");
        }

        const result = await validationResp.json();
        if (!result.valid) {
            showToast("Validation failed: " + (result.error || "Invalid API key"), "error");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // API Key is valid, now save locally
        config.api_key = apiKeyInput;
        config.gateway = gatewayInput;

        const saveResp = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });

        if (saveResp.ok) {
            showToast("Configurations successfully validated and saved!", "success");
            updateSubdomainSuffix();
            await updateStatus();
        } else {
            showToast("Failed to save configuration locally", "error");
        }
    } catch (err) {
        showToast("Failed to connect to backend api", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function fetchSubdomains() {
    try {
        const resp = await fetch('/api/subdomains');
        if (resp.ok) {
            claimedSubdomains = await resp.json();
            renderSubdomains();
        } else {
            renderSubdomainsEmpty("Failed to load subdomains from API server.");
        }
    } catch (err) {
        renderSubdomainsEmpty("Error fetching subdomains.");
    }
}

function getPublicDisplayURL(subdomain) {
    let cleanGateway = config.gateway || "127.0.0.1:8080";
    cleanGateway = cleanGateway.replace(/^(https?:\/\/|wss?:\/\/)/i, "");
    let parts = cleanGateway.split(":");
    let host = parts[0];
    
    let suffix = host;
    if (host === "127.0.0.1" || host === "localhost") {
        suffix = config.tunnel_domain || "setu.helios-logic.com";
    }
    return `${subdomain}.${suffix}`;
}

function getPublicLinkURL(subdomain) {
    let cleanGateway = config.gateway || "127.0.0.1:8080";
    cleanGateway = cleanGateway.replace(/^(https?:\/\/|wss?:\/\/)/i, "");
    let parts = cleanGateway.split(":");
    let host = parts[0];
    let port = parts[1];
    
    let portStr = port ? ":" + port : "";
    if (host === "127.0.0.1" || host === "localhost") {
        const suffix = config.tunnel_domain || "lvh.me";
        return `http://${subdomain}.${suffix}${portStr}`;
    }
    return `http://${subdomain}.${host}${portStr}`;
}

function renderSubdomains() {
    const container = document.getElementById('subdomains-container');
    const saveContainer = document.getElementById('save-mappings-container');
    
    if (claimedSubdomains.length === 0) {
        container.innerHTML = '<div class="empty-state">No claimed subdomains. Claim one above!</div>';
        if (saveContainer) saveContainer.style.display = 'none';
        return;
    }

    if (saveContainer) saveContainer.style.display = 'flex';

    container.innerHTML = '';
    claimedSubdomains.forEach(sub => {
        const item = document.createElement('div');
        item.className = 'subdomain-item';
        item.style.flexDirection = 'column';
        item.style.alignItems = 'stretch';
        item.style.gap = '1rem';

        const mapping = config.port_mappings.find(m => m.subdomain === sub.hostname);
        const currentPort = mapping ? mapping.port : '';

        const displayUrl = getPublicDisplayURL(sub.hostname);
        const linkUrl = getPublicLinkURL(sub.hostname);

        const tunnel = tunnelStates[sub.hostname];
        const isOnline = tunnel && tunnel.active;
        const activePort = tunnel ? tunnel.port : (currentPort || '');

        const statusBadge = isOnline 
            ? `<span class="status-badge-inline online"><span class="pulsing-dot"></span>Online</span>`
            : `<span class="status-badge-inline offline">Offline</span>`;

        const controlButton = isOnline
            ? `<button class="btn-stop-tunnel" onclick="stopTunnel('${sub.hostname}')" style="height: 38px; padding: 0 1rem;">Stop Tunnel</button>`
            : `<button class="btn-start-tunnel" onclick="startTunnel('${sub.hostname}')" style="height: 38px; padding: 0 1rem;">Start Tunnel</button>`;

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                <div class="url-section" style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 280px;">
                    <div class="item-info">
                        <span class="item-title" style="display: flex; align-items: center; gap: 0.5rem;">
                            <a href="${linkUrl}" target="_blank" class="subdomain-link">
                                ${displayUrl}
                            </a>
                            <button class="btn-copy-icon" onclick="copyToClipboard('${displayUrl}', this)" title="Copy URL">
                                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                            </button>
                            ${statusBadge}
                        </span>
                        <span class="item-subtitle">Claimed: ${new Date(sub.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                    <div class="port-input-group" style="display: flex; align-items: center; gap: 0.5rem;">
                        <label class="form-label" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">Local Port:</label>
                        <input type="number" class="form-input port-input" id="port-input-${sub.hostname}" data-subdomain="${sub.hostname}" value="${activePort}" placeholder="e.g. 3000" style="width: 90px; height: 38px; padding: 0.5rem 0.75rem;" ${isOnline ? 'disabled' : ''} oninput="onPortInput(this, '${sub.hostname}')">
                    </div>
                    ${controlButton}
                    <button class="btn-toggle-traffic" onclick="toggleTraffic('${sub.hostname}')" title="Inspect traffic">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                        Traffic
                    </button>
                    <button class="btn-toggle-traffic" onclick="openInspector()" title="Open Inspector in new tab" style="height: 38px; display: inline-flex; align-items: center; gap: 0.25rem;">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                        Open Inspector
                    </button>
                    <button class="btn-danger" onclick="releaseSubdomain('${sub.id}', '${sub.hostname}')" style="height: 38px; display: inline-flex; align-items: center;" ${isOnline ? 'disabled' : ''}>Release</button>
                </div>
            </div>

            <!-- COLLAPSIBLE TRAFFIC PANEL -->
            <div id="traffic-${sub.hostname}" class="traffic-panel">
                <div class="traffic-dashboard">
                    <div class="traffic-list-column">
                        <div class="traffic-list-header">
                            <span class="traffic-list-title">Live Streams</span>
                            <button class="btn-clear" onclick="clearSubdomainTraffic('${sub.hostname}')" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;">Clear</button>
                        </div>
                        <div id="traffic-list-items-${sub.hostname}" class="traffic-list-items">
                            <!-- Stream items -->
                        </div>
                    </div>
                    <div class="traffic-detail-column" id="traffic-detail-${sub.hostname}">
                        <!-- Selected transaction details -->
                    </div>
                </div>
            </div>
        `;
        container.appendChild(item);
    });
}

function renderSubdomainsEmpty(message) {
    claimedSubdomains = [];
    const container = document.getElementById('subdomains-container');
    container.innerHTML = '<div class="empty-state">' + message + '</div>';
    const saveContainer = document.getElementById('save-mappings-container');
    if (saveContainer) saveContainer.style.display = 'none';
}

async function startTunnel(subdomain) {
    const portInput = document.getElementById(`port-input-${subdomain}`);
    const port = portInput.value.trim();
    if (!port) {
        showToast("Please specify a port to start the tunnel", "error");
        return;
    }

    try {
        const resp = await fetch('/api/tunnels/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain, port })
        });
        if (resp.ok) {
            showToast(`Tunnel online: ${subdomain} -> ${port}`, "success");
            tunnelStates[subdomain] = { active: true, port };
            renderSubdomains();
            // Automatically expand traffic panel when tunnel starts
            toggleTraffic(subdomain, true);
        } else {
            showToast("Failed to start tunnel", "error");
        }
    } catch (err) {
        showToast("Network error starting tunnel", "error");
    }
}

async function stopTunnel(subdomain) {
    try {
        const resp = await fetch('/api/tunnels/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subdomain })
        });
        if (resp.ok) {
            showToast(`Tunnel stopped: ${subdomain}`, "success");
            tunnelStates[subdomain] = { active: false, port: "" };
            renderSubdomains();
        } else {
            showToast("Failed to stop tunnel", "error");
        }
    } catch (err) {
        showToast("Network error stopping tunnel", "error");
    }
}

function toggleTraffic(subdomain, forceOpen = false) {
    const panel = document.getElementById(`traffic-${subdomain}`);
    if (!panel) return;
    
    const isOpen = panel.classList.contains('show');
    
    // Close other panels
    document.querySelectorAll('.traffic-panel').forEach(p => {
        if (p.id !== `traffic-${subdomain}`) {
            p.classList.remove('show');
        }
    });

    if (forceOpen || !isOpen) {
        panel.classList.add('show');
        renderTrafficList(subdomain);
    } else {
        panel.classList.remove('show');
    }
}

function clearSubdomainTraffic(subdomain) {
    subdomainTransactions[subdomain] = [];
    selectedTxIds[subdomain] = null;
    renderTrafficList(subdomain);
}

function renderTrafficList(subdomain) {
    const listContainer = document.getElementById(`traffic-list-items-${subdomain}`);
    if (!listContainer) return;

    const txs = subdomainTransactions[subdomain] || [];
    if (txs.length === 0) {
        listContainer.innerHTML = '<div class="empty-state" style="font-size: 0.75rem; padding: 1.5rem 0.5rem;">Waiting for traffic...</div>';
        renderTrafficDetails(subdomain, null);
        return;
    }

    listContainer.innerHTML = '';
    const selectedId = selectedTxIds[subdomain];

    txs.forEach(tx => {
        const item = document.createElement('div');
        item.className = `traffic-item ${tx.id === selectedId ? 'selected' : ''}`;
        item.onclick = () => {
            selectedTxIds[subdomain] = tx.id;
            // Highlight item
            listContainer.querySelectorAll('.traffic-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            renderTrafficDetails(subdomain, tx);
        };

        const isSuccess = tx.resp_status >= 200 && tx.resp_status < 300;
        const isRedirect = tx.resp_status >= 300 && tx.resp_status < 400;
        const statusClass = isSuccess ? 'success' : (isRedirect ? 'redirect' : 'error');

        item.innerHTML = `
            <div class="traffic-item-meta">
                <span class="method-badge ${tx.method}">${tx.method}</span>
                <span class="status-code ${statusClass}">${tx.resp_status}</span>
            </div>
            <div class="traffic-item-path" title="${tx.path}">${tx.path}</div>
            <div class="traffic-item-time">${tx.timestamp}</div>
        `;
        listContainer.appendChild(item);
    });

    // Handle initial selection
    if (!selectedId && txs.length > 0) {
        selectedTxIds[subdomain] = txs[0].id;
        renderTrafficList(subdomain);
    } else {
        const currentTx = txs.find(t => t.id === selectedId);
        renderTrafficDetails(subdomain, currentTx || null);
    }
}

function renderTrafficDetails(subdomain, tx) {
    const detailsContainer = document.getElementById(`traffic-detail-${subdomain}`);
    if (!detailsContainer) return;

    if (!tx) {
        detailsContainer.innerHTML = `
            <div class="traffic-detail-empty">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="opacity: 0.3;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-.778.099-1.533.284-2.253" /></svg>
                <span>Select a stream to inspect</span>
            </div>
        `;
        return;
    }

    const currentTab = activeTabs[subdomain] || 'req';
    const isSuccess = tx.resp_status >= 200 && tx.resp_status < 300;
    const isRedirect = tx.resp_status >= 300 && tx.resp_status < 400;
    const statusClass = isSuccess ? 'success' : (isRedirect ? 'redirect' : 'error');

    detailsContainer.innerHTML = `
        <div class="traffic-detail-header">
            <div style="display: flex; align-items: center; gap: 0.35rem; overflow: hidden; max-width: 50%;">
                <span class="method-badge ${tx.method}">${tx.method}</span>
                <span class="status-code ${statusClass}">${tx.resp_status}</span>
                <span class="traffic-detail-url" title="${tx.url}">${tx.path}</span>
            </div>
            <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
                <button class="btn-secondary" onclick="copyCurl('${tx.id}', '${subdomain}', this)" style="font-size: 0.7rem; padding: 0.3rem 0.5rem; border-radius: 0.25rem; height: auto;">Copy cURL</button>
                <button class="btn-primary" onclick="replayRequest('${tx.id}', '${subdomain}')" style="font-size: 0.7rem; padding: 0.3rem 0.5rem; border-radius: 0.25rem; box-shadow: none; height: auto;">Replay</button>
                <button class="btn-secondary" onclick="openEditModal('${tx.id}', '${subdomain}')" style="font-size: 0.7rem; padding: 0.3rem 0.5rem; border-radius: 0.25rem; height: auto;">Edit & Replay</button>
            </div>
        </div>
        <div class="traffic-detail-content">
            <div class="traffic-detail-tabs">
                <button class="traffic-tab-btn ${currentTab === 'req' ? 'active' : ''}" onclick="switchTrafficTab('${subdomain}', 'req')">Request</button>
                <button class="traffic-tab-btn ${currentTab === 'resp' ? 'active' : ''}" onclick="switchTrafficTab('${subdomain}', 'resp')">Response</button>
            </div>
            
            <div class="traffic-tab-content ${currentTab === 'req' ? 'active' : ''}">
                <div class="section-title" style="margin-bottom: 0.25rem; font-size: 0.65rem;">Request Headers</div>
                <table class="headers-table">
                    ${renderHeadersTableHTML(tx.req_headers)}
                </table>
                <div class="section-title" style="margin-top: 0.5rem; margin-bottom: 0.25rem; font-size: 0.65rem;">Body Payload</div>
                ${renderBodyHTML(tx.req_body)}
            </div>

            <div class="traffic-tab-content ${currentTab === 'resp' ? 'active' : ''}">
                <div class="section-title" style="margin-bottom: 0.25rem; font-size: 0.65rem;">Response Headers</div>
                <table class="headers-table">
                    ${renderHeadersTableHTML(tx.resp_headers)}
                </table>
                <div class="section-title" style="margin-top: 0.5rem; margin-bottom: 0.25rem; font-size: 0.65rem;">Body Payload</div>
                ${renderBodyHTML(tx.resp_body)}
            </div>
        </div>
    `;
}

function renderHeadersTableHTML(headers) {
    if (!headers || Object.keys(headers).length === 0) {
        return '<tr><td class="empty-payload">No headers</td></tr>';
    }
    let html = '';
    for (const [name, values] of Object.entries(headers)) {
        html += `
            <tr>
                <td class="header-name">${name}</td>
                <td class="header-value">${values.join(', ')}</td>
            </tr>
        `;
    }
    return html;
}

function renderBodyHTML(body) {
    if (!body) {
        return '<span class="empty-payload">No body payload</span>';
    }
    try {
        const parsed = JSON.parse(body);
        const pretty = JSON.stringify(parsed, null, 2);
        return `<div class="payload-container">${escapeHtml(pretty)}</div>`;
    } catch (e) {
        return `<div class="payload-container">${escapeHtml(body)}</div>`;
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function switchTrafficTab(subdomain, tab) {
    activeTabs[subdomain] = tab;
    const txs = subdomainTransactions[subdomain] || [];
    const selectedId = selectedTxIds[subdomain];
    const currentTx = txs.find(t => t.id === selectedId);
    renderTrafficDetails(subdomain, currentTx || null);
}

function copyCurl(txId, subdomain, btnElement) {
    const txs = subdomainTransactions[subdomain] || [];
    const tx = txs.find(t => t.id === txId);
    if (!tx) return;

    let curl = `curl -X ${tx.method}`;
    if (tx.req_headers) {
        for (const [name, values] of Object.entries(tx.req_headers)) {
            values.forEach(val => {
                curl += ` -H "${name}: ${val.replace(/"/g, '\\"')}"`;
            });
        }
    }
    if (tx.req_body) {
        const escapedBody = tx.req_body
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n');
        curl += ` -d "${escapedBody}"`;
    }
    curl += ` "${tx.url}"`;

    navigator.clipboard.writeText(curl).then(() => {
        const origHTML = btnElement.innerHTML;
        btnElement.innerHTML = '✔ Copied!';
        setTimeout(() => {
            btnElement.innerHTML = origHTML;
        }, 2000);
    }).catch(err => {
        showToast("Failed to copy curl to clipboard", "error");
    });
}

async function replayRequest(txId, subdomain) {
    try {
        const response = await fetch(`/inspect/replay?id=${txId}`, {
            method: 'POST'
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showToast('Request replayed successfully!');
        } else {
            showToast(`Replay failed: ${result.error || response.statusText}`, "error");
        }
    } catch (err) {
        showToast(`Replay error: ${err.message}`, "error");
    }
}

function openEditModal(txId, subdomain) {
    const txs = subdomainTransactions[subdomain] || [];
    const tx = txs.find(t => t.id === txId);
    if (!tx) return;

    document.getElementById('edit-tx-id').value = txId;
    document.getElementById('edit-method').value = tx.method;
    document.getElementById('edit-path').value = tx.path;
    
    // Headers JSON
    document.getElementById('edit-headers').value = JSON.stringify(tx.req_headers || {}, null, 2);
    // Body
    document.getElementById('edit-body').value = tx.req_body || '';

    const modal = document.getElementById('edit-replay-modal');
    modal.style.display = 'flex';
    modal.classList.add('show');
}

function closeEditModal() {
    const modal = document.getElementById('edit-replay-modal');
    modal.style.display = 'none';
    modal.classList.remove('show');
}

async function sendCustomReplay() {
    const txId = document.getElementById('edit-tx-id').value;
    const method = document.getElementById('edit-method').value;
    const path = document.getElementById('edit-path').value.trim();
    const headersRaw = document.getElementById('edit-headers').value.trim();
    const body = document.getElementById('edit-body').value;

    let headers = {};
    if (headersRaw) {
        try {
            headers = JSON.parse(headersRaw);
        } catch (e) {
            showToast("Invalid JSON format in Headers field", "error");
            return;
        }
    }

    const payload = {
        id: txId,
        method: method,
        path: path,
        req_headers: headers,
        req_body: body
    };

    const btn = document.getElementById('btn-send-custom-replay');
    const originalText = btn.innerText;
    btn.innerText = 'Sending...';
    btn.disabled = true;

    try {
        const response = await fetch('/inspect/replay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showToast('Custom request sent successfully!');
            closeEditModal();
        } else {
            showToast(`Replay failed: ${result.error || response.statusText}`, "error");
        }
    } catch (err) {
        showToast(`Replay error: ${err.message}`, "error");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

async function claimSubdomain() {
    const input = document.getElementById('subdomain-claim-input');
    const hostname = input.value.trim().toLowerCase();
    if (!hostname) {
        showToast("Please enter a subdomain hostname", "error");
        return;
    }

    const btn = document.getElementById('claim-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
    btn.disabled = true;

    try {
        const resp = await fetch('/api/subdomains', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hostname })
        });

        if (resp.ok) {
            showToast("Subdomain successfully claimed!", "success");
            input.value = '';
            await fetchSubdomains();
        } else {
            const errData = await resp.json();
            showToast("Failed to claim: " + (errData.message || "Domain busy/reserved"), "error");
        }
    } catch (err) {
        showToast("Network error claiming subdomain", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function releaseSubdomain(id, hostname) {
    if (!confirm('Are you sure you want to release "' + hostname + '"? This will stop all active tunnels using it.')) {
        return;
    }

    try {
        const resp = await fetch('/api/subdomains/release?id=' + id, {
            method: 'DELETE'
        });

        if (resp.ok) {
            showToast("Subdomain released successfully", "success");
            
            // Remove any existing port mappings for this subdomain as well
            config.port_mappings = config.port_mappings.filter(m => m.subdomain !== hostname);
            await saveLocalConfig();
            
            await fetchSubdomains();
        } else {
            showToast("Failed to release subdomain", "error");
        }
    } catch (err) {
        showToast("Network error releasing subdomain", "error");
    }
}

function onPortInput(inputElement, subdomain) {
    // Port mappings can be updated inline.
}

async function saveAllMappings() {
    const inputs = document.querySelectorAll('.port-input');
    const newMappings = [];
    
    inputs.forEach(input => {
        const subdomain = input.getAttribute('data-subdomain');
        const port = input.value.trim();
        if (port) {
            newMappings.push({ subdomain, port });
        }
    });

    config.port_mappings = newMappings;

    const btn = document.getElementById('save-mappings-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Saving...';
    btn.disabled = true;

    try {
        const success = await saveLocalConfig();
        if (success) {
            showToast("Port mappings saved successfully!", "success");
        } else {
            showToast("Failed to save port mappings locally", "error");
        }
    } catch (err) {
        showToast("Error saving configurations", "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function saveLocalConfig() {
    try {
        const saveResp = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        return saveResp.ok;
    } catch (err) {
        return false;
    }
}

function switchTab(tabId) {
    // Remove active class from buttons & cards
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.card').forEach(card => card.classList.remove('active'));

    // Find current button & card
    let targetBtn;
    if (tabId === 'auth') targetBtn = document.querySelectorAll('.tab-btn')[0];
    else if (tabId === 'subdomains') targetBtn = document.querySelectorAll('.tab-btn')[1];

    if (targetBtn) {
        targetBtn.classList.add('active');
    }
    const cardEl = document.getElementById('card-' + tabId);
    if (cardEl) {
        cardEl.classList.add('active');
    }
}

function copyToClipboard(text, btnElement) {
    navigator.clipboard.writeText(text).then(() => {
        const origHTML = btnElement.innerHTML;
        btnElement.innerHTML = '✔';
        setTimeout(() => {
            btnElement.innerHTML = origHTML;
        }, 2000);
    }).catch(err => {
        showToast("Failed to copy URL to clipboard", "error");
    });
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    
    toast.className = 'toast ' + type;
    toastMsg.innerText = message;
    
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function updateSubdomainSuffix() {
    let cleanGateway = config.gateway || "127.0.0.1:8080";
    cleanGateway = cleanGateway.replace(/^(https?:\/\/|wss?:\/\/)/i, "");
    // Strip port if present
    let parts = cleanGateway.split(":");
    let host = parts[0];
    
    let suffix = "." + host;
    if (host === "127.0.0.1" || host === "localhost") {
        suffix = "." + (config.tunnel_domain || "setu.helios-logic.com");
    }
    
    const cleanFirst = userFirstName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const cleanLast = userLastName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const nameSuffix = [cleanFirst, cleanLast].filter(Boolean).join('-');
    const nameSuffixStr = nameSuffix ? `-${nameSuffix}` : '';
    
    const suffixSpan = document.getElementById("subdomain-suffix-span");
    if (suffixSpan) {
        suffixSpan.innerText = nameSuffixStr + suffix;
    }
}

// Initialize UI
init();

// Ping local server periodically to detect Ctrl+C shutdown
let isShuttingDown = false;
setInterval(async () => {
    if (isShuttingDown) return;
    try {
        const resp = await fetch('/api/config');
        if (!resp.ok) {
            showShutdownOverlay();
        }
    } catch (err) {
        showShutdownOverlay();
    }
}, 3000);

function showShutdownOverlay() {
    isShuttingDown = true;
    const overlay = document.getElementById('shutdown-overlay');
    if (overlay && overlay.style.display !== 'flex') {
        overlay.style.display = 'flex';
        setTimeout(() => {
            window.close();
        }, 500);
    }
}

async function saveAndExit() {
    isShuttingDown = true;
    try {
        // Collect current port mappings from inputs before saving
        const inputs = document.querySelectorAll('.port-input');
        const newMappings = [];
        inputs.forEach(input => {
            const subdomain = input.getAttribute('data-subdomain');
            const port = input.value.trim();
            if (port) {
                newMappings.push({ subdomain, port });
            }
        });
        config.port_mappings = newMappings;

        await saveLocalConfig();
        showToast("Configuration saved. Exiting...", "success");
        
        setTimeout(async () => {
            try {
                await fetch('/api/exit', { method: 'POST' });
            } catch (err) {
                // Server closed
            }
            showShutdownOverlay();
        }, 800);
    } catch (err) {
        showToast("Failed to save configuration before exiting", "error");
        isShuttingDown = false;
    }
}

function openInspector() {
    window.open('/inspect', '_blank');
}
