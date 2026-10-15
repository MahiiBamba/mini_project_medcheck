
const express = require('express')
const cors = require('cors')
const Database = require('better-sqlite3')
const bcrypt = require('bcryptjs')
const session = require('express-session')
const SQLiteStore = require('connect-sqlite3')(session)
const rateLimit = require('express-rate-limit')
const path = require('path')
const multer = require('multer')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const app = express()
const PORT = 5000

const isProduction = process.env.NODE_ENV === 'production'
const sessionSecret = process.env.SESSION_SECRET

if (isProduction && !sessionSecret) {
  throw new Error('SESSION_SECRET must be configured in production.')
}

app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json({ limit: '10kb' }))
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (req, file, callback) => {
    const allowedTypes = new Set([
      'image/jpeg',
      'image/png',
      'image/webp',
    ])

    if (!allowedTypes.has(file.mimetype)) {
      return callback(new Error('Upload a JPG, PNG, or WEBP image.'))
    }

    callback(null, true)
  },
})

app.use(session({
  name: 'medcheck.sid',
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: __dirname,
  }),
  secret: sessionSecret || 'development-only-secret-change-before-deployment',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 8,
  },
}))

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
})

// Keep using the existing database file.
const db = new Database(path.join(__dirname, 'medcheck.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    dose TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

// Migrate the existing medication table without deleting old records.
const medicationColumns = db.prepare(
  'PRAGMA table_info(medications)'
).all()

if (!medicationColumns.some((column) => column.name === 'user_id')) {
  db.exec(`
    ALTER TABLE medications
    ADD COLUMN user_id INTEGER REFERENCES users(id)
  `)
}
db.exec(`
  CREATE TABLE IF NOT EXISTS dose_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    scheduled_date TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming'
      CHECK (status IN ('Upcoming', 'Taken', 'Late', 'Missed')),
    taken_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (medication_id)
      REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)
      REFERENCES users(id) ON DELETE CASCADE,

    UNIQUE (medication_id, scheduled_date)
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS notification_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    medication_id INTEGER,
    medication_name TEXT NOT NULL,
    scheduled_time TEXT NOT NULL,
    scheduled_date TEXT NOT NULL,
    event_type TEXT NOT NULL DEFAULT 'Reminder sent',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id)
      REFERENCES users(id) ON DELETE CASCADE,

    FOREIGN KEY (medication_id)
      REFERENCES medications(id) ON DELETE SET NULL
  )
`)


const notificationColumns = db.prepare('PRAGMA table_info(notification_history)').all()
if (!notificationColumns.some((column) => column.name === 'message')) {
  db.exec('ALTER TABLE notification_history ADD COLUMN message TEXT')
}


// Scan history powers the seven-day context used by the LLM. Existing data is preserved.
db.exec(`
  CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    image_name TEXT NOT NULL,
    total_detections INTEGER NOT NULL DEFAULT 0,
    intact_count INTEGER NOT NULL DEFAULT 0,
    broken_count INTEGER NOT NULL DEFAULT 0,
    visual_risk_score INTEGER,
    visual_risk_level TEXT NOT NULL DEFAULT 'low',
    detections_json TEXT NOT NULL DEFAULT '[]',
    explanation TEXT,
    recommendations_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_scan_history_user_created
    ON scan_history(user_id, created_at);

  CREATE TABLE IF NOT EXISTS health_insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    recommendations_json TEXT NOT NULL DEFAULT '[]',
    severity TEXT NOT NULL DEFAULT 'low',
    history_summary TEXT NOT NULL DEFAULT '',
    llm_model TEXT NOT NULL DEFAULT '',
    llm_available INTEGER NOT NULL DEFAULT 0,
    disclaimer TEXT NOT NULL DEFAULT 'Informational guidance only; not a diagnosis.',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_health_insights_user_created
    ON health_insights(user_id, created_at);
`)

const healthInsightColumns = db.prepare('PRAGMA table_info(health_insights)').all()
if (!healthInsightColumns.some((column) => column.name === 'disclaimer')) {
  db.exec("ALTER TABLE health_insights ADD COLUMN disclaimer TEXT NOT NULL DEFAULT 'Informational guidance only; not a diagnosis.'")
}

const findUserByEmail = db.prepare(
  'SELECT * FROM users WHERE email = ?'
)

const findUserById = db.prepare(
  'SELECT id, name, email, created_at FROM users WHERE id = ?'
)

const insertUser = db.prepare(`
  INSERT INTO users (name, email, password_hash)
  VALUES (?, ?, ?)
`)

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: 'Please log in to continue.',
    })
  }

  next()
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  }
}

// Health check: no login required.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'MedCheck API is running' })
})

const AI_SERVICE_URL = 'http://127.0.0.1:8000'

app.post(
  '/api/analyze-blister',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'Please upload a blister-pack image.',
      })
    }

    try {
      const formData = new FormData()

      const imageBlob = new Blob([req.file.buffer], {
        type: req.file.mimetype,
      })

      formData.append('file', imageBlob, req.file.originalname)

      const aiResponse = await fetch(
        `${AI_SERVICE_URL}/api/analyze`,
        {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(30000),
        }
      )

      const result = await aiResponse.json()

      if (!aiResponse.ok) {
        return res.status(aiResponse.status).json({
          error: result.detail || 'AI image analysis failed.',
        })
      }

      const scan = result.data || result
      const counts = scan.counts || {}
      const total = Math.max(0, Number(scan.total_detections) || 0)
      const broken = Math.max(0, Number(counts.broken) || 0)
      const intact = Math.max(0, Number(counts.intact) || 0)
      const visualRiskScore = total > 0 ? Math.round((broken / total) * 100) : 0
      // This is a visual packaging-integrity indicator, not a clinical risk score.
      const visualRiskLevel = broken >= 2 || (total > 0 && broken / total >= 0.25)
        ? 'high'
        : broken > 0 ? 'moderate' : 'low'
      const savedScan = db.prepare(`
        INSERT INTO scan_history (
          user_id, image_name, total_detections, intact_count, broken_count,
          visual_risk_score, visual_risk_level, detections_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.session.userId,
        String(scan.image_name || req.file.originalname).slice(0, 255),
        total, intact, broken, visualRiskScore, visualRiskLevel,
        JSON.stringify(Array.isArray(scan.detections) ? scan.detections : [])
      )
      const currentScan = {
        scan_id: Number(savedScan.lastInsertRowid),
        image_name: String(scan.image_name || req.file.originalname).slice(0, 255),
        total_detections: total,
        counts: { intact, broken },
        visual_risk_score: visualRiskScore,
        visual_risk_level: visualRiskLevel,
        detections: Array.isArray(scan.detections) ? scan.detections : [],
        created_at: new Date().toISOString(),
      }

      let llmInsight = {
        explanation: 'The image analysis is complete. Llama 3 guidance is currently unavailable.',
        recommendations: ['If any medicine or packaging looks damaged, verify it with a pharmacist before use.'],
        severity: visualRiskLevel,
        notification_required: visualRiskLevel === 'high',
        notification: '',
        history_summary: 'History-based explanation was unavailable for this scan.',
        disclaimer: 'Visual analysis is not a medical diagnosis. Verify uncertain or damaged medication with a pharmacist.',
        llm_available: false,
      }
      try {
        const explainResponse = await fetch(`${AI_SERVICE_URL}/api/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: req.session.userId, current_scan: currentScan }),
          signal: AbortSignal.timeout(50000),
        })
        if (explainResponse.ok) {
          const explainResult = await explainResponse.json()
          if (explainResult?.data) llmInsight = { ...llmInsight, ...explainResult.data }
        } else {
          console.warn('LLM explanation endpoint returned', explainResponse.status)
        }
      } catch (llmError) {
        // Do not fail a successful YOLO scan because optional Ollama is unavailable.
        console.warn('LLM explanation unavailable:', llmError.message)
      }

      db.prepare(`
        UPDATE scan_history SET explanation = ?, recommendations_json = ? WHERE id = ? AND user_id = ?
      `).run(
        String(llmInsight.explanation || '').slice(0, 4000),
        JSON.stringify(Array.isArray(llmInsight.recommendations) ? llmInsight.recommendations : []),
        Number(savedScan.lastInsertRowid), req.session.userId
      )

      if (llmInsight.notification_required === true || visualRiskLevel === 'high') {
        const now = new Date()
        const scheduledDate = now.toISOString().slice(0, 10)
        const scheduledTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        db.prepare(`
          INSERT INTO notification_history (
            user_id, medication_id, medication_name, scheduled_time, scheduled_date, event_type
          ) VALUES (?, NULL, ?, ?, ?, ?)
        `).run(
          req.session.userId,
          'Blister-pack scan',
          scheduledTime,
          scheduledDate,
          `AI alert: ${String(llmInsight.severity || visualRiskLevel).slice(0, 20)} visual concern`
        )
      }

      return res.json({
        success: true,
        message: 'Image analyzed successfully',
        data: {
          ...scan,
          visual_risk_score: visualRiskScore,
          visual_risk_level: visualRiskLevel,
          llm_insight: llmInsight,
        },
      })
    } catch (error) {
      console.error('Blister analysis failed:', error.message)

      return res.status(502).json({
        error: 'The AI service is unavailable or failed to respond.',
      })
    }
  }
)

// Register a patient account.
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { name, email, password } = req.body || {}

  if (
    typeof name !== 'string' ||
    name.trim().length < 2 ||
    name.trim().length > 80
  ) {
    return res.status(400).json({
      error: 'Name must contain between 2 and 80 characters.',
    })
  }

  if (
    typeof email !== 'string' ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  ) {
    return res.status(400).json({ error: 'Enter a valid email address.' })
  }

  if (
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: 'Password must be between 8 and 72 characters.',
    })
  }

  const normalizedEmail = email.trim().toLowerCase()
  const existingUser = findUserByEmail.get(normalizedEmail)

  if (existingUser) {
    return res.status(409).json({
      error: 'An account with this email already exists.',
    })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12)
    const result = insertUser.run(
      name.trim(),
      normalizedEmail,
      passwordHash,
    )

    return res.status(201).json({
      message: 'Account created successfully. Please log in.',
      userId: result.lastInsertRowid,
    })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      })
    }

    console.error('Registration failed:', error.message)
    return res.status(500).json({ error: 'Could not create the account.' })
  }
})

// Log in and create a server-side session.
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {}

  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    password.length > 72
  ) {
    return res.status(400).json({ error: 'Enter your email and password.' })
  }

  const user = findUserByEmail.get(email.trim().toLowerCase())

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password.' })
  }

  req.session.regenerate((error) => {
    if (error) {
      console.error('Session creation failed:', error.message)
      return res.status(500).json({ error: 'Could not start your session.' })
    }

    req.session.userId = user.id

    req.session.save((saveError) => {
      if (saveError) {
        console.error('Session save failed:', saveError.message)
        return res.status(500).json({ error: 'Could not start your session.' })
      }

      res.json({ user: safeUser(user) })
    })
  })
})

// Return the currently logged-in patient.
app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = findUserById.get(req.session.userId)

  if (!user) {
    return req.session.destroy(() => {
      res.status(401).json({ error: 'Please log in again.' })
    })
  }

  res.json({ user })
})

// Log out and clear the session cookie.
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: 'Could not log out.' })
    }

    res.clearCookie('medcheck.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
    })

    res.json({ message: 'Logged out successfully.' })
  })
})

// Get only the current patient's medication records.
function getIndiaDateTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  )

  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  }
}

// Get today's medication records for the logged-in patient.
app.get('/api/medications', requireAuth, (req, res) => {
  const { date, time: currentTime } = getIndiaDateTime()

  const medications = db.prepare(`
    SELECT id, name, dose, time, status, created_at
    FROM medications
    WHERE user_id = ?
    ORDER BY time ASC
  `).all(req.session.userId)

  const findDose = db.prepare(`
    SELECT status, taken_at
    FROM dose_records
    WHERE medication_id = ?
      AND user_id = ?
      AND scheduled_date = ?
  `)

  const createDose = db.prepare(`
    INSERT OR IGNORE INTO dose_records
      (medication_id, user_id, scheduled_date, scheduled_time)
    VALUES (?, ?, ?, ?)
  `)

  const todayRecords = medications.map((medication) => {
    createDose.run(
      medication.id,
      req.session.userId,
      date,
      medication.time
    )

    const dose = findDose.get(
      medication.id,
      req.session.userId,
      date
    )

    let dailyStatus

    if (dose.status === 'Taken') {
      dailyStatus = 'Taken'
    } else if (dose.status === 'Late') {
      dailyStatus = 'Taken late'
    } else if (medication.time > currentTime) {
      dailyStatus = 'Upcoming'
    } else if (medication.time === currentTime) {
      dailyStatus = 'Due now'
    } else {
      dailyStatus = 'Overdue'
    }

    return {
      ...medication,
      status:
        dose.status === 'Taken' || dose.status === 'Late'
          ? 'Taken'
          : 'Upcoming',
      dailyStatus,
      taken_at: dose.taken_at,
    }
  })

  res.json(todayRecords)
})

// Add a medication belonging to the logged-in patient.
app.post('/api/medications', requireAuth, (req, res) => {
  const { name, dose, time } = req.body || {}

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 120 ||
    typeof dose !== 'string' ||
    !dose.trim() ||
    dose.trim().length > 80 ||
    typeof time !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return res.status(400).json({
      error: 'Provide a valid medicine name, dosage, and time.',
    })
  }

  const result = db.prepare(`
    INSERT INTO medications (name, dose, time, user_id)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), dose.trim(), time, req.session.userId)

  const medication = db.prepare(`
    SELECT id, name, dose, time, status, created_at
    FROM medications
    WHERE id = ? AND user_id = ?
  `).get(result.lastInsertRowid, req.session.userId)

  res.status(201).json(medication)
})

// Record today's dose as taken by the logged-in patient.
app.patch('/api/medications/:id/taken', requireAuth, (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid medication ID.' })
  }

  const medication = db.prepare(`
    SELECT id, name, dose, time, status, created_at
    FROM medications
    WHERE id = ? AND user_id = ?
  `).get(id, req.session.userId)

  if (!medication) {
    return res.status(404).json({ error: 'Medication not found.' })
  }

  const { date, time: currentTime } = getIndiaDateTime()
  const doseStatus =
    currentTime > medication.time ? 'Late' : 'Taken'
  const takenAt = new Date().toISOString()

  const saveDose = db.prepare(`
    INSERT INTO dose_records (
      medication_id, user_id, scheduled_date,
      scheduled_time, status, taken_at
    )
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(medication_id, scheduled_date)
    DO UPDATE SET
      status = excluded.status,
      taken_at = excluded.taken_at
  `)

  saveDose.run(
    medication.id,
    req.session.userId,
    date,
    medication.time,
    doseStatus,
    takenAt
  )

  res.json({
    ...medication,
    status: 'Taken',
    dailyStatus: doseStatus === 'Late' ? 'Taken late' : 'Taken',
    taken_at: takenAt,
  })
})

// Delete only the current patient's medication.
app.delete('/api/medications/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id)

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid medication ID.' })
  }

  const result = db.prepare(`
    DELETE FROM medications
    WHERE id = ? AND user_id = ?
  `).run(id, req.session.userId)

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Medication not found.' })
  }

  res.status(204).end()
})

app.post('/api/notification-history', requireAuth, (req, res) => {
  const {
    medicationId,
    medicationName,
    scheduledTime,
    scheduledDate,
  } = req.body || {}

  if (
    typeof medicationName !== 'string' ||
    !medicationName.trim() ||
    medicationName.trim().length > 120 ||
    typeof scheduledTime !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledTime) ||
    typeof scheduledDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
  ) {
    return res.status(400).json({
      error: 'Provide a valid medicine name, time, and date.',
    })
  }

  let medication = null

  if (medicationId !== undefined && medicationId !== null) {
    const id = Number(medicationId)

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({
        error: 'Invalid medication ID.',
      })
    }

    medication = db.prepare(`
      SELECT id, name
      FROM medications
      WHERE id = ? AND user_id = ?
    `).get(id, req.session.userId)

    if (!medication) {
      return res.status(404).json({
        error: 'Medication not found.',
      })
    }
  }

  const result = db.prepare(`
    INSERT INTO notification_history (
      user_id,
      medication_id,
      medication_name,
      scheduled_time,
      scheduled_date,
      event_type
    )
    VALUES (?, ?, ?, ?, ?, 'Reminder sent')
  `).run(
    req.session.userId,
    medication ? medication.id : null,
    medication ? medication.name : medicationName.trim(),
    scheduledTime,
    scheduledDate
  )

  res.status(201).json({
    message: 'Notification history saved.',
    id: result.lastInsertRowid,
  })
})


// Generate and persist history-based health insights for the authenticated user.
app.post('/api/health-insights/generate', requireAuth, async (req, res) => {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/health-recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: req.session.userId }),
      signal: AbortSignal.timeout(65000),
    })
    const result = await response.json()
    if (!response.ok || !result?.data) {
      return res.status(502).json({ error: result?.detail || 'Could not generate health insights.' })
    }

    const insight = result.data
    const recommendations = Array.isArray(insight.recommendations)
      ? insight.recommendations.slice(0, 5).map((item) => String(item).slice(0, 500))
      : []
    const inserted = db.prepare(`
      INSERT INTO health_insights (
        user_id, title, summary, recommendations_json, severity,
        history_summary, llm_model, llm_available, disclaimer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.session.userId,
      String(insight.title || 'Your medication health insights').slice(0, 120),
      String(insight.summary || '').slice(0, 2000),
      JSON.stringify(recommendations),
      ['low', 'moderate', 'high'].includes(insight.severity) ? insight.severity : 'low',
      String(insight.history_summary || '').slice(0, 1000),
      String(insight.llm_model || '').slice(0, 100),
      insight.llm_available === true ? 1 : 0,
      String(insight.disclaimer || 'Informational guidance only; not a diagnosis.').slice(0, 500)
    )

    // Persist only actionable LLM notifications; suppress duplicate alerts on the same day.
    let notificationCreated = false
    if (insight.llm_available === true && insight.notification_required === true && String(insight.notification || '').trim()) {
      const { date, time } = getIndiaDateTime()
      const duplicate = db.prepare(`
        SELECT id FROM notification_history
        WHERE user_id = ? AND scheduled_date = ?
          AND event_type = 'AI health insight'
          AND message = ?
        LIMIT 1
      `).get(req.session.userId, date, String(insight.notification).slice(0, 500))
      if (!duplicate) {
        db.prepare(`
          INSERT INTO notification_history (
            user_id, medication_id, medication_name, scheduled_time,
            scheduled_date, event_type, message
          ) VALUES (?, NULL, 'Health insight', ?, ?, 'AI health insight', ?)
        `).run(req.session.userId, time, date, String(insight.notification).slice(0, 500))
        notificationCreated = true
      }
    }

    const saved = db.prepare(`
      SELECT id, title, summary, recommendations_json AS recommendationsJson,
        severity, history_summary AS historySummary, llm_model AS llmModel,
        llm_available AS llmAvailable, disclaimer, created_at AS createdAt
      FROM health_insights WHERE id = ? AND user_id = ?
    `).get(Number(inserted.lastInsertRowid), req.session.userId)
    res.status(201).json({
      ...saved,
      recommendations: JSON.parse(saved.recommendationsJson || '[]'),
      recommendationsJson: undefined,
      llmAvailable: Boolean(saved.llmAvailable),
      notificationCreated,
      message: insight.llm_available ? 'Llama health insights generated and saved.' : 'Llama was unavailable; fallback status saved without an AI notification.',
    })
  } catch (error) {
    console.error('Health insight generation failed:', error.message)
    res.status(502).json({ error: 'Could not connect to the MedCheck AI service. Check that it is running.' })
  }
})

app.get('/api/health-insights', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, title, summary, recommendations_json AS recommendationsJson,
      severity, history_summary AS historySummary, llm_model AS llmModel,
      llm_available AS llmAvailable, disclaimer, created_at AS createdAt
    FROM health_insights
    WHERE user_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 20
  `).all(req.session.userId)
  res.json(rows.map((row) => ({
    ...row,
    recommendations: (() => {
      try { return JSON.parse(row.recommendationsJson || '[]') } catch { return [] }
    })(),
    recommendationsJson: undefined,
    llmAvailable: Boolean(row.llmAvailable),
  })))
})


app.get('/api/ai-insights', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT id, image_name AS imageName,
      total_detections AS totalDetections,
      intact_count AS intactCount,
      broken_count AS brokenCount,
      visual_risk_score AS visualRiskScore,
      visual_risk_level AS visualRiskLevel,
      explanation,
      recommendations_json AS recommendationsJson,
      created_at AS createdAt
    FROM scan_history
    WHERE user_id = ?
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT 50
  `).all(req.session.userId)

  res.json(rows.map((row) => ({
    ...row,
    recommendations: (() => {
      try { return JSON.parse(row.recommendationsJson || '[]') } catch { return [] }
    })(),
    recommendationsJson: undefined,
  })))
})

app.get('/api/notification-history', requireAuth, (req, res) => {
  const history = db.prepare(`
    SELECT
      id,
      medication_id AS medicationId,
      medication_name AS medicationName,
      scheduled_time AS scheduledTime,
      scheduled_date AS scheduledDate,
      event_type AS eventType,
      message,
      created_at AS createdAt
    FROM notification_history
    WHERE user_id = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `).all(req.session.userId)

  res.json(history)
})


app.listen(PORT, () => {
  console.log(`MedCheck API running at http://localhost:${PORT}`)
})
