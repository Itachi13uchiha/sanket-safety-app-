# Sanket – Small Signals. Safer Spaces.

**Sanket** is a community safety platform that allows citizens to anonymously report safety concerns and helps authorities identify **emerging patterns instead of simply counting reports**.

The platform combines anonymous reporting, pattern detection, privacy protection, role-based access control, alerts, case management, and tamper-evident audit logging in a single application.

---

## Overview

```text
Citizen
   │
   │ Anonymous Report
   ▼
┌─────────────────────┐
│      REST API       │
│   Node + Express    │
└──────────┬──────────┘
           │
           ▼
    Validation & Privacy
           │
           ▼
      SQLite Database
           │
           ▼
   Pattern Detection
           │
      ┌────┴────┐
      │         │
   No Pattern  Emerging Pattern
                  │
                  ▼
                Alert
                  │
                  ▼
         Authority Portal
                  │
          Password + OTP
                  │
                  ▼
                RBAC
                  │
          ┌───────┴───────┐
          ▼               ▼
        Cases            Alerts
          │               │
          └───────┬───────┘
                  ▼
             Audit Logs
```

---

## Key Features

### Citizen Safety Reporting

* Anonymous safety concern reporting
* Location and incident category selection
* Report history
* Nearby safety patterns
* Approximate location-based information
* English, Hindi and Marathi support

### Pattern Detection

Sanket does not treat a high number of reports as automatic proof of a problem.

The backend evaluates multiple signals:

* **Reporter diversity**
* **Temporal recurrence**
* **Geographical clustering**
* **Report integrity**
* Duplicate or burst activity
* New reporter activity

These signals are combined into a confidence score to identify emerging patterns.

### Authority Portal

* Secure authority authentication
* Password + OTP verification
* Role-Based Access Control (RBAC)
* Reports and pattern monitoring
* Alert management
* Case creation and management
* Officer-specific access
* Audit log inspection
* Data export
* Administrative user and permission management

### Security & Privacy

* Anonymous reporter identifiers
* HMAC-based pseudonymous identity
* Input validation
* Rate limiting
* Sanitized report descriptions
* JWT authentication
* Server-side sessions
* Role and permission enforcement
* Tamper-evident audit logs
* Privacy-aware location handling

---

# Project Structure

```text
sanket/
│
├── frontend/                  # React + Vite + Tailwind application
│   ├── src/
│   │   ├── api/               # API integration layer
│   │   ├── components/
│   │   ├── pages/
│   │   └── ...
│   └── vite.config.ts
│
├── backend/                   # Node + Express REST API
│   ├── src/
│   │   ├── api/               # Routes and API handlers
│   │   ├── domain/            # Core business logic
│   │   ├── db/                # Database and seed data
│   │   ├── lib/               # Authentication/utilities
│   │   └── ...
│   │
│   ├── data/
│   │   └── sanket.db         # SQLite database
│   │
│   └── README.md
│
├── package.json               # Root scripts
└── README.md
```

---

# Technology Stack

| Layer          | Technology                            |
| -------------- | ------------------------------------- |
| Frontend       | React, TypeScript, Vite, Tailwind CSS |
| Backend        | Node.js, Express, TypeScript          |
| Database       | SQLite                                |
| Authentication | JWT + OTP                             |
| Authorization  | Role-Based Access Control             |
| Cryptography   | HMAC, SHA-256                         |
| Validation     | TypeScript + schema validation        |
| Development    | VS Code, npm                          |

---

# Quick Start

## Requirements

* [Node.js 22 LTS](https://nodejs.org/)
* npm
* VS Code

Node.js 20.19+ also works, but **Node.js 22 LTS is recommended**, especially for SQLite dependencies.

Check your version:

```bash
node -v
npm -v
```

---

## Installation

Clone or download the repository:

```bash
git clone <repository-url>
cd sanket
```

Install dependencies and create the development environment:

```bash
npm run setup
```

Load the demo database:

```bash
npm run seed
```

Start both frontend and backend:

```bash
npm run dev
```

Open:

**http://localhost:5173**

The application starts with:

```text
Frontend → http://localhost:5173
Backend  → http://localhost:4000
```

Stop the application with:

```text
Ctrl + C
```

---

# Demo Walkthrough

## Citizen App

The citizen application is designed as a mobile-style interface.

### Try this flow:

1. Open the application.
2. Select **Skip** on the introductory screen.
3. Choose **Enter Location Manually**.
4. Select **Railway Station**.
5. Explore the area safety status and nearby patterns.
6. Select **Report a Safety Concern**.
7. Choose an incident type such as **Harassment**.
8. Select a location and time.
9. Submit the report anonymously.
10. Open **Profile → My Reports** to view the submitted report.
11. Open **Nearby** to explore safety patterns.
12. Switch the language to **Hindi** or **Marathi** from the profile section.

> Demo data is centered around Pune. If you use GPS from another location, the application may show a calm area because there are no seeded reports there.

---

# Authority Portal

The authority portal can be accessed from **Authority Portal** in the application.

### Demo Accounts

| Role          | Sign-in ID    | Password            |
| ------------- | ------------- | ------------------- |
| Supervisor    | `PN-SUP-0142` | `ChangeMe-Now-2026` |
| Officer       | `PN-OFC-0231` | `ChangeMe-Now-2026` |
| Administrator | `PN-ADM-0001` | `ChangeMe-Now-2026` |

After entering the password, the application requires a 6-digit OTP.

During development, the OTP is displayed through the development interface and printed by the API.

### Try these features

**Supervisor**

* View reports
* Monitor alerts
* Escalate alerts
* Manage cases
* View audit logs
* Export data

**Officer**

* View reports and patterns
* Escalate alerts
* Manage assigned cases

**Administrator**

* All available authority functions
* Manage users
* Manage permissions
* Modify system settings

---

# How the Backend Works

The backend is responsible for the application's core business logic.

```text
Frontend
   │
   │ REST API
   ▼
Express Backend
   │
   ├── Authentication
   ├── Authorization
   ├── Validation
   ├── Privacy Processing
   ├── Report Processing
   ├── Pattern Detection
   ├── Alerts
   ├── Cases
   └── Audit Logging
            │
            ▼
        SQLite DB
```

## Anonymous Reporting

The browser generates a random device key.

```text
Random Device Key
       │
       ▼
      HMAC
       │
       ▼
Anonymous Reporter ID
```

The backend uses this pseudonymous identifier to associate reports with the same anonymous source without requiring a name or phone number.

Users can also reset their anonymous identity from the application.

---

## Pattern Detection

The system looks beyond raw report volume.

```text
             Reports
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
   Reporter    Time    Location
   Diversity
       │        │        │
       └────────┼────────┘
                ▼
          Integrity Checks
                │
                ▼
          Confidence Score
                │
                ▼
        Emerging Pattern
                │
                ▼
              Alert
```

This approach helps reduce the effect of:

* Duplicate reports
* Sudden report bursts
* Single-reporter activity
* Coordinated or suspicious reporting

The system is designed as a **decision-support mechanism**, not an autonomous crime prediction system.

---

# Authority Authentication

Authority authentication follows a multi-step process:

```text
Authority Login
      │
      ▼
Password Verification
      │
      ▼
OTP Verification
      │
      ▼
JWT + Server Session
      │
      ▼
Protected API Access
```

The backend checks both the authentication token and the server-side session.

Expired or revoked sessions are rejected.

---

# Role-Based Access Control

Different authority roles have different permissions.

```text
Officer
   ↓
Operational Access

Supervisor
   ↓
Additional Management Access

Administrator
   ↓
Administrative Access
```

Permissions are enforced **on the backend API**, not only by hiding buttons in the frontend.

For example, an unauthorized user attempting to directly call a protected API receives a permission error.

---

# Audit Logging

Important authority actions are recorded in an audit trail.

The audit system uses a hash-chain structure:

```text
Entry 1
   │
   ▼
Hash 1
   │
   ▼
Entry 2
   │
   ▼
Hash 2
   │
   ▼
Entry 3
```

Each entry depends on the previous hash.

If a historical entry is modified, the chain can no longer be verified correctly.

This makes the audit trail **tamper-evident**.

---

# Frontend ↔ Backend Integration

The frontend communicates with the backend through REST APIs.

During development, Vite proxies `/v1` requests to:

```text
http://localhost:4000
```

The integration layer is located at:

```text
frontend/src/api/
```

Important files include:

```text
http.ts      → requests, errors, anonymous session
index.ts     → typed API functions
types.ts     → API response/request types
```

For hosted deployments, the API URL can be configured through environment variables.

---

# Development Commands

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `npm run setup`      | Install dependencies and create `backend/.env` |
| `npm run seed`       | Load demo data                                 |
| `npm run dev`        | Run frontend + backend with auto-reload        |
| `npm run start:prod` | Build and serve the complete application       |
| `npm test`           | Run backend test suite                         |
| `npm run typecheck`  | Type-check the projects                        |
| `F5`                 | Debug the API through VS Code                  |

---

# Production-Style Run

The complete application can also be built and served from a single backend server:

```bash
npm run start:prod
```

The application will be available at:

**http://localhost:4000**

The backend serves the built frontend as well as the REST API.

---

# Testing

Run the test suite with:

```bash
npm test
```

The tests cover areas including:

* Pattern scoring
* Anti-gaming behaviour
* Privacy
* RBAC
* Authentication
* Audit-chain integrity

Type-check the project with:

```bash
npm run typecheck
```

---

# Environment Configuration

The backend uses environment variables for configuration.

For production, configure strong values for:

```text
NODE_ENV
JWT_SECRET
PEPPER
```

Generate a secure secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The production server should not be run with development OTP display enabled.

---

# Before Deployment

Before exposing Sanket to the internet:

1. Set `NODE_ENV=production`.
2. Configure strong `JWT_SECRET` and `PEPPER` values.
3. Disable development OTP display.
4. Use HTTPS.
5. Configure `TRUST_PROXY` when running behind a reverse proxy.
6. Connect a real OTP/password-reset delivery service.
7. Change all seeded passwords.
8. Remove demo accounts.
9. Replace demo Pune areas with the intended deployment zones.
10. Back up the SQLite database.

> The seeded credentials in this README are for local demonstration only and must not be used in a production deployment.

---

# Troubleshooting

### Port already in use

If you see:

```text
EADDRINUSE
```

another application is already using port `4000` or `5173`.

Stop the conflicting process or change the configured port.

---

### Cannot reach the Sanket server

Make sure the backend is running:

```bash
npm run dev
```

Check that the API is available on:

```text
http://localhost:4000
```

---

### `better-sqlite3` installation error

Use Node.js 22 LTS:

```bash
node -v
```

Then reinstall dependencies if necessary.

---

### Account locked

Five incorrect passwords temporarily lock an account.

For a fresh demo database:

```bash
rm backend/data/sanket.db*
npm run seed
```

On Windows, delete the database files manually from:

```text
backend/data/
```

Then run:

```bash
npm run seed
```

---

### No patterns appear

The demo data is centered around the configured Pune areas.

Use:

```text
Enter Location Manually
        ↓
Railway Station
```

to explore the seeded data.

---

# Privacy Model

Sanket is designed around privacy-aware reporting.

The system:

* Does not require citizens to provide their name for reporting.
* Uses pseudonymous reporter identifiers.
* Allows anonymous identity reset.
* Provides a delete-my-data flow.
* Avoids exposing individual public reports.
* Uses aggregated/approximate information for public safety views.

Anonymous reporting does not mean the system is completely immune to abuse. Rate limiting, reporter tracking, trust signals and pattern integrity checks are used to reduce misuse.

---

# Project Philosophy

Sanket is built around four principles:

### Privacy

People should be able to report safety concerns without unnecessarily exposing their identity.

### Explainability

Safety patterns should be supported by understandable evidence rather than unexplained predictions.

### Security

Authentication, authorization and cryptographic mechanisms protect sensitive authority operations.

### Accountability

Important actions should be traceable through a tamper-evident audit trail.

---

# Limitations

Sanket is a **decision-support platform**, not an autonomous crime prediction or law-enforcement system.

Its results depend on the quality of community reports. False, incomplete or coordinated reports can still occur, which is why emerging patterns are intended for **human review and investigation**.

---

# Future Scope

Possible future improvements include:

* Real SMS/email OTP delivery
* Production-grade database deployment
* Advanced geospatial analysis
* More sophisticated anomaly detection
* Integration with verified emergency services
* Improved moderation workflows
* Scalable cloud deployment
* Additional regional languages

---

## Project Goal

> **Turn small, scattered community signals into meaningful safety patterns while protecting citizen privacy and giving authorized authorities the tools to respond.**

### Sanket

**Small Signals. Safer Spaces.**
