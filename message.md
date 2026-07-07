# Missing Pieces Needed to Create the Investor‑Grade Proposal
*(Smart Medical Waste Bin – SWCMAS extension)*

Below is the exact list of information and artefacts we still need before we can complete the 12‑page proposal for Afya Ventures.

| # | Item Needed | Why It’s Required |
|---|-------------|-------------------|
| 1 | **Scope clarification** – Is the Smart Medical Waste Bin a standalone hardware product that plugs into SWCMAS, or a new module/extension of the existing platform? | Determines product positioning (extension vs. new product) and influences the overall narrative. |
| 2 | **Hardware specification / Bill of Materials** – MCU (e.g., ESP32, STM32), sensors (load‑cell/weight, ultrasonic/fill‑level, temperature, RFID/QR), connectivity (Wi‑Fi, LoRa, NB‑IoT, LTE), power source (battery size, solar option), enclosure design (materials, IP rating), and *approximate unit cost* for each component. | Needed for the **System Architecture** diagram, **Hardware Cost** table, and the “Innovation” section. |
| 3 | **Telemetry payload definition** – Exact JSON fields the bin will push (e.g., `binId`, `timestamp`, `weight`, `fillPct`, `temperature`, `wasteClass`, `photoUrl`). | Required to extend the backend Mongo schema and to document the API contract `/api/v1/bins/:id/telemetry`. |
| 4 | **API contract for bin data** – Desired endpoint(s) (e.g., `POST /api/v1/bins/:id/telemetry`, `GET /api/v1/bins/:id/status`) and authentication method (JWT, API key, etc.). | Forms the **Data‑flow** description and the security model. |
| 5 | **Extended data model** – MongoDB schema additions for medical‑waste‑specific fields (waste class, sterilisation timestamp, temperature, photos, etc.). | Allows us to map features to regulatory requirements and to show the backend changes. |
| 6 | **Regulatory references** – Up‑to‑date Kenyan Ministry of Health waste‑management guidelines, WHO “Safe Management of Wastes from Health‑care Activities” (2022‑2024), UNEP medical‑waste standards, and any other local statutes. | Supports the **Problem Identification** and **Compliance** sections with credible citations. |
| 7 | **Pilot site details** – Names and locations of hospitals/clinics, number of bins to be installed in the pilot, expected daily waste volume, and any existing MoU or contract references. | Drives the **Implementation Roadmap**, **Scalability**, and **Budget** (hardware procurement for the pilot). |
| 8 | **New user roles (if any)** – e.g., *Hospital Admin*, *Infection‑Control Officer*, *Waste‑Handler*, plus a brief permission matrix. | Impacts the frontend role‑based UI and backend RBAC definitions. |
| 9 | **Hospital‑IT integration requirements** – Need to push data to an EHR/HIS (HL7/FHIR) or consume inventory/asset‑management APIs? | Influences the **System Architecture** diagram and security considerations. |
|10| **AI strategy for medical waste** – Plan to train a custom vision model (YOLO/CLIP) on waste images, or to rely on DeepSeek’s language model for text‑based classification? | Shapes the **Innovation** and **Technical Implementation** sections (model licensing, compute cost). |
|11| **Security / privacy constraints** – Will any patient‑identifiable data (ward IDs, patient IDs) be transmitted with bin telemetry? | Needed for the **Risk Assessment** and to outline encryption / audit‑logging measures. |
|12| **Hosting / operations plan** – Preferred cloud provider (AWS, Azure, local Kenyan data centre), expected SLA for the dashboard, existing CI/CD pipelines. | Impacts the **Scalability**, **Budget**, and ongoing operational cost estimates. |
|13| **`.env.example` file** – Template with placeholders for `MONGODB_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `DEEPSEEK_API_KEY`, SMTP variables, etc. | Guarantees a reproducible development setup for reviewers and removes a glaring gap. |
|14| **UI mock‑ups / wireframes** for the bin‑monitoring dashboard (real‑time fill level, alerts, maintenance schedule) and any new role‑based screens. | Will be referenced in the **System Architecture** diagrams and the **Feature‑to‑Problem** mapping. |
|15| **Cost estimate for hardware** – Unit price for each component, total per‑bin cost, and projected total cost for the pilot deployment. | Required for the **Budget Estimates** table and to demonstrate financial viability. |

**Next steps**

Please share any of the above items you already have (documents, code snippets, sketches, contracts, etc.) or let me know if you need help producing any of them. The sooner we gather this information, the faster we can finalize a polished, data‑driven proposal for Afya Ventures.

Thank you!

— *[Your Name]*, Technical Lead – SWCMAS / Smart Medical Waste Bin project