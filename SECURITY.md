# SECURITY POLICY

## FOOTINT — Global Football Intelligence

This document outlines the security practices, reporting procedures, and responsible disclosure guidelines for the FOOTINT project.

---

# Supported Versions

Currently supported versions:

| Version      | Supported |
| ------------ | --------- |
| Latest       | Yes       |
| Older builds | No        |

---

# Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

Do NOT publicly disclose vulnerabilities before they are reviewed and patched.

---

# How to Report

Please include:

* Vulnerability description
* Reproduction steps
* Screenshots or logs (if applicable)
* Potential impact
* Suggested mitigation (optional)

---

# Response Timeline

| Stage              | Estimated Time        |
| ------------------ | --------------------- |
| Initial response   | 24–72 hours           |
| Investigation      | 3–7 days              |
| Patch / mitigation | Depending on severity |

---

# Scope

The following systems are considered in scope:

* Globe rendering system
* Event feed system
* Frontend JavaScript logic
* API integrations
* Client-side interactions
* Deployment configuration

---

# Out of Scope

The following are NOT considered security vulnerabilities:

* Visual/UI bugs
* Typographical issues
* Browser-specific rendering quirks
* Non-sensitive console warnings
* Denial-of-service via unrealistic load testing

---

# Security Considerations

## External Libraries

FOOTINT currently uses:

* three.js
* globe.gl

Always verify CDN integrity and avoid loading untrusted scripts.

---

## API Security

When integrating external football APIs:

* Never expose private API keys publicly
* Use environment variables for secrets
* Implement rate limiting where possible
* Validate all external data

---

## Deployment Security

Recommended deployment practices:

* Use HTTPS only
* Keep dependencies updated
* Restrict GitHub Actions permissions
* Avoid exposing sensitive credentials in repositories

---

# Recommended GitHub Settings

## GitHub Actions Permissions

Recommended:

```text
Settings → Actions → General
Workflow permissions → Read repository contents permission
```

Only elevate permissions when necessary.

---

# Future Security Roadmap

Planned future improvements:

* CSP (Content Security Policy)
* SRI (Subresource Integrity)
* Secure API proxy layer
* Authentication system hardening
* Role-based access control
* Event source validation
* Abuse prevention systems

---

# Responsible Disclosure

Please:

* Give maintainers reasonable time to fix issues
* Avoid public disclosure before remediation
* Avoid exploiting vulnerabilities beyond proof-of-concept
* Respect user privacy and platform integrity

---

# Security Philosophy

FOOTINT is designed with:

```text
Minimal attack surface
+ Lightweight architecture
+ Transparent frontend logic
+ Controlled external dependencies
```

---

# Contact

For security-related concerns:

```text
Open a private GitHub issue or contact the maintainer directly.
```

---

# Disclaimer

This project is currently experimental and intended primarily for educational, visualization, and prototyping purposes.

Use responsibly.
