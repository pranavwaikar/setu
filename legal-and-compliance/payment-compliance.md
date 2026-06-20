# Payment Compliance Statement

**Last Updated: June 2026**

This document details the payment processing policy, billing terms, and PCI compliance for the Setu project and its public gateway.

---

## 1. Third-Party Payment Processing & Merchant of Record
*   **Third-Party Delegate:** All financial transactions, subscriptions, and invoicing are handled securely by our third-party payment partner and Merchant of Record, **Dodo Payments**.
*   **No Direct Processing or Storage:** We do not collect, process, store, or transmit credit card numbers, bank details, or cardholder credentials on Setu's database or servers.
*   **PCI-DSS Compliance:** Because all payment details are processed directly within Dodo Payments' secure environment (via Dodo Payments Overlay Checkout), the payment flow is fully PCI-DSS compliant. Setu is exempt from direct PCI auditing as we never handle cardholder data directly.

## 2. Subscription Tiers
We offer three user plans:
*   **Free Plan:** Includes up to 10 static subdomains, 3 active tunnels, and 1 GB/day traffic at no cost.
*   **Pro Plan ($5.00/month):** Includes up to 50 subdomains/endpoints. Upgrades are processed securely via Dodo Payments.
*   **Enterprise Plan ($250/month):** Includes fully managed subdomain deployment for the entire organization. Managed directly or by contacting `sales@contact.helios-logic.com`.

## 3. Webhook Security & Verification
*   We secure all incoming billing status notifications by validating HMAC-SHA256 request signatures on our billing callback endpoint (`/api/payments/webhook`) using the standard `webhook-signature` headers and keys managed through Dodo Payments.

---
*Developed & operated by Helios Logic.*
