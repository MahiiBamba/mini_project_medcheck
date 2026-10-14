
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

      return res.json(result)
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

app.get('/api/notification-history', requireAuth, (req, res) => {
  const history = db.prepare(`
    SELECT
      id,
      medication_id AS medicationId,
      medication_name AS medicationName,
      scheduled_time AS scheduledTime,
      scheduled_date AS scheduledDate,
      event_type AS eventType,
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
