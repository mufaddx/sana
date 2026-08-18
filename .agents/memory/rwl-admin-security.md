---
name: RWL admin security
description: Security and deployment constraints for the Real World Link admin workspace.
---

The admin workspace uses allowlisted email OTP login, expiring one-time codes, hashed database sessions and MySQL-backed submissions. Database and SMTP values must come from environment variables; credentials pasted in chat must never be copied into code or configuration.

**Why:** The project owner shared database and SMTP credentials in a message and said they were temporary. Chat-exposed credentials are not safe to reuse, even when called dummy.

**How to apply:** Keep the admin disabled until the owner supplies fresh values through the secure environment flow, with `ADMIN_EMAILS`, MySQL variables, SMTP variables and `SESSION_SECRET` configured separately for the target environment.