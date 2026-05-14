# SOC Log Analyzer

A full-stack cybersecurity application that allows SOC (Security Operations Center) analysts to upload web proxy log files, analyze them using AI, and view results in a human-readable format including anomaly detection, event timelines, and threat summaries.

![SOC Log Analyzer](https://img.shields.io/badge/stack-FastAPI%20%7C%20React%20%7C%20PostgreSQL-blue)
![AI](https://img.shields.io/badge/AI-Claude%20Haiku%204.5-purple)

---

## Features

- **Authentication** — JWT-based login and registration
- **Log Upload** — Drag-and-drop or click-to-upload for `.log`, `.txt`, `.csv` files
- **AI-Powered Analysis** — Automatic threat detection and anomaly scoring via Claude API
- **Event Timeline** — Chronological view of significant security events with severity tags
- **Anomaly Detection** — Each anomaly includes a reason, confidence score (0–100%), and category
- **Visual Dashboard** — Bar chart of anomalies by category, stat cards, expandable anomaly entries

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts |
| Backend | FastAPI (Python), SQLAlchemy, JWT Auth |
| Database | PostgreSQL 16 |
| AI | Anthropic Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) |
| Infrastructure | Docker, Docker Compose |

---

## Local Setup & Running

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- An [Anthropic API key](https://console.anthropic.com) with credits

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/soc-log-analyzer.git
cd soc-log-analyzer
```

### 2. Configure environment variables
```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in your values:
```env
DATABASE_URL=postgresql://soc_user:soc_pass@db:5432/soc_db
SECRET_KEY=your-long-random-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ANTHROPIC_API_KEY=sk-ant-...
UPLOAD_DIR=uploads
```

### 3. Start the application
```bash
docker compose up --build
```

This starts three containers:
- `db` — PostgreSQL on port 5432
- `backend` — FastAPI on port 8000
- `frontend` — React/Vite on port 5173

### 4. Open the app
- **App:** http://localhost:5173
- **API docs:** http://localhost:8000/docs

### 5. Register and log in
Go to http://localhost:5173/register, create an account, then sign in.

### 6. Upload a log file
Use the sample log file in `sample_logs/zscaler_sample.log` or upload your own `.log` / `.txt` file. Analysis runs automatically in the background — the status updates from `processing` → `done` within ~30 seconds.

---

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── config.py            # Environment settings
│   │   ├── database.py          # SQLAlchemy setup
│   │   ├── models.py            # DB models: User, LogFile, Analysis
│   │   ├── schemas.py           # Pydantic schemas
│   │   ├── routes/
│   │   │   ├── auth.py          # /api/auth/* endpoints
│   │   │   ├── logs.py          # /api/logs/* endpoints
│   │   │   └── analysis.py      # /api/analysis/* endpoints
│   │   └── services/
│   │       └── ai_analyzer.py   # Claude API integration
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # JWT auth state
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   └── AnalysisPage.tsx
│   │   ├── api.ts               # Axios client
│   │   ├── types.ts             # TypeScript interfaces
│   │   └── App.tsx              # Router + protected routes
│   ├── Dockerfile
│   └── package.json
├── sample_logs/
│   └── zscaler_sample.log       # Example log file for testing
└── docker-compose.yml
```

---

## AI Approach & Anomaly Detection

### How AI is used

All AI functionality is implemented in `backend/app/services/ai_analyzer.py`.

**Model:** `claude-haiku-4-5-20251001` (Anthropic Claude Haiku 4.5)

**Where AI is used:**
1. **Log Analysis** — The raw log file is chunked into 50-line segments and each chunk is sent to Claude with a structured system prompt
2. **Threat Summary** — Claude generates a plain-English executive summary of the log's risk level and key findings
3. **Timeline Generation** — Claude identifies significant security events and returns them in chronological order with severity tags (`info`, `warning`, `critical`)
4. **Anomaly Detection** — Claude flags suspicious log entries and returns structured anomaly objects

**How anomaly detection works:**

Claude is prompted with a strict system prompt that instructs it to act as a SOC analyst and return a JSON object with:

```json
{
  "summary": "...",
  "timeline": [...],
  "anomalies": [
    {
      "line_number": 6,
      "raw_entry": "...",
      "reason": "Malware block: Trojan.GenericKD payload download attempt",
      "confidence": 1.0,
      "category": "malware_indicator"
    }
  ]
}
```

**Anomaly categories detected:**
| Category | Description |
|---|---|
| `malware_indicator` | Known malware/threat names in logs |
| `data_exfiltration` | Large file uploads to external services |
| `suspicious_url` | Hacking tools, uncategorized or risky domains |
| `unusual_hours` | Activity outside normal business hours |
| `high_request_volume` | Repeated identical requests in short timeframes |
| `policy_violation` | Blocked requests, piracy, restricted categories |

**Confidence scoring:**
- Claude assigns a `confidence` float between 0.0 and 1.0 for each anomaly
- The frontend renders this as a colored progress bar (red ≥ 80%, yellow ≥ 60%, blue < 60%)
- Anomalies are sorted by confidence descending so the most critical appear first

**Why Claude API over a local model:**
- Reliable structured JSON output without post-processing hacks
- Strong out-of-the-box security domain knowledge
- No GPU infrastructure required
- For production, fine-tuning a smaller open-source model (e.g. Llama 3 8B) on labeled log datasets would reduce cost and latency

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT token |
| GET | `/api/auth/me` | Get current user info |
| POST | `/api/logs/upload` | Upload a log file |
| GET | `/api/logs/` | List all uploaded logs |
| DELETE | `/api/logs/{id}` | Delete a log file |
| GET | `/api/analysis/{log_id}` | Get analysis results |

Full interactive docs: http://localhost:8000/docs

---

## Sample Log File

A realistic ZScaler Web Proxy log sample is included at `sample_logs/zscaler_sample.log`.

It contains 45 entries with the following planted anomalies for testing:

| Anomaly | Details |
|---|---|
| Malware blocks | `rthomas` hitting malware site 3x in 1 minute |
| Hacking tools | Unknown user downloading nmap via curl |
| Data exfiltration | 100MB `secret_financials_2026.zip` to WeTransfer |
| C2 beacon pattern | 5x rapid Pastebin reads via `python-requests` |
| Crypto mining | `mlee` accessing mining pool at 2 AM |
| Bot activity | 10 identical requests in 10 seconds from unknown IP |
| Sensitive data upload | `employee_data.csv` sent to Dropbox |