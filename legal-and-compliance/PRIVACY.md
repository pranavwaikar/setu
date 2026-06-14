# Privacy Policy

**Last Updated: June 2026**

Helios Logic is committed to protecting your privacy in connection with the Setu open-source tunneling demo. This Privacy Policy describes how we handle the minimal data we collect.

---

## 1. Information We Collect
Because Setu is designed as a developer utility demo, we collect the bare minimum required to run the service:
*   **Account Credentials:** When you register, we collect your email address and a hashed password to authenticate your access.
*   **API Keys:** We generate and store API keys to authenticate tunnel requests from the Setu CLI client.
*   **Subdomain Selections:** We store the subdomains you claim (e.g. `jhon-cena`) so we can route traffic to your CLI.
*   **Connection Metadata:** Our gateway may log transient metadata (such as active connections, bandwidth, and connection status) to prevent abuse and manage gateway resources. We do **not** inspect or persist the content of requests tunneled through your local server.

## 2. Use of Information
We use your information exclusively to:
*   Authenticate your account and API requests.
*   Route traffic to your active tunnel sessions.
*   Monitor and maintain the health, performance, and security of the public gateway.

## 3. Data Retention and Deletion
*   Since this is a free public demo, we do not guarantee persistent storage. If your account is inactive for an extended period, it and all associated subdomains/API keys may be purged.
*   You can request account deletion at any time by contacting us, or by deleting your configured subdomains directly from the dashboard.

## 4. Security
We take reasonable technical precautions to secure the stored API keys and credentials. However, as this is an open-source demonstration platform operated on a volunteer basis, we cannot guarantee absolute security. You should never tunnel production databases, highly sensitive information, or production traffic through this demo.

## 5. Contact Information
For privacy questions or data removal requests, please contact the repository administrators or visit Helios Logic.

---
*Developed & operated by Helios Logic.*
