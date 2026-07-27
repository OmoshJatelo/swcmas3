# SWCMAS — Agent Quick Reference

## Repo Structure
```
/swcmas3
├── backend/          # Express + Mongoose API (port 5000)
├── frontend/         # React + Vite + Tailwind (port 5173)
├── docker-compose.yml
└── README.md
```

## Essential Commands

| Task | Command |
|------|---------|
| Backend dev | `cd backend && npm run dev` |
| Frontend dev | `cd frontend && npm run dev` |
| All tests (backend) | `cd backend && npm test` |
| Single test file | `cd backend && npm test -- tests/forecasting.test.js` |
| Lint (backend) | `cd backend && npm run lint` |
| Format (backend) | `cd backend && npm run format` |
| Seed DB | `cd backend && npm run seed` |
| Docker up | `docker-compose up --build -d` |

## Key Facts

- **API base path**: `/api/v1` (not `/api`)
- **Frontend proxy**: `vite.config.js` proxies `/api/v1` → `localhost:5000`
- **Auth**: JWT access token (15m) + HttpOnly refresh cookie (7d)
- **Roles**: `county_admin`, `county_officer`, `landlord`, `waste_collector`, `resident`

## Testing Quirks

- `tests/setup.js` mocks `node-cron`, `anomaly.service`, `collectionScheduler.service`
- Some existing tests fail due to unmocked SMTP/cron in test setup — **not related to new code**
- New AI service tests: `forecasting.test.js`, `collectorCoach.test.js`, `assignment.test.js`, `anomalyPlaybook.test.js` — all pass
- Run new tests: `npm test -- tests/forecasting.test.js tests/collectorCoach.test.js tests/assignment.test.js tests/anomalyPlaybook.test.js --no-coverage`

## Environment Variables (required)

Backend `.env`:
```
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
DEEPSEEK_API_KEY=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
SMTP_HOST=, SMTP_PORT=, SMTP_USER=, SMTP_PASS=
FRONTEND_URL=http://localhost:5173
```

Frontend `.env`:
```
VITE_BACKEND_URL=http://localhost:5000
```

## New AI Endpoints (on `ai-enhancements` branch)

| Feature | Endpoint |
|---------|----------|
| Anomaly playbook | `GET /api/v1/anomalies/:id/playbook` |
| Auto-assign complaint | automatic on `POST /api/v1/complaints` |
| Collector coach tips | `GET /api/v1/dashboard/collector/coach-tips` |
| Fill-level forecast | `GET /api/v1/forecasting/apartment/:id` |
| Predictive schedule | `GET /api/v1/predictive/schedule/optimized` |
| Natural language query | `POST /api/v1/ai/query` |

## Gotchas

- **Cloudinary**: `multer-storage-cloudinary` v4 uses default export (`const CloudinaryStorage = require('multer-storage-cloudinary')`)
- **Tests**: `jest` config uses `--forceExit --detectOpenHandles`; some tests timeout if MongoDB not ready
- **Docker**: Uses `nginx` for frontend; `docker-compose.yml` has no `.env` by default
- **Health check**: `GET /health` (no `/api/v1` prefix)