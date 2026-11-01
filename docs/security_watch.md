# FantasyRealm — Security Technology Watch

**Project:** FantasyRealm  
**Training:** Studi — Développeur Web et Web Mobile (DWWM)  
**Research date:** 01/11/2026  
**Research topic:** Web application vulnerabilities and security best practices  
**Status:** Research completed — production security review pending

---

## 1. Objective

The objective of this technology watch is to identify common web application vulnerabilities, understand their risks and apply reliable security recommendations to FantasyRealm.

FantasyRealm is a web application developed using HTML, CSS, JavaScript, PHP, MariaDB and MongoDB.

Because the application manages user accounts, passwords, characters, reviews and administrative functionality, security is an important development requirement.

This research also helps prepare the application for future public deployment.

## 2. Research Method

The research focused on official technical documentation from recognized organizations.

The main sources were:

- **OWASP Top 10:2025:** Important web application security risks.
- **OWASP Cheat Sheet Series:** Secure coding recommendations.
- **OWASP Web Security Testing Guide:** Methods for testing web application security.
- **Composer documentation:** PHP dependency security checks.
- **CNIL:** Personal data security and secure development recommendations.

The recommendations were compared with the FantasyRealm source code on GitHub, using the `feature/user-dashboard` branch.

This is a technical research and code-review exercise, not a complete penetration test.

## 3. Vulnerabilities Studied

### 3.1 SQL Injection

**Risk:** SQL injection occurs when user-controlled input changes the meaning of a database query. An attacker may be able to read, modify or delete information.

**What I learned:** OWASP recommends parameterized queries so that user input is handled as data rather than executable SQL syntax.

**Application to FantasyRealm:**

The PHP backend uses PDO prepared statements and bound parameters in account management, character creation and other database operations.

For example, the login API searches for an email using a bound SQL parameter.

**Impact:** The project follows the recommended approach for protecting these queries. All new database queries should continue using parameterization.

**Status:** Protection observed in source code; full injection testing remains a separate activity.

Source: [OWASP — SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

### 3.2 Cross-Site Scripting (XSS)

**Risk:** XSS occurs when untrusted content is interpreted as executable code in another user's browser.

**What I learned:** User-generated content should be displayed using context-appropriate output encoding or safe DOM methods. For ordinary text, `textContent` is safer than inserting untrusted HTML.

**Application to FantasyRealm:**

The frontend uses `textContent` in several areas, including character information, usernames and feedback messages.

User-generated information is also subject to input validation.

**Impact:** Safe output handling is an important design rule for the character gallery, reviews and account interfaces.

**Status:** Safe DOM handling confirmed in reviewed code; all output contexts still require verification.

Source: [OWASP — Cross-Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)

### 3.3 Broken Access Control

**Risk:** Broken access control allows an account to perform actions beyond its permissions, such as a regular user accessing administrator functionality.

**What I learned:** OWASP recommends denying access by default and checking permissions on every protected request.

**Application to FantasyRealm:**

FantasyRealm implements three roles:

- USER
- EMPLOYEE
- ADMIN

The PHP backend checks authentication and role permissions.

The `requireAdmin()` function verifies the account's current database role and suspension status.

**Impact:** Access restrictions are enforced on the server, independently of visible navigation links.

**Status:** Role checks implemented. A complete endpoint-by-endpoint authorization test is recommended before production.

Source: [OWASP — Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

### 3.4 Cross-Site Request Forgery (CSRF)

**Risk:** CSRF can cause an authenticated user's browser to send an unwanted request to an application.

**What I learned:** OWASP recommends unpredictable CSRF tokens, validated on the server, for session-based applications.

**Application to FantasyRealm:**

FantasyRealm generates a CSRF token associated with the PHP session.

JavaScript sends this token using the `X-CSRF-Token` HTTP header for protected operations.

The backend verifies the token and rejects invalid requests.

**Impact:** Character creation, moderation and other protected actions use an additional request-authenticity check.

**Status:** CSRF functionality observed in reviewed code. Coverage across all relevant endpoints should be checked.

Source: [OWASP — CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

### 3.5 Password Security and Authentication

**Risk:** Weak password storage increases the damage caused by a database breach. Authentication systems are also exposed to automated login attempts.

**What I learned:** OWASP recommends modern password hashing algorithms such as Argon2id. Its documented minimum configuration includes 19 MiB of memory, two iterations and one degree of parallelism.

**Application to FantasyRealm:**

The backend uses Argon2id with these parameters:

| Parameter | Configured value |
|---|---|
| Memory cost | 19,456 KiB |
| Time cost | 2 |
| Threads | 1 |

The login API uses `password_verify()` and supports rehashing older password hashes.

Successful authentication also regenerates the PHP session identifier.

**Impact:** The current password hashing configuration follows OWASP's documented minimum Argon2id settings.

**Future improvement:** Verify login rate limiting and automated-attack protection before public deployment.

**Status:** Password hashing confirmed in code; authentication abuse protections require review.

Sources: [OWASP — Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) and [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

### 3.6 Security Misconfiguration

**Risk:** Incorrect server or application settings can expose files, credentials, databases or administrative functionality.

**What I learned:** Security depends not only on the application code but also on the deployment environment.

**Application to FantasyRealm:**

The local project uses a `.env` file for database configuration.

Git excludes `.env` files and Composer's `vendor/` directory.

The application also contains secure-session configuration.

**Impact:** The public server must protect sensitive configuration files, use HTTPS and prevent unauthorized access to private backend directories.

**Future improvement:** Perform a production configuration review when hosting is selected.

**Status:** Local configuration practices implemented; production configuration not yet verified.

Source: [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/)

### 3.7 Vulnerable Dependencies

**Risk:** Outdated or compromised software dependencies can introduce security vulnerabilities even when the application's own code is carefully written.

**What I learned:** Dependencies must be monitored and updated. Composer provides an `audit` command that checks installed packages against known security advisories.

**Application to FantasyRealm:**

The backend uses Composer to manage:

- `vlucas/phpdotenv`
- `mongodb/mongodb`

The project includes `composer.json` and `composer.lock`.

**Impact:** Dependency security should be checked before deployment and after relevant security advisories.

Recommended command:

```bash
composer audit
```

This command checks for reported dependency security issues. It does not replace application security testing.

**Status:** Dependency management implemented; current audit result not recorded.

Source: [Composer — Command-line documentation](https://getcomposer.org/doc/03-cli.md)

### 3.8 Security Logging and Monitoring

**Risk:** Without sufficient logging, unauthorized or suspicious activity may go undetected.

**What I learned:** OWASP recommends recording relevant security events while avoiding unnecessary collection of sensitive information such as passwords, session identifiers and access tokens.

**Application to FantasyRealm:**

MongoDB is used for staff activity logs.

Recorded actions include character moderation, review moderation, employee management and selected account-management operations.

Logs contain action identifiers, actor IDs, target IDs and timestamps.

**Impact:** Administrative activity can be reviewed without placing passwords inside event records.

**Future improvement:** Verify the MongoDB retention index and implement appropriate production monitoring and alerting.

**Status:** Activity logging implemented; production monitoring not yet configured.

Source: [OWASP — Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

## 4. Research Results and Project Impact

| Security topic | What was learned | Effect on FantasyRealm |
|---|---|---|
| SQL injection | Use parameterized queries | PDO prepared statements used |
| XSS | Display untrusted text safely | `textContent` used for reviewed content |
| Access control | Check authorization on the backend | USER, EMPLOYEE and ADMIN role checks |
| CSRF | Verify session-bound request tokens | CSRF tokens and custom headers used |
| Password security | Use memory-hard password hashing | Argon2id configured |
| Session security | Protect and regenerate sessions | Session cookie settings and ID regeneration |
| Misconfiguration | Protect private server resources | Production configuration review required |
| Dependencies | Check security advisories | Composer dependency auditing identified |
| Monitoring | Record relevant events without secrets | MongoDB activity logging |

The research confirmed several previously implemented security choices and identified areas requiring additional attention before the website becomes public.

It does not establish that all vulnerabilities have been eliminated.

## 5. Actions Identified Before Public Deployment

The technology watch identified these priorities:

| Priority | Action | Current status |
|---|---|---|
| High | Verify role and ownership checks on protected endpoints | To verify |
| High | Review production HTTPS, sessions and private file access | Pending hosting setup |
| High | Test login and registration abuse protection | To verify |
| High | Run `composer audit` and review dependency advisories | Not yet recorded |
| High | Perform a documented security testing pass | To complete before launch |
| Medium | Verify MongoDB log retention | To verify |
| Medium | Review application error logging and monitoring | To verify |
| Medium | Update production privacy and hosting information | Pending hosting decision |

These actions should be completed or explicitly risk-assessed before enabling public registrations.

## 6. Maintaining the Technology Watch

Security research should continue after the examination.

The following routine is proposed:

**Monthly:** Review OWASP guidance, relevant security advisories and updates to the application's dependencies.

**Before each deployment:** Run dependency checks, review important changes and retest affected functionality.

**When a vulnerability is announced:** Determine whether the affected component is used by FantasyRealm, assess the risk, apply the appropriate correction and document the outcome.

A future research log should record the date, source, vulnerability, relevance to FantasyRealm, decision and verification result.

## 7. Sources Consulted

The following primary sources were consulted on 01/11/2026.

| Organization | Reference | Purpose |
|---|---|---|
| OWASP | [Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) | Identification of major web risks |
| OWASP | [SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) | Database query security |
| OWASP | [XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | Safe output rendering |
| OWASP | [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Server-side access control |
| OWASP | [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Request authenticity |
| OWASP | [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | Password hashing |
| OWASP | [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | Authentication security |
| OWASP | [Web Security Testing Guide](https://owasp.org/projects/web-security-testing-guide) | Testing methodology |
| OWASP | [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Activity and security logs |
| Composer | [CLI documentation](https://getcomposer.org/doc/03-cli.md) | Dependency vulnerability audits |
| CNIL | [Guide de la sécurité des données personnelles](https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024) | Personal data security |

## 8. Conclusion

This technology watch helped me better understand the main security threats affecting modern web applications.

By consulting official documentation, I identified the importance of SQL parameterization, output encoding, backend authorization, CSRF protection, secure password hashing and session management.

The research also showed that application security is not limited to writing secure code. Server configuration, dependencies, logs, monitoring and maintenance are equally important.

Several recommendations are already reflected in FantasyRealm's implementation, while other controls must be verified before public deployment.

The main result of this research is a clearer understanding of secure web development and a list of practical actions to support the application's continued improvement.

---

**Project:** FantasyRealm  
**Document:** Security Technology Watch  
**Research date:** 01/11/2026  
**Status:** Research documented