"""
AI-powered log analysis service using the Anthropic Claude API.

HOW AI IS USED HERE:
- We send chunks of parsed log lines to Claude claude-haiku-4-5-20251001.
- Claude returns a structured JSON response containing:
    1. summary       – a plain-English executive summary for a SOC analyst
    2. timeline      – key events in chronological order with severity tags
    3. anomalies     – flagged entries with reasons and confidence scores
- We then store those results in PostgreSQL for the frontend to display.
"""

import json
import traceback
import anthropic
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from app.database import SessionLocal
from app.models import LogFile, Analysis
from app.config import settings

MAX_LINES_PER_CHUNK = 50
API_TIMEOUT_SECONDS = 120

SYSTEM_PROMPT = """You are an expert SOC (Security Operations Center) analyst.
Analyze the given web proxy log entries and return ONLY a valid JSON object — no markdown, no text outside the JSON.

Return this exact shape:
{
  "summary": "<2-3 sentence summary of key findings and risk level>",
  "timeline": [
    {
      "timestamp": "<timestamp string>",
      "event": "<brief one-sentence description>",
      "source_ip": "<IP or null>",
      "destination": "<domain or null>",
      "action": "<allowed|blocked|null>",
      "severity": "<info|warning|critical>"
    }
  ],
  "anomalies": [
    {
      "line_number": <int or null>,
      "raw_entry": "<log line truncated to 150 chars>",
      "reason": "<brief reason, max 100 chars>",
      "confidence": <float 0.0-1.0>,
      "category": "<high_request_volume|suspicious_url|data_exfiltration|unusual_hours|malware_indicator|policy_violation|other>"
    }
  ]
}

Rules:
- Timeline: only include warning/critical events, skip routine allowed traffic. Max 20 timeline entries.
- Anomalies: only flag genuinely suspicious entries. Max 15 anomalies.
- Keep all string values short and concise.
- Raw entry max 150 characters.
"""

def _build_user_prompt(log_chunk: str, start_line: int) -> str:
    return f"Analyze the following log entries (starting at line {start_line}):\n\n{log_chunk}"

def _call_claude_sync(log_chunk: str, start_line: int) -> dict:
    """Synchronous Claude API call — runs inside a ThreadPoolExecutor."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=16000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": _build_user_prompt(log_chunk, start_line)}],
    )
    raw = msg.content[0].text.strip()
    # Strip accidental markdown fences
    if "```" in raw:
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()
    # Extract just the JSON object in case there's extra text
    start = raw.find("{")
    end = raw.rfind("}") + 1
    if start == -1 or end == 0:
        raise ValueError(f"No JSON object found in Claude response: {raw[:200]}")
    return json.loads(raw[start:end])

def _merge_results(results: list) -> dict:
    if not results:
        return {"summary": "No data", "timeline": [], "anomalies": []}

    summaries, merged_timeline, merged_anomalies = [], [], []
    for r in results:
        summaries.append(r.get("summary", ""))
        merged_timeline.extend(r.get("timeline", []))
        merged_anomalies.extend(r.get("anomalies", []))

    combined_summary = " | ".join(summaries) if len(results) > 1 else (summaries[0] if summaries else "")
    return {"summary": combined_summary, "timeline": merged_timeline, "anomalies": merged_anomalies}

def analyze_log_file(log_file_id: int):
    """Background task: read file, call Claude in a thread, persist results."""
    db = SessionLocal()
    try:
        log_file = db.query(LogFile).filter(LogFile.id == log_file_id).first()
        if not log_file:
            print(f"[ai_analyzer] log_file_id={log_file_id} not found")
            return

        log_file.status = "processing"
        db.commit()
        print(f"[ai_analyzer] Starting analysis for log_file_id={log_file_id}")

        with open(log_file.file_path, "r", errors="replace") as f:
            lines = f.readlines()

        total_lines = len(lines)
        print(f"[ai_analyzer] Read {total_lines} lines")

        chunks = [lines[i:i + MAX_LINES_PER_CHUNK] for i in range(0, total_lines, MAX_LINES_PER_CHUNK)]

        chunk_results = []
        with ThreadPoolExecutor(max_workers=1) as executor:
            for idx, chunk in enumerate(chunks):
                chunk_text = "".join(chunk)
                start_line = idx * MAX_LINES_PER_CHUNK + 1
                print(f"[ai_analyzer] Calling Claude for chunk {idx+1}/{len(chunks)}")
                future = executor.submit(_call_claude_sync, chunk_text, start_line)
                try:
                    result = future.result(timeout=API_TIMEOUT_SECONDS)
                    chunk_results.append(result)
                    print(f"[ai_analyzer] Chunk {idx+1} done")
                except FuturesTimeoutError:
                    print(f"[ai_analyzer] Chunk {idx+1} timed out after {API_TIMEOUT_SECONDS}s")
                    raise Exception(f"Claude API timed out on chunk {idx+1}")

        merged = _merge_results(chunk_results)

        analysis = Analysis(
            log_file_id=log_file_id,
            summary=merged["summary"],
            timeline=json.dumps(merged["timeline"]),
            anomalies=json.dumps(merged["anomalies"]),
            total_entries=total_lines,
            anomaly_count=len(merged["anomalies"]),
        )
        db.add(analysis)
        log_file.status = "done"
        db.commit()
        print(f"[ai_analyzer] Analysis complete for log_file_id={log_file_id}")

    except Exception as e:
        print(f"[ai_analyzer] ERROR for log_file_id={log_file_id}: {e}")
        traceback.print_exc()
        log_file = db.query(LogFile).filter(LogFile.id == log_file_id).first()
        if log_file:
            log_file.status = "error"
            db.commit()
    finally:
        db.close()