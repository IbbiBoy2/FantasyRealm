# FantasyRealm — Deployment Documentation

**Project:** FantasyRealm
**Author:** Independent developer — Studi DWWM project
**Date:** 01/11/2026
**Current environment:** Local XAMPP
**Target environment:** Public web hosting
**Deployment status:** Planned — not yet deployed

---

## 1. Purpose

This document explains how to deploy FantasyRealm to a public server, configure its dependencies, initialize its databases, secure the application and verify that it works correctly.

FantasyRealm is currently developed and tested locally using XAMPP. The public hosting provider and domain name have not yet been selected.

The deployment instructions are therefore designed to be adapted to the chosen hosting environment.

## 2. Application Architecture

FantasyRealm uses the following architecture:

| Component           | Technology                          |
| ------------------- | ----------------------------------- |
| Frontend            | HTML5, CSS3, JavaScript             |
| Backend             | PHP 8.2                             |
| API                 | REST-style PHP endpoints, JSON      |
| Relational database | MariaDB / MySQL                     |
| Activity logs       | MongoDB                             |
| Dependencies        | Composer                            |
| Web server          | Apache or compatible PHP hosting    |
| Security            | PHP sessions, CSRF tokens, Argon2id |
| Deployment          | Git, hosting server, HTTPS          |

The frontend communicates with the PHP backend using the Fetch API.

MariaDB stores application data such as accounts, characters, accessories, reviews and contact messages.

MongoDB stores staff activity logs.

## 3. Hosting Requirements

The hosting provider must support:

- PHP 8.2 or a compatible, supported PHP version
- Apache or another properly configured PHP-capable web server
- MariaDB/MySQL
- PDO MySQL and mbstring PHP extensions
- Composer dependencies
- MongoDB PHP extension
- A MongoDB database, either managed or self-hosted
- HTTPS certificates
- Secure storage for environment variables
- Scheduled database maintenance and backups

Static-only hosting such as GitHub Pages is insufficient because FantasyRealm requires PHP and databases.

The production server must support application security settings and restrictions on access to private files.

## 4. Preparing the Project

Before deployment:

1. Commit and push the latest working project version to GitHub.
2. Review changes and verify the application locally.
3. Create a stable release branch or version tag.
4. Remove unused development files and test scripts from the release.
5. Verify that no passwords, API credentials or real personal data are committed.
6. Check that all frontend asset paths use the correct capitalization.
7. Verify that the PHP API paths match the intended public URL.
8. Prepare the complete production database schema.

**Important:** The current source contains some hardcoded `/FantasyRealm/` API paths. These must either remain valid on the production server or be updated before deployment.

One known case-sensitivity issue is the Login page's stylesheet path. It should reference `../Css/login.css`, matching the actual directory name.

## 5. Preparing the Production Server

### Step 1 — Provision the server

Create a hosting account or server environment with the required PHP and database services.

Record the following details privately:

| Setting                 | Value            |
| ----------------------- | ---------------- |
| Hosting provider        | To be determined |
| Public domain           | To be determined |
| Server operating system | To be determined |
| Web server              | To be determined |
| PHP version             | To be verified   |
| MariaDB host            | To be determined |
| MongoDB host            | To be determined |
| Deployment directory    | To be determined |

### Step 2 — Configure the web server

The server must:

- Serve the frontend HTML, CSS, JavaScript and images.
- Execute PHP API endpoints.
- Prevent public access to private configuration and dependency files.
- Disable directory listing.
- Redirect HTTP traffic to HTTPS.
- Return appropriate HTTP status codes.

The recommended production design keeps sensitive backend configuration and dependencies outside the publicly accessible document root.

If the existing project directory structure is retained under the web root, server-level restrictions must deny access to non-public files and directories, including:

- `Backend/.env`
- `Backend/config/`
- `Backend/Database/`
- `Backend/vendor/`
- `Backend/composer.json` and `composer.lock`
- `.git/`
- Database exports, backups and application logs

Only required public assets and intended PHP API entry points should be accessible.

**Do not publish the current repository directory through a web server without verifying these restrictions.**

## 6. Deploying the Source Code

The source code is stored in the GitHub repository:

`https://github.com/IbbiBoy2/FantasyRealm`

For example, the current development branch can be cloned using:

```bash
git clone -b feature/user-dashboard https://github.com/IbbiBoy2/FantasyRealm.git
```

For an actual public release, use a tested release tag or stable branch rather than deploying unreviewed development changes.

After downloading the files:

1. Place the project in the server's application directory.
2. Configure its public frontend and API paths.
3. Assign appropriate filesystem ownership and permissions.
4. Keep writable files and sensitive configuration inaccessible to visitors.
5. Confirm that the deployed version matches the intended Git release.

## 7. Installing PHP Dependencies

Open a terminal in the Backend directory:

```bash
cd Backend
```

Run:

```bash
composer install --no-dev --prefer-dist --optimize-autoloader
```

This installs the production dependencies recorded in `composer.lock`.

The main Composer packages are:

- `vlucas/phpdotenv`
- `mongodb/mongodb`

Verify that the server's PHP runtime has the required extensions enabled.

The `vendor/` directory must be available to PHP but should not be directly downloadable through the website.

## 8. Environment Variables

FantasyRealm reads database configuration from a `.env` file in the `Backend` directory.

### Production configuration example

Create a private `Backend/.env` file with values appropriate for the hosting provider:

```dotenv
DB_HOST=YOUR_DATABASE_HOST
DB_PORT=3306
DB_NAME=fantasyrealm
DB_USER=YOUR_DATABASE_USER
DB_PASSWORD=YOUR_STRONG_DATABASE_PASSWORD

MONGODB_URI=YOUR_PRIVATE_MONGODB_CONNECTION_URI
MONGODB_DATABASE=fantasyrealm
```

### Environment variable descriptions

| Variable           | Purpose                       |
| ------------------ | ----------------------------- |
| `DB_HOST`          | MariaDB/MySQL server address  |
| `DB_PORT`          | MariaDB/MySQL connection port |
| `DB_NAME`          | Relational database name      |
| `DB_USER`          | Application database account  |
| `DB_PASSWORD`      | Application database password |
| `MONGODB_URI`      | MongoDB connection URI        |
| `MONGODB_DATABASE` | MongoDB database name         |

These are the configuration variables currently used by the application.

The database credentials must be unique to production.

Do not use the MariaDB root account for the application.

Do not commit the production `.env` file to GitHub or include real credentials in the documentation.

**Note:** The current `.env.example` contains a non-configuration explanatory line. Remove that line when preparing an actual `.env` file.

## 9. Configuring MariaDB

### Step 1 — Create the database

Create a production MariaDB database named:

```sql
CREATE DATABASE fantasyrealm
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;
```

Use a database administration account for initial setup.

### Step 2 — Create a dedicated database user

Create a separate application account with a strong password.

Grant only the database permissions required by the application. Avoid granting unnecessary global or administrative privileges.

Database administration, schema installation and application runtime access should be handled separately where possible.

### Step 3 — Prepare the database schema

The repository currently contains:

```text
Backend/Database/shema.sql
Backend/Database/seed.sql
```

These files describe an earlier version of the database.

**They are not sufficient by themselves to reproduce the current complete FantasyRealm installation.**

Before production deployment:

1. Export the complete schema from the working local MariaDB database.
2. Include all required tables, constraints, indexes and relationships.
3. Include database changes made after the original schema.
4. Create a clean, version-controlled production schema or migration set.
5. Import it into an empty test database.
6. Verify that the application works with the imported database.

The production schema must include the data structures used by character moderation, reviews, account management, contact messages and other implemented features.

Do not import the old example seed accounts as real production accounts. Their password hashes are placeholders.

### Step 4 — Import the production schema

Use phpMyAdmin or the hosting provider's database administration tool to import the updated SQL schema.

Alternatively, where command-line access is available, import using the MariaDB/MySQL client.

After import, verify that the required application tables and the `USER`, `EMPLOYEE` and `ADMIN` roles exist.

Do not transfer real development users' personal information to the public database unless there is a justified and properly managed reason to do so.

## 10. Configuring MongoDB

FantasyRealm uses MongoDB for staff activity logging.

The expected database and collection are:

```text
Database: fantasyrealm
Collection: activity_logs
```

### Configuration procedure

1. Install or provision MongoDB.
2. Create an application database account with appropriate permissions.
3. Restrict database access to authorized application servers.
4. Configure authentication and encryption for remote connections.
5. Set the correct `MONGODB_URI` in the production environment.
6. Verify that the PHP MongoDB extension is available.
7. Verify that the Composer MongoDB library is installed.
8. Test activity-log creation and retrieval.

### Activity-log retention

Activity logs are intended to be retained for 365 days.

The current PHP logger stores the timestamp in the field:

```text
created_at
```

Verify that the MongoDB TTL index uses this exact field name and that its retention period is configured correctly.

For a new collection, an example index in `mongosh` is:

```javascript
db.activity_logs.createIndex(
    { created_at: 1 },
    { expireAfterSeconds: 31536000 }
);
```

Check for existing TTL indexes before creating or changing one, and test automatic expiration with disposable records.

## 11. Data Retention Configuration

FantasyRealm includes data retention requirements.

### Contact messages

Contact messages are intended to be retained for six months.

The local development database uses a scheduled MariaDB cleanup event.

On the production server:

1. Verify that the cleanup event exists.
2. Confirm its deletion conditions and retention period.
3. Check whether the database event scheduler is enabled.
4. Test the cleanup using disposable, expired test data.
5. If database events are unavailable, configure an equivalent authorized scheduled task.

Example verification queries:

```sql
SHOW VARIABLES LIKE 'event_scheduler';
SHOW EVENTS FROM fantasyrealm;
```

### Backups

Production backups require their own retention and deletion policy.

The backup schedule must account for both databases and any application-generated files.

## 12. HTTPS and Session Security

HTTPS must be enabled before the public website accepts real user credentials.

### Required configuration

- Install a valid TLS certificate.
- Redirect HTTP requests to HTTPS.
- Enable secure session cookies.
- Preserve `HttpOnly` and appropriate `SameSite` settings.
- Verify session regeneration during authentication.
- Keep CSRF token verification enabled.
- Disable detailed PHP error output in production.
- Store application error logs in a private location.

The current `security.php` contains secure-session configuration.

Before release, verify that all authentication-related PHP endpoints apply consistent session security. Some current endpoints use `session_start()` directly.

If the application runs behind a reverse proxy, verify that PHP correctly recognizes HTTPS before relying on automatic cookie-security detection.

## 13. Domain and URL Configuration

After selecting a domain:

1. Configure the domain's DNS records for the hosting provider.
2. Configure the web server to recognize the domain.
3. Install the HTTPS certificate.
4. Choose the application's public base path.
5. Update or preserve the existing frontend and API URL structure.
6. Confirm that assets and API requests load from the correct origin.

Currently, local API requests use paths such as:

```text
/FantasyRealm/Backend/api/session.php
```

The production server must support this path, or the frontend code must be updated consistently.

The frontend's HTML page links and relative image paths must also be tested after deployment.

## 14. Password Reset and Email Delivery

The current Forgot Password API is deliberately disabled and returns HTTP 503.

Before public release, choose one of the following approaches:

- Implement secure password-reset emails with private, expiring reset links and test the complete process.
- Keep password reset unavailable, clearly inform users of the limitation, and define a secure support procedure.

Never return password-reset tokens directly to visitors as a substitute for private email delivery.

Production email functionality may require an SMTP service or another trusted email provider, with its credentials stored outside Git.

## 15. Security Checks Before Publication

Before opening the website publicly, perform a final production security review.

### Access control

Verify that:

- Visitors cannot access protected user APIs without authentication.
- USER accounts cannot access employee or admin actions.
- EMPLOYEE accounts cannot access admin-only actions.
- Suspended accounts are rejected.
- Backend permissions are enforced independently of frontend navigation.

### Input validation

Verify server-side handling of:

- Empty required fields
- Invalid email addresses
- Excessively long values
- Invalid character IDs
- Unexpected JSON input
- XSS payloads
- SQL injection attempts
- Missing or invalid CSRF tokens

### Production safety

Also verify:

- Database credentials are not publicly accessible.
- Development debugging is disabled.
- Administrative accounts use strong, unique passwords.
- Registration, login, contact and review endpoints have suitable abuse protections and rate limiting.
- The server does not expose private files or database backups.
- Dependencies and server software are maintained and patched.

Security protections implemented in development must be retested against the deployed environment.

## 16. Legal and Privacy Preparation

FantasyRealm currently includes:

- Legal Notice
- Privacy Policy
- Contact page

Before publication, update these pages with accurate production information, including the operator's applicable contact and identification details, hosting arrangements, data processing and retention information.

Confirm that hosting, backups, technical logs, third-party services and user rights procedures match what the Privacy Policy actually describes.

This step should be reviewed before collecting real user information.

## 17. Production Testing

Once the application is deployed to a private staging environment, test the important user journeys.

| Test                         | Expected result                                   |
| ---------------------------- | ------------------------------------------------- |
| Home page                    | Loads without missing assets                      |
| Registration                 | Creates a USER account                            |
| Login                        | Authenticates valid credentials                   |
| Logout                       | Ends the session                                  |
| Character creation           | Saves a new pending character                     |
| Character dashboard          | Displays the user's characters                    |
| Duplicate / delete / restore | Performs the correct requested action             |
| Character moderation         | Authorized staff can approve or reject            |
| Character sharing            | Approved, shared characters appear in the gallery |
| Gallery filters              | Return matching characters                        |
| Reviews                      | Follow the moderation process                     |
| Admin dashboard              | Available only to ADMIN                           |
| Employee dashboard           | Available to EMPLOYEE and ADMIN                   |
| Contact form                 | Valid submissions are stored                      |
| Activity logs                | MongoDB records relevant staff actions            |
| Unauthorized requests        | Rejected with appropriate HTTP status             |
| HTTPS                        | Encrypted connection and correct session behavior |

Also inspect the browser console, network requests, server error logs and database records for problems.

Test on desktop, tablet and mobile viewports.

## 18. Backups and Monitoring

Before accepting real users, establish a documented backup procedure.

### Backups

Back up:

- MariaDB application data
- MongoDB activity logs according to the retention policy
- Any application-generated files that must be preserved
- Production configuration through a secure secrets backup process

Backups must be access-controlled, protected from unauthorized disclosure and tested for restoration.

### Monitoring

Monitor:

- Website availability
- PHP errors
- Failed database connections
- Failed authentication attempts
- Unexpected API errors
- Database storage and backup health
- Expiring TLS certificates

Do not place passwords, reset tokens or sensitive user information in public logs.

## 19. Release and Rollback

For each production release:

1. Confirm that the release passed staging tests.
2. Create a backup or recovery point.
3. Record the deployed Git commit or release tag.
4. Apply reviewed database migrations if required.
5. Deploy the application files and dependencies.
6. Verify environment variables and permissions.
7. Perform smoke tests.
8. Monitor application errors after deployment.

If a release fails:

1. Prevent further harmful operations if necessary.
2. Restore the previously working application release.
3. Restore or reverse database changes only using an appropriate, tested recovery procedure.
4. Recheck authentication, database connections and essential workflows.
5. Document the incident and correction.

Do not assume that reverting PHP files automatically reverses database schema changes.

## 20. Production Readiness Checklist

The following tasks must be confirmed before public launch:

- [ ] Hosting provider and domain selected
- [ ] Complete and updated SQL schema prepared
- [ ] Clean database initialization tested
- [ ] Production database accounts configured
- [ ] MongoDB connection verified
- [ ] Activity-log TTL index verified
- [ ] Contact-message retention verified
- [ ] Composer dependencies installed
- [ ] Environment variables configured securely
- [ ] Sensitive backend files protected
- [ ] Frontend paths and case sensitivity corrected
- [ ] Hardcoded application URLs reviewed
- [ ] HTTPS and session security verified
- [ ] Password-reset policy finalized
- [ ] Production input validation and access control tested
- [ ] Rate limiting and abuse protection reviewed
- [ ] Privacy Policy and Legal Notice updated
- [ ] Database backups and restoration tested
- [ ] All major user journeys passed staging tests
- [ ] Production launch approved

## 21. Conclusion

FantasyRealm has been developed and tested locally using XAMPP.

The application includes a PHP backend, MariaDB data storage, MongoDB activity logging, user authentication, role-based dashboards and community character management.

Public deployment requires a compatible hosting environment and additional production configuration.

The current project is not yet confirmed to be production-ready. The remaining configuration, database, security and operational checks must be completed before public registration is enabled.

Once the application is deployed, this document should be updated with the actual hosting environment, deployment procedure, software versions and verification results.

---

**Project:** FantasyRealm
**Training:** Studi — Développeur Web et Web Mobile
**Document type:** Deployment Documentation
**Status:** Public deployment planned
