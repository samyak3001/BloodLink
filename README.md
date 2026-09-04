# BloodLink — Real-Time Emergency Blood Donor & Hospital Matching Platform

BloodLink is a production-grade full-stack platform engineered to connect hospitals with potentially compatible, nearby blood donors during urgent medical emergencies.

---

## ⚠️ Important Medical Safety & Privacy Principles

> **BloodLink is strictly an emergency coordination and matching engine, NOT a medical diagnosis or clearance system.**
>
> - **Self-Reported Screening:** Donor readiness questionnaires (e.g. interval eligibility, recent wellness) are strictly self-reported and informational. They never constitute clinical clearance.
> - **On-Site Clinical Verification:** Final donor qualification, hemoglobin testing, vitals checking, and transfusion safety are performed solely on-site by certified medical staff.
> - **Privacy by Design & GPS Masking:** Raw donor GPS coordinates are never exposed via APIs or Socket broadcasts. Hospital dashboards and dispatchers only receive distance calculations, estimated transit windows, and city/district-level geographic boundaries.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend (`/client`)** | React 18+, TypeScript, Vite, Tailwind CSS with custom healthcare design system tokens, Lucide React icons, Socket.IO client, Axios |
| **Backend (`/server`)** | Node.js, Express, TypeScript, Socket.IO, Mongoose / MongoDB driver, Helmet, CORS, Express Rate Limit, Zod validation, JSON Web Tokens (JWT), Bcrypt.js |
| **Database & Cache** | MongoDB 7.0 (with 2dsphere geospatial indexing, compound queries, transactional consistency) via Docker Compose or MongoDB Atlas |
| **Testing & Quality** | Vitest, TypeScript strict mode (`noEmit`), tsx, automated regression verification harness (Phases 2–10) |

---

## 📁 Monorepo Project Structure

```
FSD PROJECT/
├── client/                           # Frontend React + TypeScript SPA
│   ├── src/
│   │   ├── api/                      # Axios API clients (auth, donor, hospital, admin, request)
│   │   ├── components/               # Healthcare design system & shared UI primitives
│   │   │   ├── common/               # Button, Input, Modal, Badge, Toast, Spinner, etc.
│   │   │   ├── domain/               # EmergencyRequestCard, DonorMatchCard, MedicalDisclaimer
│   │   │   └── layout/               # Navbar, Sidebar, Footer, AppLayout, ProtectedRoute
│   │   ├── context/                  # AuthContext, NotificationContext, SocketContext
│   │   ├── hooks/                    # useAuth, useSocket, useNotifications, useGeoLocation
│   │   ├── pages/                    # Role-specific portals & dashboards
│   │   │   ├── auth/                 # LoginPage, RegisterPage, Forgot/ResetPasswordPage
│   │   │   ├── donor/                # Dashboard, Requests, DonationHistory, Profile, Notifications
│   │   │   ├── hospital/             # Dashboard, CreateRequest, ActiveRequests, RequestDetails, Profile
│   │   │   ├── admin/                # Dashboard, UsersDirectory, HospitalVerification, AuditLogs
│   │   │   ├── LandingPage.tsx       # Public emergency overview & quick stats
│   │   │   ├── DesignSystemPage.tsx  # Component showroom (/design-system)
│   │   │   └── NotFoundPage.tsx      # 404 page
│   │   ├── routes/AppRoutes.tsx      # Central RBAC routing table
│   │   └── App.tsx                   # Top-level application tree
│   ├── tailwind.config.js            # Healthcare semantic color tokens & radii
│   ├── vite.config.ts                # Vite config with backend proxy
│   └── package.json
├── server/                           # Backend Node.js + Express API & WebSocket Gateway
│   ├── src/
│   │   ├── config/                   # MongoDB connection, blood compatibility rules
│   │   ├── controllers/              # Auth, Donor, Hospital, EmergencyRequest, Admin, Notification
│   │   ├── middleware/               # authenticate, authorize, errorHandler, rateLimiter
│   │   ├── models/                   # User, DonorProfile, HospitalProfile, EmergencyRequest, etc.
│   │   ├── routes/                   # REST API routes mounted under /api
│   │   ├── scripts/                  # seed.ts (turnkey seeder), verifyPhase2–10.ts
│   │   ├── services/                 # matchingService.ts, socketService.ts
│   │   ├── tests/                    # Vitest unit test suite (matching, state machine, JWT)
│   │   ├── types/                    # Shared backend TypeScript definitions
│   │   ├── utils/                    # geo.ts (Haversine), jwt.ts, password.ts
│   │   └── server.ts                 # Express & Socket.IO initialization
│   └── package.json
├── docker-compose.yml                # MongoDB 7.0 container with persistent data volume
├── package.json                      # Monorepo root workspace orchestrator
└── README.md                         # Comprehensive documentation
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Docker Desktop** (optional, for local MongoDB container) or a **MongoDB Atlas** cluster URI

### 2. Monorepo Installation
Clone the repository and install all root and workspace dependencies:

```bash
cd "FSD PROJECT"
npm install
```

### 3. Environment Variables Configuration
Copy the example environment files into active configuration files:

```bash
# Server configuration
cp server/.env.example server/.env

# Client configuration
cp client/.env.example client/.env
```

#### Server Environment Variables (`server/.env`):
| Variable | Default / Example | Purpose |
|---|---|---|
| `PORT` | `5000` | Backend Express server listening port |
| `NODE_ENV` | `development` | `development`, `test`, or `production` |
| `MONGODB_URI` | `mongodb://localhost:27017/bloodlink` | MongoDB connection string |
| `JWT_SECRET` | *(string with min 32 chars)* | Cryptographic key for signing JWT tokens |
| `JWT_EXPIRES_IN` | `7d` | Token expiration duration |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin for Vite client |

#### Client Environment Variables (`client/.env`):
| Variable | Default / Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000/api` | Base URL for REST API endpoints |
| `VITE_SOCKET_URL` | `http://localhost:5000` | Base URL for Socket.IO WebSocket server |

### 4. Database Setup

#### Option A: Local MongoDB via Docker (Recommended)
Start the official MongoDB 7.0 container with persistent volume:

```bash
npm run docker:up
```

To stop the database container later:
```bash
npm run docker:down
```

#### Option B: MongoDB Atlas (Cloud)
1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
2. Create a database user and whitelist your IP (or `0.0.0.0/0`).
3. Set your connection string in `server/.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/bloodlink?retryWrites=true&w=majority
   ```

### 5. Seed Realistic Demo Data
The turnkey seeder populates administrators, verified and pending hospitals, donors across multiple blood groups, emergency requests across all urgency levels, donation histories, and audit logs:

```bash
npm run seed
```

> **Security Guard:** The seeder includes safety gating that prevents running in `production` environments to protect live production databases.

### 6. Start Development Environment
Launch both backend and frontend concurrently in development mode:

```bash
npm run dev
```

- **Client Application:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **Health Diagnostics:** http://localhost:5000/api/health

---

## 🔑 Pre-Seeded Demo Accounts

All seeded demo accounts share the password: **`Password123!`**

| Role | Email | Details / Characteristics |
|---|---|---|
| **Admin** | `admin@bloodlink.org` | System administrator with full access to user management, hospital verifications, and audit logs |
| **Admin (Alternative)** | `admin.test@example.com` | Secondary admin account |
| **Hospital (Verified)** | `metro.hospital@bloodlink.org` | Metro General Hospital (License: `HOSP-METRO-001`, verified, central coordinates) |
| **Hospital (Verified)** | `city.care@bloodlink.org` | City Care Medical Center (License: `HOSP-CITY-002`, verified) |
| **Hospital (Pending)** | `hospital.test@example.com` | Hope Memorial (License: `HOSP-PENDING-003`, pending admin verification) |
| **Donor (O-)** | `alex.donor@example.com` | Universal Whole Blood donor (O-), active and available |
| **Donor (A+)** | `sarah.donor@example.com` | Blood Group A+, available |
| **Donor (B+)** | `michael.donor@example.com` | Blood Group B+, resting (unavailable) |
| **Donor (AB+)** | `priya.donor@example.com` | Universal Plasma donor (AB+), supports multiple components |
| **Donor (O+)** | `donor.test@example.com` | Quick demo donor (O+) |

> **One-Click Login:** On the login page (`/login`), click any quick-fill button to immediately populate credentials for any role.

---

## 📡 API & WebSocket Reference

### Authentication Endpoints (`/api/auth`)
- `POST /api/auth/register` — Register donor or hospital account with role validation
- `POST /api/auth/login` — Authenticate and receive JWT Bearer token
- `GET /api/auth/me` — Retrieve active authenticated session profile
- `POST /api/auth/forgot-password` — Issue password reset request
- `POST /api/auth/reset-password` — Complete password reset with secure hash

### Emergency Blood Requests (`/api/requests`)
- `POST /api/requests` — Dispatch emergency blood request (Hospital only)
- `GET /api/requests` — Query requests with filters (status, urgency, bloodGroup)
- `GET /api/requests/:id` — Request detail with masked donor match list
- `PATCH /api/requests/:id/status` — Transition request state (`ACTIVE`, `MATCHED`, `FULFILLED`, `CANCELLED`, `EXPIRED`)
- `GET /api/requests/:id/matches` — Run matching algorithm and return ranked donors
- `POST /api/requests/:id/respond` — Donor accepts or declines emergency match

### Donor Portal Endpoints (`/api/donors`)
- `GET /api/donors/profile` — Fetch donor profile with screening status
- `PUT /api/donors/profile` — Update address, availability toggle, and screening
- `GET /api/donors/history` — List completed donations and certificates
- `GET /api/donors/nearby-requests` — Geolocation-filtered emergency requests

### Hospital Portal Endpoints (`/api/hospitals`)
- `GET /api/hospitals/profile` — Fetch hospital information & verification badge
- `PUT /api/hospitals/profile` — Update emergency helpline, contact, address
- `GET /api/hospitals/stats` — Metrics on active requests, matches, and response times

### Admin Management Endpoints (`/api/admin`)
- `GET /api/admin/dashboard` — Platform overview stats and metrics
- `GET /api/admin/users` — Searchable user directory with role filters
- `PATCH /api/admin/users/:id/status` — Suspend or activate user accounts
- `GET /api/admin/hospitals` — Hospital verification queue
- `PATCH /api/admin/hospitals/:id/verify` — Approve or reject hospital licenses
- `GET /api/admin/audit-logs` — Immutable audit trail of system events

### Real-Time WebSockets (Socket.IO)
- `join:user` — Joins user-specific notification room (`user:<userId>`)
- `join:hospital` — Joins hospital emergency room (`hospital:<hospitalId>`)
- `emergency:new` — Broadcasts new urgent blood requests to nearby eligible donors
- `match:accepted` / `match:declined` — Real-time donor response alerts for hospitals
- `status:updated` — Live state transitions pushed to all active listeners

---

## 🧪 Testing & Verification Suite

### Automated Unit Tests (Vitest)
Unit tests validate core business logic, matching algorithms, state machine transitions, and JWT middleware without requiring a database connection:

```bash
# Run unit tests
npm test

# Run unit tests with watch mode
npm run test:watch --workspace=server
```

**Unit Test Coverage:**
1. **`matchingService.test.ts`**: ABO/Rh red cell and plasma compatibility matrix, distance proximity scoring, urgency weightings, self-reported screening notes.
2. **`requestStateMachine.test.ts`**: Valid transitions (`ACTIVE` → `MATCHED` → `FULFILLED`), invalid paths, and terminal state enforcement.
3. **`jwtUtils.test.ts`**: Token generation, expiration, malformed signature rejection, and `authorize()` role enforcement middleware.

### Automated Regression Verification Scripts
Each development phase includes an automated verification script:

```bash
# Verify Phase 10
npx tsx server/src/scripts/verifyPhase10.ts

# Run entire regression suite (Phases 2 through 10)
npx tsx server/src/scripts/verifyPhase2.ts
npx tsx server/src/scripts/verifyPhase3.ts
npx tsx server/src/scripts/verifyPhase4.ts
npx tsx server/src/scripts/verifyPhase5.ts
npx tsx server/src/scripts/verifyPhase6.ts
npx tsx server/src/scripts/verifyPhase7.ts
npx tsx server/src/scripts/verifyPhase8.ts
npx tsx server/src/scripts/verifyPhase9.ts
npx tsx server/src/scripts/verifyPhase10.ts
npx tsx server/src/scripts/verifyPhase11.ts
```

### User Settings, Privacy & Data Portability (`/api/users`)
- `GET /api/users/export-data` — Download complete personal data portfolio as JSON (GDPR/Data Rights compliant)
- `PATCH /api/users/privacy` — Configure GPS coordinate masking and contact restriction
- `PUT /api/users/password` — Change password with current password verification
- `DELETE /api/users/account` — Self-service account deletion and PII anonymization

---

## 🐳 Production Full-Stack Containerization

BloodLink provides production-ready Docker containers for the entire stack (Client, Server, MongoDB):

```bash
# Build and run all services in production mode
docker compose -f docker-compose.prod.yml up --build -d

# Check service logs
docker compose -f docker-compose.prod.yml logs -f

# Shut down the production cluster
docker compose -f docker-compose.prod.yml down
```

| Service | Technology | Port | Purpose |
|---|---|---|---|
| `bloodlink-client` | Nginx 1.25 Alpine | `80` | High-performance static web server with Gzip, SPA routing, and API reverse proxy |
| `bloodlink-server` | Node.js 20 Alpine | `5000` | Hardened Express API & Socket.IO server running as non-root user (`node`) |
| `bloodlink-mongodb` | Mongo 7.0 | `27017` | Persistent MongoDB database with health checks and volume storage |

---

## 🧪 Testing & Verification Suite

### TypeScript Type-Checking
Ensures zero type errors across the entire monorepo:

```bash
npm run type-check
```

### Production Build
Tests frontend Vite bundling and backend TypeScript compilation:

```bash
npm run build
```

---

## 📋 Complete Phase Roadmap & Verification Status

- [x] **Phase 1: Project Scaffolding & Architecture Initialization**
  - Monorepo structure, Express server, Vite client, Tailwind setup, Docker Compose.
- [x] **Phase 2: Database Schemas, Security & Geospatial Modeling**
  - Mongoose models, GeoJSON 2dsphere indexes, password hashing, security sanitization.
- [x] **Phase 3: Authentication, RBAC & Profile Management**
  - JWT auth, role guards (`DONOR`, `HOSPITAL`, `ADMIN`), profile management.
- [x] **Phase 4: Emergency Request Lifecycle & Blood Compatibility Matching**
  - Multi-component ABO/Rh compatibility matrix, proximity scoring, state machine.
- [x] **Phase 5: Real-Time Event Engine & Push Notifications**
  - Socket.IO gateway, authenticated rooms, real-time alert broadcasts.
- [x] **Phase 6: Admin Governance & Regulatory Verification**
  - Hospital verification queue, audit logging, account suspension controls.
- [x] **Phase 7: Frontend Design System & Shared Components**
  - Healthcare design system, reusable primitives, domain cards, responsive layout.
- [x] **Phase 8: Role-Based Portals & Dashboards**
  - Complete Donor, Hospital, and Admin dashboards, request creation, management.
- [x] **Phase 9: Comprehensive Seed Data & Demo Experience**
  - Turnkey database seeder, demo accounts, quick credentials, environment gating.
- [x] **Phase 10: Testing, Verification & Production Readiness**
  - Vitest test suite, regression verification, comprehensive documentation, production builds.
- [x] **Phase 11: Privacy & Data Governance & Production Containerization**
  - Personal data export (JSON), self-service account deletion, privacy controls, Dockerfiles, Nginx, and production docker-compose.
- [x] **Phase 12: Interactive Visualizations, Informational Views & Final Polish**
  - Responsive emergency volume trends, donor activity & fulfillment charts; public "How It Works" page (`/how-it-works`), hospital notification feed (`/hospital/notifications`), admin emergency request oversight (`/admin/requests`), WCAG high-contrast focus rings, and reduced-motion accessibility.
