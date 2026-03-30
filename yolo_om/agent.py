import requests
import json
import re
from risk_scorer import compute_risk_score
from alert_engine import generate_alerts
from timeline_summary import build_timeline_summary, get_timeline_summary


OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3.1:8b"


def build_prompt(data):

    memory = data.get("memory", {})

    return f"""
You are an AI assistant analyzing medication adherence.

Memory Context:
- status: {memory.get('status')}
- days_of_data: {memory.get('days_of_data')}
- total_events: {memory.get('total_events')}
- history: {memory.get('history')}

Rules:
- If memory status is "cold_start", rely only on current observation
- If memory is "sparse", mention limited confidence
- If memory is "sufficient", analyze patterns across time
- Do NOT infer or mention medical prescriptions or treatments as facts.
- Only describe observed behavior from data.
- Avoid statements like "prescribed" or "treatment was given".
- Focus on patterns, not medical decisions.

IMPORTANT:
- Do NOT compute or mention any numeric risk score.
- Only provide qualitative risk_level (low, medium, high).

Return ONLY valid JSON:

{{
  "pattern": "...",
  "risk_level": "low|medium|high",
  "insight": "...",
  "recommendation": "..."
}}

Input:
{data}
"""


def extract_json(text):
    try:
        return json.loads(text)
    except:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group())
        else:
            raise ValueError("No valid JSON found")


# 🔥 Map numeric score → qualitative level
def map_risk_level(score):
    if score < 3:
        return "low"
    elif score < 7:
        return "medium"
    else:
        return "high"


def run_agent(data):
    # Step 1: Build prompt
    prompt = build_prompt(data)

    # Step 2: Call LLM
    response = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_NAME,
            "prompt": prompt,
            "stream": False
        }
    )

    raw_output = response.json()["response"]

    # Step 3: Parse LLM output
    parsed_output = extract_json(raw_output)

    # Step 4: Compute deterministic risk score
    memory = data.get("memory", {})
    yolo_output = data.get("yolo_output", {})

    risk_score = compute_risk_score(memory, yolo_output)

    # Step 5: Derive consistent risk level
    risk_level = map_risk_level(risk_score)

    # Step 6: Alerts
    alerts = generate_alerts(memory, risk_score)

    # Step 7: Timeline summary
    

    timeline_summary = get_timeline_summary(data.get("pack_id"))

    # Step 8: Attach everything
    parsed_output["risk_score"] = risk_score
    parsed_output["risk_level"] = risk_level  # override LLM output
    parsed_output["alerts"] = alerts
    parsed_output["timeline_summary"] = timeline_summary

    return parsed_output