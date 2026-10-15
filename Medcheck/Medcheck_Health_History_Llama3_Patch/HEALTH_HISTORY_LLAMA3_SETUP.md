# MedCheck — history-based Llama health recommendations patch

This patch adds a separate Llama-powered **health/adherence insights** workflow. It does not replace YOLO blister detection.

## What it changes

- `AI Insights` gains **Generate personalized recommendations** and displays saved reports.
- The backend sends the authenticated user's ID to the local AI service; the AI service reads only that user's saved medication list, dose-tracking records from the last 7 days, and recent scan summaries.
- Llama's report is stored in the new `health_insights` SQLite table.
- Actionable notifications are saved to the existing `notification_history` table, and shown in Notification History. Duplicate identical AI alerts on the same day are suppressed.
- Existing YOLO scan analysis remains in place.
- The prompt explicitly tells the model not to invent symptoms/diagnoses or change prescribed doses. The current app does not appear to store symptoms or diagnoses, so the model cannot personalize based on information the app does not have.

## Apply it safely (Ubuntu)

1. Stop the frontend, Express backend, and AI service terminals with `Ctrl+C`.
2. Make a backup of your current project files and database before replacing anything:
   ```bash
   cd ~/Desktop/mini_project/Medcheck
   cp server/index.js server/index.js.before-health-insights
   cp src/App.jsx src/App.jsx.before-health-insights
   cp server/medcheck.db server/medcheck.db.before-health-insights
   ```
   If `server/medcheck.db-wal` exists, stop the backend before backing up the DB; do not delete the WAL/SHM files.
3. Extract this patch **into the existing Medcheck project root**, allowing the listed files to be replaced. Do not extract it into a nested `Medcheck/Medcheck` folder.
4. In your existing Conda environment, check the AI-service dependencies:
   ```bash
   conda activate tf_env
   cd ~/Desktop/mini_project/Medcheck
   python -m pip show fastapi uvicorn python-multipart ultralytics
   ```
   Install only packages that are missing. If you choose to install from the file:
   ```bash
   python -m pip install -r ai_service/requirements.txt
   ```
   Use this Conda environment, not system Python.
5. Make sure Ollama is installed and the configured model is available:
   ```bash
   ollama list
   ollama pull llama3.1:8b
   ```
   Ollama must be running locally at `http://127.0.0.1:11434`. If it is not running, start its service/daemon in a separate terminal according to your Ollama installation.
6. Start the AI service from the project root:
   ```bash
   conda activate tf_env
   cd ~/Desktop/mini_project/Medcheck/ai_service
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```
7. In a second terminal, start Express:
   ```bash
   cd ~/Desktop/mini_project/Medcheck/server
   npm start
   ```
8. In a third terminal, start Vite:
   ```bash
   cd ~/Desktop/mini_project/Medcheck
   npm run dev
   ```
9. Log in, open **AI Insights**, and select **Generate personalized recommendations**. The backend creates the new table/notification-column migration automatically without deleting existing records. The first model response may take a while.

## Checks

- Frontend production build passed with Vite.
- Express JavaScript syntax check passed and the server started with the new schema.
- Python files passed compile checks.
- The full live Ollama generation path could not be verified here because it depends on Ollama and the model running on your machine.

If the UI says Llama was unavailable, check Ollama is running and that `ollama list` includes `llama3.1:8b`. A fallback status is shown honestly; it is not presented as a Llama-generated report.

## Important scope and safety

These recommendations are based on **saved medication/adherence records and scan summaries**, not on a diagnosis or a complete clinical record. The app currently has no structured symptom, allergy, condition, or medical-history fields. Add such fields only if you actually want to collect them, and do not use this feature to decide whether to start, stop, or change medication. Confirm medication questions with a pharmacist or clinician.
