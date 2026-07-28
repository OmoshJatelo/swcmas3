# AI‑Powered Smart Waste Compliance, Monitoring and Assessment System (SWCMAS)

## Project Overview
SWCMAS is a **full‑stack, production‑ready** web application that enables county governments to **monitor, enforce, and analyse waste‑management operations**.  It combines:
- **Real‑time collection tracking** (GPS, photo capture, verification workflows)
- **AI‑driven analytics** (complaint classification, risk scoring, automated report generation via DeepSeek)
- **Role‑based dashboards** for administrators, officers, landlords, collectors, and residents
- **In‑app notification system** (with optional email/SMS extensions)
- **Map visualisation** (Leaflet/OpenStreetMap) with heat‑maps for collection density and complaint hotspots
- **Automated scheduling** (cron‑based, conflict‑aware collection generation)
- **Secure authentication** (JWT access/refresh tokens, HttpOnly cookies)
- **Audit logging** for full traceability
- **Dockerised deployment** (MongoDB, backend API, Nginx‑served frontend)   

The codebase is deliberately modular so that each component (auth, schedule, AI, notification, etc.) can be extended or swapped out as requirements evolve.


**SWCMAS** is a full‑stack production‑ready application that helps county governments monitor waste collection activities, manage complaints, enforce compliance, and gain AI‑driven analytics.

---

## Table of Contents
- [Features](#features)
- [Planned Features](#planned-features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running Locally](#running-locally)
- [Docker Compose](#docker-compose)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Development Workflow](#development-workflow)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Features

### Core Platform
- **Role‑Based Access Control** with five roles (County Admin, County Officer, Landlord, Waste Collector, Resident) each seeing a tailored UI and API permissions.
- **Secure JWT authentication** (access token + HttpOnly refresh‑token cookie) with automatic token refresh.
- **Audit logging** for every create, update, delete, and authentication event.

### Data Management
- Full **CRUD** for Users, Apartments, Collections, and Complaints (admin UI with create/edit modals, delete confirmation, pagination).
- **Resident Verification** workflow: system‑generated verification requests for scheduled collections, resident responses with optional notes.
- **Anomaly Detection** service that creates alerts for repeated complaints, suspicious collection durations, and other rule‑based anomalies.

### Collection & Scheduling
- **Automated collection scheduler** (node‑cron) that generates daily/weekly/bi‑weekly collection assignments, respects `MAX_COLLECTIONS_PER_COLLECTOR_DAY`, and reassigns overloads.
- **Collector workflow** – start/complete collection with GPS‑validated timestamps and before/after photos.
- **Landlord verification** of completed collections, scoring based on GPS distance, time spent, and photo verification.

### AI & Analytics
- **DeepSeek AI integration** for automatic complaint classification, priority suggestion, sentiment analysis, and risk scoring.
- **Report generation** (daily, weekly, monthly) that aggregates collection statistics, complaint metrics, landlord compliance, high‑risk areas, and includes an AI‑generated natural‑language summary.
- **Interactive Reports UI** – charts (Recharts/Chart.js), radar/heat‑maps, AI summary panel, downloadable JSON/CSV.

### Visualisation & UI
- **Leaflet map** showing apartments, collection routes, complaint locations, with optional heat‑map overlay.
- **Role‑specific dashboards** with key performance indicators and quick navigation.
- **Responsive design** powered by Tailwind CSS, supporting both desktop and mobile views.

### Infrastructure & Security
- **Docker Compose** orchestration for MongoDB, backend, and Nginx‑served frontend.
- **Security middleware** – Helmet, CORS, XSS‑clean, express‑mongo‑sanitize, rate limiting, and file‑type validation.
- **Cloudinary fallback** (in‑memory storage when credentials are missing) for image uploads.
- **SMTP email** support for password‑reset and future notification emails.

### Extensibility
- Modular service layer enables adding new AI providers, storage back‑ends, or notification channels (SMS, push) with minimal code changes.

---

## Planned Features

- Collection edit functionality (update existing collection via admin UI).
- Export / Download reports (CSV, JSON, PDF) from the Reports UI.
- Publish / schedule reports (automated periodic generation and public visibility).
- Full test coverage for all admin routes (apartments, collections, users, notifications).
- End‑to‑end UI tests for notification flows (e.g., complaint creation → officer sees notification).
- CI/CD pipeline (GitHub Actions) to lint, test, and build on push.
- Resolve duplicate `email` index warning in the `User` schema.
- Configure real Cloudinary credentials for production image storage.
- Configure real SMTP credentials for production email delivery.
- Add SMS gateway integration for urgent alerts.
- Multi‑tenant support for multiple counties.
- Enhanced analytics dashboards (additional charts, drill‑down, export).
- Role‑based email/SMS notifications for critical events.
- Automated health checks and monitoring for Docker containers.

---

## Tech Stack
| Layer | Tech |
|------|------|
| Frontend | React, React Router, Axios, React Query, Tailwind CSS, Leaflet |
| Backend | Node.js, Express.js, JWT, bcrypt, Mongoose |
| Database | MongoDB |
| Storage | Cloudinary |
| AI | DeepSeek API |
| DevOps | Docker, Docker‑Compose |

---

## Prerequisites
- **Node.js** >= 20 (LTS) and npm
- **Docker** & Docker‑Compose (optional, for containerised deployment)
- **MongoDB** (local instance or via Docker)
- **Cloudinary** account for image storage
- **SMTP** credentials for email (e.g., Gmail App Password)
- **DeepSeek API** key

---

## Installation
Clone the repository and install dependencies:
```bash
git clone <repo‑url>
cd swcmas

# Backend
cd backend
cp .env.example .env   # adjust values
npm install

# Frontend
cd ../frontend
cp .env.example .env   # adjust VITE_BACKEND_URL if needed
npm install
```

---

## Running Locally
### Backend
```bash
cd backend
npm run dev   # server on http://localhost:5000
```
The API base path is `/api/v1`.

### Frontend
```bash
cd frontend
npm run dev   # Vite dev server on http://localhost:5000
```
The frontend proxies `/api` requests to the backend (see `vite.config.js`).

---

## Docker Compose
A single `docker-compose.yml` spins up MongoDB, the backend API and the Nginx‑served frontend.
```bash
docker-compose up --build -d
```
- Backend: `http://localhost:5000`
- Frontend (Nginx): `http://localhost`

To stop:
```bash
docker-compose down
```

---

## API Documentation
Swagger UI is available at `http://localhost:5000/api-docs` (when the backend is running). The generated `swagger.json` contains the OpenAPI spec.

---

## Testing
Both backend and frontend have unit & integration test suites.
```bash
# Backend tests
cd backend
npm test

# Frontend tests (Vitest)
cd ../frontend
npm test
```
Add more tests in the `tests/` directories.

---

## Development Workflow
1. **Feature Branches** – Create a branch per feature (`git checkout -b feature/xyz`).
2. **Lint & Format** – Run `npm run lint` and `npm run format` before committing.
3. **Commit Messages** – Follow conventional commits (`feat: add ...`, `fix: resolve ...`).
4. **Pull Requests** – Open a PR against `main`, ensure CI passes, and get approval before merging.
5. **Environment Variables** – Never commit real secrets; use `.env.example` as a template.

---

## Environment Variables
Key variables are documented in `backend/.env.example` and `frontend/.env.example`.
- `JWT_ACCESS_SECRET` & `JWT_REFRESH_SECRET` – strong, random strings in production.
- `CLOUDINARY_*` – Cloudinary credentials.
- `DEEPSEEK_API_KEY` – DeepSeek API key.
- `SMTP_*` – Email server credentials.
- `FRONTEND_URL` – URL used in password‑reset links.

---

## License
MIT License – see `LICENSE` file.

---

*Built with ♥ by the OpenCode AI engineer.*
