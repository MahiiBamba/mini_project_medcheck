# MedCheck — AI-Based Medication Monitoring System

MedCheck is a medication monitoring application designed to help users manage their medication schedules and monitor pill intake. The project combines a web application with backend services and AI-based pill monitoring to support medication adherence and risk analysis.

## Features

- **User Authentication:** Register and log in to the application.
- **Medication Management:** Manage prescribed medicines and their schedules.
- **Medication Monitoring:** Support pill intake verification using computer vision.
- **Adherence Tracking:** Track medication statuses such as `on_time`, `late`, `missed`, and `double`.
- **Risk Analysis:** Analyze medication-related risks using predefined rules and AI-assisted analysis.
- **Web Interface:** Access the application's features through a web-based frontend.

> Note: The availability of individual features depends on the current implementation and integration of the frontend, backend, and AI model.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React.js, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Database | SQLite |
| AI / Computer Vision | YOLOv8, OpenCV |
| AI-Assisted Analysis | Ollama with Llama 3.1 |
| API Communication | REST API |

## Prerequisites

Install the following tools before running the project:

1. **Node.js and npm** — Install a supported Node.js LTS version from [nodejs.org](https://nodejs.org/).
2. **Git** — Required to clone and update the repository. Download it from [git-scm.com](https://git-scm.com/).
3. **Visual Studio Code** (recommended) — For opening and editing the project.
4. **Ollama** — Required only if you want to run the local LLM analysis functionality. Download it from [ollama.com](https://ollama.com/).

Verify the Node.js and npm installations by running:

```bash
node -v
npm -v
```

## Step 1: Clone the Repository

Open a terminal and run:

```bash
git clone https://github.com/MahiiBamba/mini_project_medcheck.git
```

Move into the MedCheck application folder:

```bash
cd mini_project_medcheck/Medcheck
```

Open the project in Visual Studio Code:

```bash
code .
```

If you have already cloned the repository, open the existing `mini_project_medcheck/Medcheck` folder instead.

## Step 2: Configure the Backend

Open a **new terminal** in VS Code and navigate to the backend folder:

```bash
cd server
```

Install the backend dependencies:

```bash
npm install
```

Create a `.env` file inside the `server` folder. You can copy the example file and edit it.

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

Open `server/.env` and set a strong, private session secret:

```env
SESSION_SECRET=replace-with-your-own-strong-random-secret
```

Use your own randomly generated secret. Do not commit the real `.env` file or share its contents with others.

Start the backend:

```bash
npm start
```

The backend should start at:

```text
http://localhost:5000
```

Keep this terminal running.

## Step 3: Configure the Frontend

Open a **second terminal** in VS Code. Make sure you are in the main `Medcheck` folder, not the `server` folder.

If your terminal is currently inside `server`, return to the parent folder:

```bash
cd ..
```

Install the frontend dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Vite will display a local URL in the terminal, usually:

```text
http://localhost:5173
```

Open the displayed URL in your browser to use the application.

**Important:** Keep both the backend and frontend terminals running while using MedCheck.

## Step 4: Run the AI Components (If Required)

The web application and API can be started separately from the AI components.

If the current pill-monitoring or risk-analysis workflow requires the local LLM:

1. Install and open Ollama.
2. Download the required model:

   ```bash
   ollama pull llama3.1:8b
   ```

3. Make sure Ollama is running.
4. Start the relevant AI or monitoring component according to its setup instructions.

The YOLOv8 pill-detection component may require additional Python dependencies and trained model weights. Follow the instructions in the relevant AI/model directory before running it.

**Note:** Starting the frontend and backend does not automatically guarantee that every AI component is running. The model, its dependencies, and the corresponding integration must also be configured.

## Step 5: Verify the Application

After starting the required services:

1. Open the frontend URL in your browser.
2. Register a test account or log in, if authentication is enabled.
3. Navigate through the available application pages.
4. Test the medication-related functionality supported by the current build.
5. Check the backend terminal for API errors if something does not work.

If a feature fails, verify that the backend is running and that the frontend is communicating with the correct API address.

## Project Structure

```text
Medcheck/
├── public/                  # Public frontend assets
├── src/                     # React frontend source code
│   ├── assets/              # Images and other assets
│   ├── App.jsx              # Main application component
│   ├── AuthPage.jsx         # Authentication interface
│   ├── App.css              # Application styling
│   └── index.css            # Global styling
├── server/                  # Backend application
│   ├── index.js             # Backend entry point
│   ├── package.json         # Backend dependencies and scripts
│   └── .env.example         # Example environment configuration
├── index.html
├── package.json             # Frontend dependencies and scripts
├── vite.config.js
├── .gitignore
└── README.md
```

The AI training code, datasets, and model weights may be maintained in separate directories in the main repository.

## Common Issues and Solutions

### 1. `npm` is not recognized

Install Node.js, reopen the terminal, and verify the installation using `node -v` and `npm -v`.

### 2. Backend fails to start

- Check that you are inside the `server` folder.
- Run `npm install`.
- Verify that `server/.env` exists and contains a valid `SESSION_SECRET`.
- Check whether port `5000` is already in use.

### 3. Frontend cannot connect to the backend

- Make sure the backend is running.
- Check the API URL used by the frontend.
- Look at the browser console and backend terminal for error messages.

### 4. AI analysis is unavailable

- Check whether Ollama is installed and running.
- Verify that the required model has been downloaded.
- Confirm that the AI component is configured to communicate with the local service.

### 5. Dependencies are missing

Run `npm install` in the appropriate directory. The frontend and backend have separate `package.json` files, so dependencies must be installed in both folders.

## Important Notes for Team Members

- Do not commit `node_modules/`, `.env`, database files, or other local runtime data.
- Keep personal credentials and session secrets private.
- Do not delete or replace trained model weights or datasets without coordinating with the team.
- Pull the latest changes before beginning work:

  ```bash
  git pull origin main
  ```

- Commit and push your changes using your assigned Git workflow.
- If you change dependencies, update and commit the corresponding `package-lock.json`.

## Stopping the Application

To stop a running service, switch to its terminal and press:

```text
Ctrl + C
```

Stop the frontend, backend, and any separately running AI processes when you have finished.

## Repository

GitHub: https://github.com/MahiiBamba/mini_project_medcheck

---

**MedCheck — Supporting safer and more consistent medication monitoring through software and AI.**
