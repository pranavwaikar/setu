# Payment Compliance Statement

**Last Updated: June 2026**

This document details the payment processing policy and PCI compliance for the Setu project and its public gateway demo.

---

## 1. No Payment Processing
*   **Free Service:** The public Setu demonstration gateway hosted by Helios Logic at `setu.helios-logic.com` is completely free of charge.
*   **No Financial Transactions:** We do not collect, process, store, or transmit credit card details, bank account information, or any other financial payment information.
*   **PCI-DSS Exemption:** Because the Setu platform does not handle financial transactions, credit card data, or processing, the platform is exempt from Payment Card Industry Data Security Standard (PCI-DSS) auditing.

## 2. Third-Party Integrations
In the event that commercial plugins, integrations, or optional paid tiers are added in the future:
*   All credit card processing will be delegated to industry-standard, PCI-DSS Level 1 compliant third-party payment processors (e.g., Stripe, PayPal).
*   Helios Logic will never directly receive or store raw cardholder data on its own servers.

---
*Developed & operated by Helios Logic.*
