# DocuMind — AI-Powered Document Intelligence Platform

A resume-focused document intelligence web application built with FastAPI, PyMuPDF (or PyPDF2), OpenAI structured output, and a responsive HTML/CSS/JavaScript frontend. Runs fully in local-fallback mode without an API key.

---

## Features

- Upload PDF and TXT resumes (maximum 10 MB).
- Extract PDF text with PyMuPDF (preferred) or PyPDF2 (fallback). TXT decoded as UTF-8 or latin-1.
- Helpful validation for empty files, unsupported extensions, unreadable files, and scanned/image-only PDFs.
- Three built-in sample resumes: a standard, a detailed, and an intentionally incomplete one.
- Brief, Detailed, or Bullet-point summaries.
- Basic, Standard, and Detailed analysis levels.
- User-selectable focus fields (Name/email, Skills, Education, Work experience).
- Structured resume JSON: name, email, phone, skills, education, and work experience.
- Pydantic schema validation with `null` for missing scalar fields and `[]` for missing lists.
- Completeness score based on five checks: name, email, skills, education, and work experience.
- Editable extracted fields with one-click completeness recalculation.
- Skills bar chart and information-coverage chart.
- Export analysis JSON and copy summary to clipboard.
- In-session feedback buttons (not transmitted to any server).
- Local heuristic fallback when no API key is configured.

---

## Technology stack

| Layer | Technology |
|---|---|
| Language | Python 3.11+ |
| Web framework | FastAPI + Uvicorn |
| PDF extraction | PyMuPDF (primary), PyPDF2 (fallback) |
| LLM integration | OpenAI API (`gpt-4o-mini` default) |
| Data validation | Pydantic v2 |
| Frontend | HTML5, CSS3, Vanilla JavaScript (no build step) |
| Local dev helper | python-dotenv |

---

## Run locally

### Prerequisites
- Python 3.11 or later
- An OpenAI API key (optional — app works in fallback mode without one)

### Setup

**Windows PowerShell:**
```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**macOS / Linux:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Configure the API key (optional)

Copy `.env.example` to `.env` and fill in your key:
```
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4o-mini
```

**The application automatically loads `.env` via python-dotenv when running locally.**

Alternatively, set variables in the terminal before starting:

*Windows PowerShell:*
```powershell
$env:OPENAI_API_KEY="your_key_here"
$env:OPENAI_MODEL="gpt-4o-mini"
```

*macOS / Linux:*
```bash
export OPENAI_API_KEY="your_key_here"
export OPENAI_MODEL="gpt-4o-mini"
```

### Start the server

**Windows PowerShell:**
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

**macOS / Linux:**
```bash
uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000** in your browser.

Check **http://127.0.0.1:8000/api/health** — the response confirms whether AI is enabled and which PDF backend is active.

---

## Architecture

```
ai_document_intelligence_platform/
├── app/
│   ├── main.py          # FastAPI app: routes, extraction, AI calls, heuristics
│   ├── samples/         # Built-in sample resumes (.txt)
│   └── static/
│       ├── index.html   # Single-page application shell
│       ├── styles.css   # Responsive design, dark-accented palette
│       └── app.js       # Upload, analysis, charts, edit, export
├── .env.example         # Required environment variables template
├── .gitignore           # Excludes secrets, venvs, caches, and dist files
├── render.yaml          # Render web service deployment configuration
├── requirements.txt     # Python dependencies
└── README.md
```

### Request flow

```
Browser  →  POST /api/upload  →  validate & extract text  →  return text
Browser  →  POST /api/analyze →  call_ai()  →  LLM or heuristic  →  JSON
                                              ↓
                                    ResumeExtraction (Pydantic)
                                    completeness()
                                    → { summary, extracted, completeness, … }
```

---

## Extraction logic

1. **File validation:** check extension (`.pdf` or `.txt`), reject empty files, enforce 10 MB limit.
2. **Text extraction:**
   - **PDF:** try PyMuPDF page-by-page; fall back to PyPDF2 if PyMuPDF is not installed.
   - **TXT:** decode as UTF-8 (with BOM support), fall back to latin-1.
   - Reject files with fewer than 20 readable characters with a clear message about scanned PDFs requiring OCR.
3. **Normalisation:** collapse whitespace and excess blank lines; truncate at 100 000 characters.
4. **AI extraction (when API key is set):**
   - Send text, style, level, and focus fields to the LLM with a strict JSON schema.
   - System prompt explicitly marks the resume content as untrusted data and forbids the model from inventing facts.
   - Validate the returned JSON with Pydantic before returning it.
5. **Heuristic extraction (no API key):**
   - Email: regex.
   - Phone: regex for international-format numbers.
   - Name: first short non-numeric line near the top.
   - Skills: pattern-match against a list of 60+ named technologies.
   - Education and work experience: keyword-matched lines.
6. **Response:** `summary`, `key_findings`, `extracted` (validated), `completeness`, `notice`, echoed `analysis_level` and `summary_style`.

---

## Analysis levels

| Level | Behaviour |
|---|---|
| **Basic** | Most important points only; concise field values. |
| **Standard** | Balanced summary and all clearly supported fields. |
| **Detailed** | Thorough summary, useful key findings, detailed experience descriptions. |

The **summary style** (Brief / Detailed / Bullet points) independently controls the format of the summary text.

**Focus fields** tell the model which topics to emphasise in key findings; all schema fields are always extracted regardless of selection.

---

## Validation and completeness

The extraction schema uses:
- Nullable scalar fields (`name`, `email`, `phone`) — `null` when not found.
- List fields (`skills`, `education`, `work_experience`) — `[]` when not found.

The **completeness score** is calculated from five boolean checks (name, email, skills, education, work experience). A field counts as present if a non-empty value was extracted; it does not prove the information is factually correct.

Users can edit any extracted field and click **Recalculate completeness** to update the score based on their corrections. Edits are local to the browser session.

---

## LLM integration and usage limits

- Default model: `gpt-4o-mini` (configurable via `OPENAI_MODEL`).
- Uses OpenAI structured output (`response_format: json_schema`) with `strict: true` to guarantee schema conformance.
- Each analysis call sends the full resume text plus a prompt (approx. 300–2 000 tokens input, 300–600 tokens output for standard mode).
- **Cost:** `gpt-4o-mini` is billed per token at OpenAI's published rates. A typical analysis costs a fraction of a US cent. There is no free tier for the OpenAI API.
- **Without a key:** the app uses a local heuristic fallback. Results are basic and may miss or misclassify fields. This is clearly disclosed in the UI notice.

---

## Known limitations

- Resume-only scope: not a general-purpose document classifier or parser.
- Scanned PDFs (image-only) are not supported. Run OCR first to produce a searchable PDF.
- The heuristic fallback skill list covers ~60 common technologies; niche tools may be missed.
- LLM extraction can still make mistakes. Always verify results against the original document.
- Edits to education and experience lines produce simplified entries; full structured parsing requires the LLM path.
- Feedback is local to the browser session and is not transmitted to any server.
- No user accounts, persistent storage, or production-grade access controls.
- Avoid uploading sensitive documents to an untrusted deployment. Follow your applicable privacy and data-retention requirements.

---

## Deploy to Render

1. Push this project folder to a GitHub (or GitLab) repository.
2. In [Render](https://render.com), click **New → Web Service** and connect the repository.
3. Render auto-detects `render.yaml`; alternatively set manually:
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health check path:** `/api/health`
4. Under **Environment → Secret Files**, add:
   - `OPENAI_API_KEY` — your OpenAI secret key (**mark as secret**).
   - `OPENAI_MODEL` — `gpt-4o-mini` (or another model your account can access).
5. Deploy. Open the Render URL and confirm `/api/health` returns `"status": "ok"`.

> **Free tier note:** Render's free tier spins down after 15 minutes of inactivity; the first request after idle will take ~30 seconds. The app itself has no paid dependencies beyond the OpenAI API.

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Status check. Returns `ai_enabled` and `pdf_backend`. |
| `GET` | `/api/samples` | List of built-in sample resume texts. |
| `POST` | `/api/upload` | Multipart file upload. Returns extracted text. |
| `POST` | `/api/analyze` | JSON body with `text`, `summary_style`, `analysis_level`, `focus_fields`. Returns full analysis. |

---

## Sample documents

| File | Purpose |
|---|---|
| `app/samples/sample_resume.txt` | Standard resume — full fields, expected high completeness. |
| `app/samples/sample_resume_detailed.txt` | Detailed resume with quantified bullet points. |
| `app/samples/sample_resume_incomplete.txt` | Sparse resume — missing phone and work experience. |

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | No | — | OpenAI secret key. Without this, local fallback is used. |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | OpenAI chat model to use. |

---

## Submission checklist

- [ ] Run locally and test all three sample documents.
- [ ] Test a readable PDF, empty file, unsupported file type, and scanned PDF.
- [ ] Configure `OPENAI_API_KEY` and verify AI structured output (check the notice in the UI).
- [ ] Push to GitHub and deploy on Render.
- [ ] Add the deployed Render URL to your submission.
