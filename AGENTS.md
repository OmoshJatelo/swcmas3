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
- AI service tests: `forecasting.test.js`, `collectorCoach.test.js`, `assignment.test.js`, `anomalyPlaybook.test.js`, `nvidia.service.test.js` — all pass
- Run AI tests: `npm test -- tests/forecasting.test.js tests/collectorCoach.test.js tests/assignment.test.js tests/anomalyPlaybook.test.js tests/nvidia.service.test.js --no-coverage`
- Jest config uses `--forceExit --detectOpenHandles`; some tests timeout if MongoDB not ready

## Environment Variables (required)

Backend `.env`:
```
MONGODB_URI=
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
DEEPSEEK_API_KEY=
NVIDIA_API_KEY=nvapi-...          # optional; if set, uses NVIDIA Build API
NVIDIA_API_URL=https://integrate.api.nvidia.com/v1
NVIDIA_DEFAULT_MODEL=openai/gpt-oss-20b
NVIDIA_MODEL_CLASSIFY=openai/gpt-oss-20b
NVIDIA_MODEL_REPORT=openai/gpt-oss-20b
NVIDIA_MODEL_PLAYBOOK=openai/gpt-oss-20b
NVIDIA_MODEL_COMPLIANCE=openai/gpt-oss-20b
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

## AI / LLM Integration

- **Provider**: Dynamic — uses NVIDIA Build API if `NVIDIA_API_KEY` is set, otherwise falls back to DeepSeek
- **NVIDIA Base URL**: `https://integrate.api.nvidia.com/v1` (OpenAI-compatible)
- **Default Model**: `openai/gpt-oss-20b` (128K context, JSON mode supported)
- **Client**: `backend/src/services/nvidia.service.js` (axios-based, retry logic, 429/402 handling)
- **Unified Caller**: `backend/src/services/deepseek.service.js` → `callLLM()` selects provider at call time (not module load) for test isolation
- **Per-use-case model overrides**: `NVIDIA_MODEL_CLASSIFY`, `NVIDIA_MODEL_REPORT`, `NVIDIA_MODEL_PLAYBOOK`, `NVIDIA_MODEL_COMPLIANCE`

## AI Endpoints

| Feature | Endpoint | Uses LLM |
|---------|----------|----------|
| Anomaly playbook | `GET /api/v1/anomalies/:id/playbook` | Yes (NVIDIA) |
| Auto-assign complaint | automatic on `POST /api/v1/complaints` | Yes (background) |
| Collector coach tips | `GET /api/v1/dashboard/collector/coach-tips` | Yes (rule-based, no LLM) |
| Fill-level forecast | `GET /api/v1/forecasting/apartment/:id` | No (linear regression) |
| Predictive schedule | `GET /api/v1/predictive/schedule/optimized` | No (rule-based) |
| Natural language query | `POST /api/v1/ai/query` | Template matching only |

## Gotchas

- **Cloudinary**: `multer-storage-cloudinary` v4 uses default export (`const CloudinaryStorage = require('multer-storage-cloudinary')`)
- **Tests**: Jest config uses `--forceExit --detectOpenHandles`; some tests timeout if MongoDB not ready
- **Docker**: Uses `nginx` for frontend; `docker-compose.yml` has no `.env` by default
- **Health check**: `GET /health` (no `/api/v1` prefix)
- **Provider selection**: Evaluated at **call time** via `getActiveProvider()` in `deepseek.service.js` — critical for test isolation when mocks differ across test files
- **MongoDB Atlas**: Requires valid SRV record; DNS failures = `querySrv ENOTFOUND`
- **Token expiry**: Access tokens 15m, refresh 7d — re-login if 401 on AI endpoints