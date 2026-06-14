# Email-OTP Verification and Setup Disclaimer

**Last Updated: June 2026**

This document describes the validation flow and email verification mechanisms used to secure the Setu CLI configuration environment.

---

## 1. Local Setup UI Authentication
When running the local setup wizard using the command:
```bash
setu setup
```
The CLI spawns a local server to configure subdomains and map ports. Access to this wizard is secured via your user account session.

## 2. Email Verification and OTP Rules
*   **Security Validation:** Accounts registered on the public Setu dashboard require email verification. Verification is performed using a One-Time Password (OTP) or validation link delivered to your registered email address.
*   **Integration:** We utilize industry-standard transactional email services (such as Resend) to deliver secure verification codes.
*   **Demo Limitations:** For testing/local deployments or during maintenance windows, maintainers may bypass OTP requirements or auto-verify specific domains. However, for the public cloud instance, registration, password resets, and critical API key actions are subject to strict email OTP validation.

## 3. Best Practices
*   Never share your email-OTP codes or private API Keys. Setu support will never ask for your API Key or active OTPs.
*   Ensure that the email address associated with your Setu account remains secure and active.

---
*Developed & operated by Helios Logic.*
