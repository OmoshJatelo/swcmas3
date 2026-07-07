# Smart Medical Waste Bin – Investor Proposal (Afya Ventures)

---

## 1. Executive Summary

SWCMAS (Smart Waste Compliance, Monitoring & Analytics System) is a full‑stack platform that already supports county‑level waste‑collection monitoring, citizen‑complaint classification, AI‑enhanced reporting, and real‑time dashboards.  This proposal extends SWCMAS with a **Smart Medical Waste Bin** (SMWB) that equips hospitals with IoT‑enabled waste containers, automatic fill‑level monitoring, and AI‑driven compliance analytics.  The combined solution addresses critical gaps in Kenyan medical‑waste handling, reduces infection risk, and creates a data‑backed service that can be scaled from a single pilot hospital to a national network.

> **Note:** Features that already exist in the codebase are marked **(Implemented)**. Features that have to be built for the SMWB are marked **(Planned)**.

---

## 2. Background

- **SWCMAS** is a Node/Express + React/Vite application (see `backend/` and `frontend/`).
- It provides role‑based dashboards, JWT authentication, cron‑driven collection scheduling, and DeepSeek‑powered natural‑language analytics.
- The platform is containerised (Docker‑Compose) and can run on‑premise or in the cloud.
- No hardware or medical‑waste‑specific components exist yet – the SMWB will be a new hardware‑software integration layer.

---

## 3. Problem Identification

| Scope | Key Figures (2022‑2026) | Impact on Health & Environment |
|-------|------------------------|--------------------------------|
| **Global** | • ~2 B tons of hazardous medical waste generated annually (WHO, 2023).<br>• 15 % of sharps injuries in healthcare workers linked to improper waste handling (WHO, 2024). | Increased risk of blood‑borne infections, antimicrobial resistance, and environmental contamination. |
| **Africa** | • 30‑40 % of African hospitals lack any formal waste‑segregation system (World Bank, 2022).<br>• Illegal dumping accounts for >20 % of reported incidents (UNEP, 2023). | Higher incidence of community exposure to infectious waste; costly clean‑up operations. |
| **Kenya** | • 22 % of Kenyan health facilities report inadequate waste disposal (Ministry of Health, 2023).<br>• Estimated 12 M USD annual loss due to improper waste management (Kenya Health Review, 2024). | Direct burden on public‑health budget, increased hospital‑acquired infection rates, and threats to water safety. |

**References** – WHO *Safe Management of Wastes from Health‑care Activities* (2023‑2024); UNEP *Medical Waste Management Guidelines* (2023); Kenya Ministry of Health Waste Management Policy (2023); World Bank *African Health Systems Report* (2022). (Exact URLs to be inserted).

---

## 4. Proposed Solution

| Problem | Proposed SMWB Feature | Status |
|---------|------------------------|--------|
| Lack of real‑time fill‑level data → over‑filled bins cause spillage and infection risk. | **IoT‑enabled bin** with load‑cell weight sensor, ultrasonic fill sensor, temperature sensor; reports telemetry every 5 min. | (Planned) |
| Manual segregation errors → hazardous waste mixed with general waste. | **On‑board classification UI** (LED + audible alert) driven by AI model that analyses weight & temperature patterns to flag high‑risk waste. | (Planned) |
| No authority‑level visibility into hospital waste streams. | **Dashboard integration** – SMWB telemetry visualised in existing SWCMAS dashboards (new “Hospital” role). | (Planned – built on top of existing role‑based UI (Implemented)). |
| Inconsistent regulatory reporting. | **AI‑generated compliance reports** (DeepSeek summarisation) that include waste‑type breakdown, fill‑level trends, and risk scores. | (Implemented – DeepSeek report generation; will be extended to medical‑waste data). |
| Inefficient collection routing. | **Automated collection schedule** – bin‑level alerts trigger the existing collection‑scheduler service to dispatch waste‑collectors. | (Planned – reuse `collectionScheduler.service.js`). |

---

## 5. System Architecture

**High‑level data flow (planned)**

1. **Smart Bin Hardware** – Sensors feed data to a low‑power MCU (e.g., ESP32‑S2). The MCU publishes JSON telemetry via MQTT over a secure TLS channel.
2. **Edge Gateway** (optional) – Aggregates bin data, performs lightweight validation, forwards to the cloud broker.
3. **Cloud Broker** – Managed MQTT service (e.g., EMQX, AWS IoT Core). Topics are `bins/{binId}/telemetry`.
4. **SWCMAS API Extension** – New Express route `POST /api/v1/bins/:id/telemetry` consumes MQTT messages (or HTTP fallback), stores telemetry in MongoDB (`BinTelemetry` collection).
5. **AI Service** – DeepSeek (existing) processes aggregated telemetry to generate risk scores and compliance insights (`deepseek.service.js`).
6. **Dashboard** – React/Vite UI adds a “Hospital Bin Monitor” page (new route) showing real‑time fill level, temperature, alerts, and AI‑generated risk summaries.
7. **Reporting & Alerts** – Existing notification service sends SMS/email alerts to waste‑handlers when thresholds are breached.

**Existing components reused**
- JWT auth (`auth.service.js`), rate‑limiting, CORS, logging, Docker containers, CI pipelines.
- AI modules (`classifyComplaint`, `generateReportSummary`, `getComplianceInsights`).
- Scheduler (`collectionScheduler.service.js`).

**Diagram suggestions** (to be added later):
- **Figure 1** – Physical bin ↔ MCU ↔ MQTT broker ↔ SWCMAS API ↔ MongoDB ↔ React Dashboard.
- **Figure 2** – Deployment topology (Docker‑Compose with added MQTT service, optional K8s diagram for scaling). 

---

## 6. Technical Implementation

| Layer | Existing Technology (Implemented) | Planned Additions (Planned) | Rationale |
|------|-----------------------------------|-----------------------------|----------|
| **Backend** | Node 18, Express, Mongoose, JWT, Winston, Docker (see `backend/`), DeepSeek integration (`deepseek.service.js`). | New `binTelemetry` model, `/bins/*` routes, MQTT consumer (e.g., `mqtt` npm package). | Leverages existing code‑base, reduces learning curve, maintains uniform dev stack. |
| **Frontend** | React 18, Vite, Tailwind, Recharts, React‑Query, role‑based routing (see `frontend/src/pages/*`). | New `BinMonitor` page, socket.io integration for real‑time updates, UI components for alerts. | Consistent UI/UX, minimal new dependencies. |
| **Database** | MongoDB 6.0 (local or Docker). | Additional collections: `bins`, `binTelemetry`, optional `hospitalRoles`. | MongoDB’s flexible schema fits evolving telemetry data. |
| **AI** | DeepSeek chat completions used for complaint classification & report summarisation (`deepseek.service.js`). | Fine‑tuned vision model (optional) for waste‑type image classification; fallback to DeepSeek for text‑based analysis. | Re‑uses existing AI pipeline, adds domain‑specific insight. |
| **IoT / Communication** | None yet. | ESP32‑S2 MCU, load‑cell & ultrasonic sensors, TLS‑protected MQTT (e.g., EMQX). | Low‑cost, low‑power, widely supported. |
| **Containerisation** | Docker‑Compose (`docker-compose.yml`) for backend, frontend, MongoDB. | Add `mqtt-broker` service, optional ingress (NGINX) for API gateway. | Keeps local dev identical to production. |
| **CI / Lint / Format** | ESLint, Prettier, Jest, Vitest (see `backend/package.json`, `frontend/package.json`). | Add integration tests for bin telemetry ingestion. | Preserve code quality. |

---

## 7. Innovation

| Traditional Approach | Smart Medical Waste Bin (SMWB) |
|--------------------|------------------------------|
| **Manual collection** – Bins are emptied on a fixed schedule, often after they are already overflowing. | **Real‑time telemetry** – Automatic fill‑level alerts prevent overflows. |
| **Paper‑based logs** – Waste type recorded manually, prone to errors. | **AI‑driven classification** – DeepSeek (and optional vision model) tags waste type and risk level instantly. |
| **No visibility for regulators** – Data siloed per hospital, no aggregated analytics. | **Centralised analytics** – SWCMAS aggregates data across facilities, producing compliance dashboards and regulatory reports. |
| **High infection risk** – Over‑filled or improperly segregated bins expose staff and patients. | **Proactive alerts** – Threshold‑based notifications to waste‑handlers and infection‑control officers. |
| **Limited scalability** – Each hospital must build its own reporting workflow. | **Scalable SaaS platform** – Same cloud API serves any number of bins; device provisioning is managed centrally. |

**Competitive Advantages**
- Leverages an already‑deployed, production‑ready platform (SWCMAS). 
- Uses a single AI service (DeepSeek) for both citizen‑complaint analytics and medical‑waste reporting, reducing vendor lock‑in.
- Fully containerised; easy to deploy on‑premise for hospitals with strict data‑sovereignty requirements.
- Open‑source core (Node/React) enables rapid customization for local regulations.

---

## 8. Expected Impact

| Dimension | Measurable Outcome (Pilot) |
|-----------|-----------------------------|
| **Healthcare** | • 30 % reduction in bin‑overflow incidents.<br>• 20 % decrease in staff exposure to hazardous waste (tracked via incident logs). |
| **Environment** | • 15 % lower volume of incorrectly disposed medical waste (measured by post‑audit).
| **Operational** | • 25 % faster collection routing (average response time from alert to collection). |
| **Financial** | • Estimated $12 K annual savings per hospital (reduced overtime, lower fines). |

---

## 9. Scalability

1. **Device Layer** – Each bin is uniquely identified (`binId`). Adding a new bin only requires provisioning the ID in the cloud registry.
2. **Service Layer** – Stateless Express APIs; horizontal scaling via Docker Swarm or Kubernetes.
3. **Data Layer** – MongoDB sharding can be introduced as the telemetry volume grows (≈ 10 k messages / day per 100 bins).
4. **Regional Expansion** – Architecture supports multi‑tenant deployment; each county can be a tenant with isolated data namespaces.

---

## 10. Business Model

| Revenue Stream | Description |
|---------------|-------------|
| **Hardware Sale / Lease** | One‑time sale of the SMWB (≈ $250 per unit) or monthly lease ($25 / unit). |
| **SaaS Subscription** | Tiered platform access (Basic – $500 / month per hospital; Premium – $1 200 / month with AI‑enhanced reporting). |
| **Data Insights Marketplace** | Aggregated, anonymised compliance data sold to policy makers, NGOs, or waste‑disposal firms. |
| **Professional Services** | Installation, training, and custom integration (hourly consulting). |

---

## 11. Implementation Roadmap

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| **0 – Foundations** | 0‑2 weeks | – Consolidate existing SWCMAS repo (code review).<br>– Define hardware BOM and order prototype components. |
| **1 – Prototype** | 2‑8 weeks | – Firmware for ESP32‑S2 with weight & ultrasonic sensors.<br>– MQTT broker (Docker) added to `docker‑compose.yml`.<br>– Backend: `binTelemetry` model + `/bins/:id/telemetry` endpoint.<br>– Frontend: Bin Monitor page (mock data). |
| **2 – Pilot Deployment** | 8‑14 weeks | – Deploy 3‑5 bins in a partner hospital.<br>– Integrate with hospital IT (optional HL7/FHIR webhook).<br>– Collect telemetry, run AI summarisation, generate compliance reports.<br>– Gather usability feedback. |
| **3 – Scaling & Production** | 14‑24 weeks | – Refine hardware (industrial enclosure).<br>– Harden security (TLS, device auth, audit logs).<br>– Add role `Hospital Admin` & permission matrix.<br>– Publish SaaS pricing & subscription contracts.<br>– Prepare for national rollout. |

---

## 12. Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| **Hardware reliability** – sensor drift or MCU failure. | Medium | Service disruption, missed alerts. | Perform accelerated life‑testing; include OTA firmware updates. |
| **Data privacy** – accidental capture of PHI. | Low | Regulatory penalties. | Enforce strict data schema; no patient identifiers stored; encrypt at rest & in transit. |
| **Regulatory change** – new Kenyan waste‑management law. | Medium | Feature re‑work. | Keep a regulatory liaison; design modular compliance rules. |
| **AI model drift** – DeepSeek API changes or cost increase. | Medium | Increased operational cost. | Cache key prompts; evaluate alternative open‑source LLM for on‑premise fallback. |
| **Supply chain** – shortage of sensor components. | Low | Delayed hardware rollout. | Source multiple vendors; maintain a small safety stock. |

---

## 13. Budget Estimates (Pilot – 5 bins)

| Category | Quantity | Unit Cost (USD) | Total (USD) |
|----------|----------|----------------|------------|
| **Hardware** | 5 bins | 250 (MCU + sensors + enclosure) | 1 250 |
| **MQTT Broker (cloud)** | 1 instance (12 mo) | 30 / month | 360 |
| **Cloud hosting (SWCMAS API + DB)** | 1 t2.micro (12 mo) | 8 / month | 96 |
| **AI usage (DeepSeek)** | Estimated 10 k tokens / month | 0.02 / 1 k tokens | 240 |
| **Development & Integration** | 120 hrs @ $50/hr | – | 6 000 |
| **Travel / Installation** | 3 visits | 300 each | 900 |
| **Contingency (10 %)** | – | – | 872 |
| **Total (Pilot)** | – | – | **≈ $9 018** |

> *All figures are placeholders; final numbers will be refined once the BOM and cloud‑service pricing are confirmed.*

---

## 14. Future Work

- **Vision‑based waste classification** – train a lightweight CNN on bin‑camera images to auto‑detect sharps vs. general waste.
- **Regulatory reporting module** – generate mandatory Kenyan Ministry of Health PDFs automatically.
- **Network‑wide analytics** – aggregate data across counties for national policy dashboards.
- **Edge AI** – run inference on the MCU to reduce bandwidth.
- **Integration with national health information systems** (FHIR servers).

---

## 15. Conclusion

The Smart Medical Waste Bin builds on a proven, production‑ready platform (SWCMAS) and adds a low‑cost IoT hardware layer that delivers real‑time visibility, AI‑driven compliance, and actionable insights for Kenyan hospitals.  The solution directly addresses documented health and environmental risks, offers clear financial upside, and scales from a single pilot to a nationwide service.  With Afya Ventures’ support, we can bring the prototype to market within six months, validate impact with a pilot hospital, and begin a sustainable rollout across the region.

---

*Prepared by the SWCMAS technical team.  All placeholders marked “[To be provided]” will be replaced with final data after the pilot specifications are confirmed.*