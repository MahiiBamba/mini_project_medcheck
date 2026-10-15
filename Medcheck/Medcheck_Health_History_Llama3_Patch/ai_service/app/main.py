
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from fastapi.concurrency import run_in_threadpool
from fastapi.staticfiles import StaticFiles
from app.inference import analyze_image
from app.memory import get_user_history, get_user_health_history
from app.context_builder import build_context_prompt, build_health_prompt
from app.llm_service import generate_advice, generate_health_advice

app = FastAPI(
    title="MedCheck AI Service",
    description="Medication adherence insights and blister-pack image analysis using YOLOv8 and Llama 3",
    version="1.0.0"
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ANNOTATED_DIR = Path(__file__).resolve().parent.parent / "annotated_images"
ANNOTATED_DIR.mkdir(parents=True, exist_ok=True)

app.mount(
    "/annotated-images",
    StaticFiles(directory=str(ANNOTATED_DIR)),
    name="annotated-images"
)

@app.get("/")
def health_check():
    return {
        "status": "running",
        "service": "MedCheck AI Service"
    }


class HealthRecommendationsRequest(BaseModel):
    user_id: int = Field(gt=0)


@app.post("/api/health-recommendations")
async def health_recommendations(request: HealthRecommendationsRequest):
    """Generate recommendations from this user's medication, adherence and scan history."""
    try:
        history = await run_in_threadpool(get_user_health_history, request.user_id, 7)
        prompt = build_health_prompt(history)
        advice = await run_in_threadpool(generate_health_advice, prompt)
        advice["history_days"] = 7
        advice["history_records"] = {
            "medications": len(history.get("medications", [])),
            "dose_entries": len(history.get("dose_history", [])),
            "scans": len(history.get("recent_scans", [])),
        }
        return {"success": True, "data": advice}
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Could not prepare personalized health recommendations from saved history."
        ) from exc


class ExplainRequest(BaseModel):
    user_id: int = Field(gt=0)
    current_scan: dict


@app.post("/api/explain")
async def explain_scan(request: ExplainRequest):
    """Explain a scan using the user's last 7 days of scan history and local Llama 3."""
    history = await run_in_threadpool(get_user_history, request.user_id, 7, 50)
    prompt = build_context_prompt(history, request.current_scan)
    advice = await run_in_threadpool(generate_advice, prompt)
    advice["history_days"] = 7
    advice["history_scans_considered"] = len(history)
    return {"success": True, "data": advice}


@app.post("/api/analyze")
async def analyze_blister(file: UploadFile = File(...)):
    extension = Path(file.filename or "").suffix.lower()

    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Upload a JPG, JPEG, PNG, or WEBP image."
        )

    temp_path = None

    try:
        # Read at most 10 MB plus one byte to enforce the limit.
        content = await file.read(MAX_FILE_SIZE + 1)

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty."
            )

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image size must not exceed 10 MB."
            )

        # Store the upload temporarily for YOLO inference.
        with NamedTemporaryFile(
            suffix=extension,
            delete=False
        ) as temp_file:
            temp_file.write(content)
            temp_path = Path(temp_file.name)

        result = await run_in_threadpool(
            analyze_image,
            temp_path
        )

        return {
            "success": True,
            "message": "Image analyzed successfully",
            "data": result
        }

    except HTTPException:
        raise

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Image analysis failed. Check the AI service logs."
        ) from exc

    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)

        await file.close()
