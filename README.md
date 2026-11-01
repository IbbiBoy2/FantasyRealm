# ✦ FantasyRealm

## 1. Project Description

FantasyRealm is a web application that allows users to create, manage and share fantasy characters.

Users can customize their characters, manage their personal collection and explore characters shared by other members of the community.

The application also includes moderation tools for employees and administrative tools for managing users and staff.

FantasyRealm was developed as an educational project for the **Studi Développeur Web et Web Mobile (DWWM)** examination.

The application currently runs locally using XAMPP.

## 2. Main Features

### User Features
- Account registration and login
- Secure password storage
- Character creation and customization
- Personal character dashboard
- Character duplication and deletion
- Public character gallery
- Character searching and filtering
- Character sharing
- Ratings and reviews
- Contact form

### Employee Features
- Review pending characters
- Approve or reject characters
- Moderate community reviews
- Manage accessories
- Manage player accounts

### Administrator Features
- Administrator dashboard
- Employee account management
- Employee promotion and suspension
- Account administration
- Activity log consultation

### Security Features
- Password hashing using Argon2id
- PDO prepared statements
- Server-side input validation
- Protection against XSS
- CSRF tokens
- Secure PHP sessions
- Role-based authorization
- Safe error handling

## 3. Technologies Used

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| API communication | Fetch API and JSON |
| Backend | PHP 8.2 |
| Relational database | MariaDB / MySQL |
| Activity logging | MongoDB |
| Database access | PDO |
| Dependency management | Composer |
| Local development | XAMPP |
| Version control | Git and GitHub |
| Code editor | Visual Studio Code |

The frontend uses HTML, CSS and vanilla JavaScript without a JavaScript framework.

## 4. Project Structure

```text
FantasyRealm/
│
├── Frontend/
│   ├── Html/         # Application pages
│   ├── Css/          # Stylesheets
│   ├── js/           # Frontend JavaScript
│   └── assets/       # Images and visual assets
│
├── Backend/
│   ├── api/          # PHP REST API endpoints
│   ├── config/       # Database and security configuration
│   ├── Database/     # Initial SQL schema and seed files
│   ├── composer.json
│   └── composer.lock
│
├── README.md
└── .gitignore
```

The local `Work/` folder is excluded from Git.

## 5. Prerequisites

Before installing FantasyRealm, make sure you have:

- Windows with XAMPP installed
- Apache and MariaDB/MySQL
- PHP 8.2 with PDO MySQL and mbstring extensions
- Composer installed
- Git (for cloning the repository)
- A modern browser such as Google Chrome

For MongoDB activity logging, also install:

- MongoDB Community Server
- The MongoDB PHP extension compatible with your XAMPP PHP version

Internet access may be needed to load the Google Fonts used by the interface.

## 6. Installation

### Step 1 — Download the Project

Clone the repository:

```powershell
git clone -b feature/user-dashboard https://github.com/IbbiBoy2/FantasyRealm.git
```

Move or clone the project into your XAMPP web directory:

```text
C:\xampp\htdocs\FantasyRealm
```

The folder name is important because the application's API URLs use `/FantasyRealm/`.

### Step 2 — Start XAMPP

Open the XAMPP Control Panel and start:

- Apache
- MySQL

Check that phpMyAdmin is accessible:

```text
http://localhost/phpmyadmin
```

Start your local MongoDB server as well if you want to use activity logging.

### Step 3 — Install PHP Dependencies

Open a terminal inside the Backend folder:

```powershell
cd C:\xampp\htdocs\FantasyRealm\Backend
```

Install the dependencies:

```powershell
composer install
```

Composer installs the PHP packages specified in `composer.json`, including:

- `vlucas/phpdotenv`
- `mongodb/mongodb`

The generated `vendor/` folder is excluded from Git and must be recreated during installation.

### Step 4 — Configure Environment Variables

Create a file named `.env` inside the `Backend` folder.

For a typical local XAMPP installation, use:

```dotenv
DB_HOST=localhost
DB_PORT=3306
DB_NAME=fantasyrealm
DB_USER=root
DB_PASSWORD=

MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=fantasyrealm
```

Adjust the credentials and ports if your local installation uses different settings.

The `.env` file contains local configuration and must not be committed to GitHub.

### Step 5 — Configure MariaDB

Open phpMyAdmin:

```text
http://localhost/phpmyadmin
```

FantasyRealm uses a relational database named:

```text
fantasyrealm
```

The repository contains initial database files:

```text
Backend/Database/shema.sql
Backend/Database/seed.sql
```

**Important:** These are earlier database files and do not yet fully reflect the current application. Some newer tables and columns are missing from the initial schema.

For a complete local installation, import an up-to-date SQL schema exported from the working FantasyRealm database.

The existing `seed.sql` is only an early example. Its example password hashes are placeholders, so those accounts are not usable login credentials. The seed also needs updating before it can be reliably imported.

After importing the correct schema, confirm that the required tables and application roles exist.

### Step 6 — Configure MongoDB

MongoDB is used to store staff activity logs.

The application uses:

```text
Database: fantasyrealm
Collection: activity_logs
```

The MongoDB server must be running and the PHP MongoDB extension must be enabled for activity logging to work.

MongoDB data is separate from MariaDB data.

## 7. Running FantasyRealm Locally

Once Apache, MariaDB and the required dependencies are ready, open:

```text
http://localhost/FantasyRealm/Frontend/Html/index.html
```

Other useful pages:

| Page | URL |
|---|---|
| Home | `/Frontend/Html/index.html` |
| Registration | `/Frontend/Html/register.html` |
| Login | `/Frontend/Html/login.html` |
| Character Creator | `/Frontend/Html/create-character.html` |
| Character Gallery | `/Frontend/Html/character-gallery.html` |
| Character Dashboard | `/Frontend/Html/dashboard.html` |
| Employee Dashboard | `/Frontend/Html/employee-dashboard.html` |
| Admin Dashboard | `/Frontend/Html/admin-dashboard.html` |
| Contact | `/Frontend/Html/contact.html` |

These paths are relative to:

```text
http://localhost/FantasyRealm
```

The application must be opened through Apache rather than by opening the HTML files directly, because the frontend communicates with PHP API endpoints.

## 8. User Roles

FantasyRealm uses three account roles.

| Role | Permissions |
|---|---|
| USER | Create and manage personal characters, use community features |
| EMPLOYEE | Moderate characters and reviews, manage assigned application features |
| ADMIN | Access administration tools and employee functionality |

Newly registered accounts receive the USER role.

Employee and administrator access is checked by the PHP backend, not only by the frontend navigation.

## 9. Testing

The application has been tested locally using Google Chrome and XAMPP.

Testing activities include:

- Registration and login
- Character management
- Employee moderation
- Gallery filtering
- Keyboard navigation
- Responsive layouts
- Browser zoom
- Selected API and security checks

Functional and security test results are documented separately.

## 10. Known Limitations

- The project is currently configured for local development, not public production hosting.
- The committed SQL schema and seed files need updating to support a complete fresh installation.
- Password reset is temporarily disabled until secure email delivery is configured.
- MongoDB activity logging requires a separately running MongoDB server.
- Additional production configuration and deployment testing would be required before publishing the application.

## 11. Security and Privacy

FantasyRealm uses server-side authentication and authorization to restrict access to protected API endpoints.

The application also includes:

- A Privacy Policy
- Legal Notice
- Contact page
- Data handling and retention mechanisms

The project is intended for educational use. Production deployment would require additional configuration, verification and security review.

## 12. Project Status

**Status:** Educational development project

**Environment:** Local XAMPP

**Purpose:** Studi DWWM examination

**Version control:** Git and GitHub

FantasyRealm demonstrates frontend development, backend programming, database integration, authentication, authorization and application security.

---

Developed as part of the Studi Développeur Web et Web Mobile training program.