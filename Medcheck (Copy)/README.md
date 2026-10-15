# MedCheck — AI-Based Medication Monitoring System

MedCheck is a medication monitoring application designed to help users manage medication schedules and monitor visible pill conditions using computer vision. The project combines a React web application, an Express backend, a SQLite database, and a YOLOv8-based AI service to support medication adherence monitoring and risk analysis.

## Features

- **User Authentication:** Register and log in to the application.
- **Medication Management:** Manage medicines and their schedules.
- **Medication Monitoring:** Analyze blister-pack images using computer vision.
- **Adherence Tracking:** Support statuses such as `on_time`, `late`, `missed`, and `double`.
- **AI-Based Image Analysis:** Detect intact and broken blister cavities using a trained YOLOv8 model.
- **Detection Visualization:** Display annotated images, detection counts, and confidence scores.
- **Risk Analysis:** Support medication-related risk analysis through predefined rules and AI-assisted analysis.
- **Web Interface:** Access available functionality through a React-based frontend.

> **Important:** Image analysis identifies visible blister-pack conditions. It cannot confirm that a person swallowed a medicine. Feature availability depends on the current implementation and service configuration.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite, JavaScript, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | SQLite |
| AI Service | Python, FastAPI |
| Object Detection | YOLOv8, OpenCV |
| AI-Assisted Analysis | Ollama, Llama 3.1 (where configured) |
| API Communication | REST API |

## Prerequisites

Install the following tools:

1. **Node.js and npm:** Install a supported LTS version from https://nodejs.org/
2. **Python:** Install a version compatible with the AI dependencies from https://www.python.org/
3. **Git:** https://git-scm.com/
4. **Visual Studio Code:** Recommended for development.
5. **Trained YOLOv8 weights:** Required for AI image analysis. Obtain the authorized `best.pt` file from the project team.
6. **Ollama:** Required only if the configured LLM functionality is being used. Download it from https://ollama.com/

Verify Node.js and npm:

```bash
node -v
npm -v
```

Verify Python:

```bash
python --version
```

## 1. Clone the Repository

```bash
git clone https://github.com/MahiiBamba/mini_project_medcheck.git
cd mini_project_medcheck/Medcheck
```

If you already have the repository, open the existing `Medcheck` application directory.

## 2. Configure the Backend

Open a terminal in the `Medcheck` directory and navigate to the backend:

```powershell
cd server
npm install
```

Create a local `.env` file using the example file, if available:

```powershell
Copy-Item .env.example .env
```

Open `server/.env` and configure the required environment variables. For example:

```env
SESSION_SECRET=replace-with-your-own-strong-random-secret
```

Use a private, randomly generated secret. Do not commit `.env` or share its contents.

Start the backend:

```bash
npm start
```

The backend is expected to run at:

```text
http://localhost:5000
```

Keep this terminal running.

## 3. Configure the Frontend

Open a second terminal in the main `Medcheck` directory, not inside `server`.

If necessary, return to the application directory:

```powershell
cd ..
```

Install frontend dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev
```

Vite will display the local development URL, usually:

```text
http://localhost:5173
```

Open that URL in your browser.

Keep the frontend and backend terminals running while testing the application.

## 4. Configure the AI Service

The AI service runs separately from the React frontend and Express backend.

### Step 4.1: Navigate to the AI service

Open a third terminal in the main `Medcheck` directory:

```powershell
cd ai_service
```

### Step 4.2: Create a Python virtual environment

```powershell
python -m venv .venv
```

Activate it in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell blocks activation, use an appropriate Python environment activation method permitted on your system.

### Step 4.3: Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Step 4.4: Configure the trained model

Place the authorized trained model file at:

```text
Medcheck/ai_service/models/best.pt
```

Create the `models` directory if it does not exist.

**Note:** Model weights are not included in the Git repository by default. Obtain the file separately from the project team.

### Step 4.5: Start the AI service

From inside `ai_service`, run:

```bash
python -m uvicorn app.main:app --reload --port 8000
```

The AI service should be available at:

```text
http://127.0.0.1:8000
```

If the FastAPI application exposes interactive API documentation, you can check:

```text
http://127.0.0.1:8000/docs
```

Keep the AI service terminal running while testing image analysis.

## 5. Test AI Image Analysis

After configuring all three services:

1. Start the Express backend on port `5000`.
2. Start the FastAPI AI service on port `8000`.
3. Start the React frontend on port `5173`.
4. Open the frontend in your browser.
5. Log in or register if authentication is enabled.
6. Navigate to the medicine scanning page.
7. Upload a clear blister-pack image.
8. Run the analysis and review the detection counts, annotated image, and individual confidence scores.

The frontend sends the uploaded image to the Express backend, which forwards it to the AI service. The AI service runs YOLOv8 inference and returns the detection results.

If analysis fails, verify that all services are running and that the model file and Python dependencies are available.

## 6. Optional: Configure Ollama

Ollama is needed only if the current application configuration uses local LLM-assisted analysis.

Install Ollama, then download the required model:

```bash
ollama pull llama3.1:8b
```

Make sure Ollama is running and that the application is configured to connect to it. YOLOv8 image detection does not require Ollama unless the application explicitly connects the two.

## Project Structure

```text
mini_project_medcheck/
├── .gitignore
├── README.md
├── blister_dataset/
├── blister_dataset_v2/
├── dataset/
├── model_weights/
├── yolo_om/
├── yolo_training/
├── realtime_monitor.py
└── Medcheck/
    ├── public/
    ├── src/
    │   ├── assets/
    │   ├── App.jsx
    │   ├── AuthPage.jsx
    │   ├── App.css
    │   └── index.css
    ├── server/
    │   ├── index.js
    │   ├── package.json
    │   └── .env.example
    ├── ai_service/
    │   ├── app/
    │   │   ├── main.py
    │   │   └── inference.py
    │   ├── models/
    │   │   └── best.pt
    │   ├── test_images/
    │   └── requirements.txt
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    └── .gitignore
```

The model weights, generated images, local databases, virtual environments, and dependency folders may be excluded from version control.

## Common Issues and Solutions

### 1. `npm` is not recognized

Install Node.js, reopen the terminal, and verify using `node -v` and `npm -v`.

### 2. Backend fails to start

- Navigate to the `server` directory.
- Run `npm install`.
- Check that the required environment variables are configured.
- Verify that port `5000` is available.

### 3. Frontend cannot connect to the backend

- Ensure the Express backend is running.
- Verify the API URL used by the frontend.
- Check the browser console and backend terminal for errors.

### 4. AI service fails to start

- Ensure the Python virtual environment is activated.
- Run `pip install -r requirements.txt`.
- Confirm that the terminal is inside `ai_service`.
- Check that the trained model exists at `models/best.pt`.
- Verify that port `8000` is available.

### 5. Annotated image does not appear

- Confirm that FastAPI is running.
- Verify that the annotation URL returned by the API is correct.
- Check that generated images are saved in the expected directory and served by FastAPI.

### 6. Dependencies are missing

The frontend, backend, and AI service have separate dependency configurations. Install the dependencies in the appropriate directory.

## Important Notes for Team Members

- Never commit `.env` files, passwords, session secrets, or API keys.
- Do not commit `node_modules`, Python virtual environments, local databases, or generated inference outputs.
- Obtain trained model weights through the team's agreed method.
- Coordinate changes to datasets and trained weights with the team.
- Pull the latest team changes before beginning new work.
- Update the relevant dependency files when adding or changing dependencies.
- Do not force-push to the shared `main` branch.

## Stopping the Application

In each running terminal, press:

```text
Ctrl + C
```

Stop the frontend, backend, and AI service separately.

## Repository

GitHub: https://github.com/MahiiBamba/mini_project_medcheck

---

**MedCheck — Supporting safer and more consistent medication monitoring through software and AI.**
