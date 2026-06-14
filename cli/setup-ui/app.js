let config = { api_key: "", gateway: "", port_mappings: [] };
let claimedSubdomains = [];

async function init() {
    try {
        // Fetch config from local Go server
        const configResp = await fetch('/api/config');
        if (configResp.ok) {
            config = await configResp.json();
            if (!config.port_mappings) config.port_mappings = [];
            document.getElementById('api-key-input').value = config.api_key || '';
            document.getElementById('gateway-input').value = config.gateway || '127.0.0.1:8080';
            updateSubdomainSuffix();
        }
        
        await updateStatus();
    } catch (err) {
        showToast("Failed to initialize setup panel", "error");
    }
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
        const exposeCmd = 'setu expose ' + (currentPort || '<port>') + ' --subdomain ' + sub.hostname;

        const displayUrl = getPublicDisplayURL(sub.hostname);
        const linkUrl = getPublicLinkURL(sub.hostname);
        
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
                        </span>
                        <span class="item-subtitle">Claimed: ${new Date(sub.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>

                <div style="display: flex; align-items: center; gap: 1rem; flex-shrink: 0;">
                    <div class="port-input-group" style="display: flex; align-items: center; gap: 0.5rem;">
                        <label class="form-label" style="margin-bottom: 0; white-space: nowrap; font-size: 0.85rem;">Local Port:</label>
                        <input type="number" class="form-input port-input" data-subdomain="${sub.hostname}" value="${currentPort}" placeholder="e.g. 3000" style="width: 100px; height: 38px; padding: 0.5rem 0.75rem;" oninput="onPortInput(this, '${sub.hostname}')">
                    </div>
                    <button class="btn-danger" onclick="releaseSubdomain('${sub.id}', '${sub.hostname}')" style="height: 38px; display: inline-flex; align-items: center;">Release</button>
                </div>
            </div>

            <div class="code-snippet" style="margin-top: 0;">
                <span id="cmd-${sub.hostname}">${exposeCmd}</span>
                <button class="btn-copy" onclick="copyExposeCommand('${sub.hostname}', this)">
                    <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
                    Copy Command
                </button>
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
    const port = inputElement.value.trim();
    const cmdSpan = document.getElementById(`cmd-${subdomain}`);
    if (cmdSpan) {
        cmdSpan.innerText = 'setu expose ' + (port || '<port>') + ' --subdomain ' + subdomain;
    }
}

function copyExposeCommand(subdomain, btnElement) {
    const cmdSpan = document.getElementById(`cmd-${subdomain}`);
    if (cmdSpan) {
        copyToClipboard(cmdSpan.innerText, btnElement);
    }
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
        btnElement.innerHTML = '✔ Copied!';
        setTimeout(() => {
            btnElement.innerHTML = origHTML;
        }, 2000);
    }).catch(err => {
        showToast("Failed to copy command to clipboard", "error");
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
    
    const suffixSpan = document.getElementById("subdomain-suffix-span");
    if (suffixSpan) {
        suffixSpan.innerText = suffix;
    }
}

// Initialize UI
init();
