# Data Security Statement

**Last Updated: June 2026**

This document describes the security controls, measures, and best practices implemented for the Setu project and its public gateway demo hosted by Helios Logic.

---

## 1. Encryption
*   **In-Transit:** All web traffic to the Setu dashboard and public tunnel endpoints (e.g. `*.setu.helios-logic.com`) is encrypted using TLS 1.2 or TLS 1.3.
*   **CLI Communication:** Tunnel data multiplexed over WebSockets (via Yamux) utilizes TLS-encrypted transports for all connections back to the gateway.
*   **At-Rest:** Stored user passwords are hashed using bcrypt. Sensitive configuration mappings and API credentials are kept securely in our database.

## 2. Open-Source Infrastructure and Zero-Inspection Tunneling
*   **No Traffic Inspection:** The Setu gateway routes incoming HTTP/TCP requests to your local CLI client without inspecting, logging, or writing request/response payloads to disk. Your traffic is transient and passes purely in-memory.
*   **Self-Hosting Security:** Since the entire Setu software stack is open-source, users who require stricter controls or handle sensitive production payloads are encouraged to self-host their own instance of the Setu gateway on private, isolated networks.

## 3. Vulnerability Reporting
As an open-source demonstration platform, security is a collaborative effort. If you discover a vulnerability or a security issue, please do not exploit it. Report it responsibly by opening a security issue in the GitHub repository or contacting the Helios Logic maintainers.

---
*Developed & operated by Helios Logic.*
