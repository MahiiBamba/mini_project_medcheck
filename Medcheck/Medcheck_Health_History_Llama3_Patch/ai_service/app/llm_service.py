"""Optional local Ollama/Llama 3 integration; no extra Python package required."""
import json
import os
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434/api/generate")
LLAMA_MODEL = os.getenv("LLAMA_MODEL", "llama3.1:8b")


def generate_advice(prompt: str) -> dict:
    payload = json.dumps({
        "model": LLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2},
    }).encode("utf-8")
    request = Request(OLLAMA_URL, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=45) as response:
            raw = json.loads(response.read().decode("utf-8"))
        text = raw.get("response", "").strip()
        result = json.loads(text)
        if not isinstance(result, dict):
            raise ValueError("LLM response must be a JSON object")
        result["llm_model"] = LLAMA_MODEL
        result["llm_available"] = True
        return result
    except (URLError, HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        # Preserve scan functionality if Ollama is unavailable; clearly mark fallback.
        current = "high" if 'visual_risk_level":"high"' in prompt else ("moderate" if 'visual_risk_level":"moderate"' in prompt else "low")
        if current == "high":
            explanation = "The scan detected multiple or proportionally frequent cavities classified as broken. This is a visual finding, not a medical diagnosis."
            recommendations = ["Do not use visibly damaged or potentially compromised medicine until a pharmacist or healthcare professional verifies it.", "Keep the packaging and check the product with a pharmacist."]
            notification = "High visual damage concern detected in your blister-pack scan. Please verify the medication with a pharmacist before using any visibly damaged dose."
        elif current == "moderate":
            explanation = "The scan detected at least one cavity classified as broken. Model predictions can be wrong, so inspect the packaging carefully."
            recommendations = ["Do not use a visibly damaged or potentially compromised dose until a pharmacist or healthcare professional verifies it.", "Retake the image in good lighting if the result looks incorrect."]
            notification = "A possible damaged cavity was detected. Please verify the packaging before using the medication."
        else:
            explanation = "No broken cavities were detected in this scan. This does not guarantee the medication is safe or confirm that a dose was taken."
            recommendations = ["Check the packaging and medicine as usual.", "If anything looks damaged or uncertain, ask a pharmacist."]
            notification = ""
        return {
            "explanation": explanation,
            "recommendations": recommendations,
            "severity": current,
            "notification_required": current == "high",
            "notification": notification,
            "history_summary": "Recent scan history was supplied when available; the fallback response does not perform an LLM-based history comparison.",
            "disclaimer": "Visual analysis is not a medical diagnosis. Verify uncertain or damaged medication with a pharmacist.",
            "llm_model": LLAMA_MODEL,
            "llm_available": False,
            "llm_error": str(exc)[:180],
        }


def generate_health_advice(prompt: str) -> dict:
    """Ask the configured Ollama Llama model for history-based guidance."""
    payload = json.dumps({
        "model": LLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.2},
    }).encode("utf-8")
    request = Request(
        OLLAMA_URL, data=payload,
        headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urlopen(request, timeout=60) as response:
            raw = json.loads(response.read().decode("utf-8"))
        result = json.loads(raw.get("response", "").strip())
        if not isinstance(result, dict):
            raise ValueError("LLM response must be a JSON object")
        recommendations = result.get("recommendations")
        if not isinstance(recommendations, list):
            raise ValueError("LLM recommendations must be a list")
        result["recommendations"] = [str(item)[:500] for item in recommendations[:5] if str(item).strip()]
        result["title"] = str(result.get("title") or "Your medication health insights")[:120]
        result["summary"] = str(result.get("summary") or "")[:2000]
        result["severity"] = result.get("severity") if result.get("severity") in {"low", "moderate", "high"} else "low"
        result["notification_required"] = result.get("notification_required") is True
        result["notification"] = str(result.get("notification") or "")[:500]
        result["history_summary"] = str(result.get("history_summary") or "")[:1000]
        result["disclaimer"] = str(result.get("disclaimer") or "Informational guidance only; consult a pharmacist or clinician for personal medical advice.")[:500]
        result["llm_model"] = LLAMA_MODEL
        result["llm_available"] = True
        return result
    except (URLError, HTTPError, TimeoutError, ValueError, json.JSONDecodeError) as exc:
        return {
            "title": "Personalized insights unavailable",
            "summary": "MedCheck could not reach the configured Llama model, so it cannot provide an LLM-generated interpretation of your history right now.",
            "recommendations": [
                "Check that Ollama is running and the configured model is available.",
                "Keep your medication list and dose records up to date; do not change prescribed doses based on this unavailable report."
            ],
            "severity": "low",
            "notification_required": False,
            "notification": "",
            "history_summary": "History was prepared for the model, but no LLM-based review was completed.",
            "disclaimer": "This is not an LLM-generated medical recommendation. Consult a pharmacist or clinician for personal medical advice.",
            "llm_model": LLAMA_MODEL,
            "llm_available": False,
            "llm_error": str(exc)[:180],
        }
