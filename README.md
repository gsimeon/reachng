# ReachNG

[![CI](https://github.com/gsimeon/reachng/actions/workflows/ci.yml/badge.svg)](https://github.com/gsimeon/reachng/actions/workflows/ci.yml)

**Every destination. Within reach.**

ReachNG is an enterprise location intelligence and digital postcode platform built for Nigerian commerce, logistics, field operations, and developer integrations. It operationalises the **Nigeria Digital Postcode Address Verification System (NDAPS)** 11-character alphanumeric spatial standard across all 36 States and the Federal Capital Territory (Abuja).

> [!NOTE]
> **Data Accuracy & Verification Notice**: Format checks confirm 11-character alphanumeric structural compliance. Simulated coordinates and district naming represent regional reference centroids for prototyping and testing. Official door-to-door verification requires active, authenticated upstream NDAPS credentials.

---

## Capabilities & Architecture

### 1. Postcode Explorer
* Real-time 11-character alphanumeric format check and normalization.
* **Anatomical Topology Breakdown**: Deconstructs postcodes into:
  * Characters 1–2: State Code (`LA` = Lagos, `FC`/`AB` = Abuja, `RV` = Rivers, `KN` = Kano, etc.)
  * Characters 3–5: Local Government Area (LGA) Zone Code
  * Characters 6–9: Sector & District Area Code
  * Characters 10–11: Delivery Unit / Parcel Block Code
* **Geo-Positioning Card**: Regional reference coordinates (lat/lng), area classification (*Prime Commercial, Urban Residential, Industrial Logistics*), road access tiers, and regional Google Maps view.

### 2. National Postcode Directory & Reverse Lookup
* Reference administrative dataset covering **all 36 Nigerian States + FCT**.
* Filter by geopolitical zone (*South West, South South, South East, North Central, North West, North East*).
* Select State and LGA to generate sample 11-character NDAPS digital postcodes and test format construction.

### 3. Batch Postcode Cleanser & Normalizer
* Process lists of up to 100 digital postcodes at once via `POST /api/batch`.
* Real-time analytics: Total items, Valid format count, and Format errors.
* Export clean, standardized CSV tables for CRM and ERP systems.

### 4. Logistics Corridor & Transit SLA Calculator
* Calculates Haversine distances in kilometers between any two digital postcodes.
* Determines delivery dispatch tiers:
  * **Same-Day Intra-City** (< 35 km)
  * **Regional Highway Express** (Inter-state corridor)
  * **Interstate Haulage** (Cross-country transit)
* Provides estimated transit windows, route classification, and simulated road accessibility models.

### 5. Enterprise Location Book & Dispatch Labels
* Organize business facilities (*Fulfilment Hubs, Retail Stores, Pickup Stations, Dispatch Offices*).
* Live keyword search, category filtering, and one-click CSV export.
* **Courier Dispatch Label Generator**: Thermal routing slips with 11-character NDAPS codes, consignee/origin hub details, and barcode/QR verification blocks.
* **Truthful Dual-Mode Persistence**: Connects to Supabase with PostgreSQL Row-Level Security (RLS) and strict tenant isolation when configured, and falls back to explicit local browser storage in sandbox demo mode.
* **Database Migration**: Canonical multi-tenant schema with triggers and RLS policies at `supabase/migrations/202610260001_initial_schema.sql`.

### 6. Developer API & Integrations Sandbox
* Interactive API runner for `POST /api/postcode`, `POST /api/batch`, and `GET /api/locations`.
* Instant copy-paste code snippets in 4 languages: **cURL**, **JavaScript (Fetch)**, **Node.js (Axios)**, and **Python (Requests)**.
* Client-side webhook event simulator (`postcode.verified`, `location.created`, `address.flagged`) with HMAC signature header preview.
* Server-side provider key isolation: NDAPS government API credentials never leak to client browsers.

---

## Getting Started

### Prerequisites
* Node.js 20+ (LTS)
* npm

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Setup local environment
cp .env.example .env.local

# 3. Run development server
npm run dev

# 4. Open in browser
# http://localhost:3000
```

### Automated Verification & CI
```bash
# Run complete test suite (unit + route integration + tenant isolation)
npm test

# TypeScript typecheck
npm run typecheck

# Code linter
npm run lint

# Production build
npm run build
```

---

## API Reference

### 1. Single Postcode Lookup
* **Endpoint**: `POST /api/postcode`
* **Body**: `{"postcode": "LA010010101"}`
* **Response**: Returns status, message, and anatomical spatial topology.

### 2. Batch Cleanser
* **Endpoint**: `POST /api/batch`
* **Body**: `{"items": ["LA010010101", "AB010020110", "INVALID"]}`
* **Response**: Returns total, valid count, invalid count, and processed rows.

### 3. Location Book
* **Endpoint**: `GET /api/locations` | `POST /api/locations` | `DELETE /api/locations?id={id}`
* **Auth**: Protected by Supabase session cookie when configured.

### 4. Health & Capability Probe
* **Endpoint**: `GET /api/health`
* **Response**: System status, connected database, and active provider gateway mode.

---

## License
MIT
