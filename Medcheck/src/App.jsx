

import { useEffect, useRef, useState } from 'react'
import AuthPage from './AuthPage'

const initialMedications = [
  { id: 1, name: 'Vitamin D3', dose: '1 tablet', time: '08:00 AM', status: 'Taken', color: 'bg-amber-100 text-amber-700', icon: '☀️' },
  { id: 2, name: 'Multivitamin', dose: '1 tablet', time: '01:00 PM', status: 'Upcoming', color: 'bg-emerald-100 text-emerald-700', icon: '💊' },
  { id: 3, name: 'Calcium', dose: '1 tablet', time: '08:00 PM', status: 'Upcoming', color: 'bg-sky-100 text-sky-700', icon: '🩺' },
]

const navItems = [
  { name: 'Dashboard', icon: '▦' },
  { name: 'My Medications', icon: '💊' },
  { name: 'Scan Medicine', icon: '▧' },
  { name: 'Medication History', icon: '◷' },
  { name: 'AI Insights', icon: '✧' },
  { name: 'Notifications', icon: '♧' },
  { name: 'Notification History', icon: '◷' },

]


function formatMedication(med) {
  const [hours, minutes] = med.time.split(':')
  const hour = Number(hours)

  return {
    ...med,
    time: `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`,
    dailyStatus: med.dailyStatus || med.status,
    color: 'bg-teal-100 text-teal-700',
    icon: '💊',
  }
}

function getStatusStyle(status) {
  switch (status) {
    case 'Taken':
      return 'bg-emerald-50 text-emerald-700'
    case 'Taken late':
      return 'bg-orange-50 text-orange-700'
    case 'Due now':
      return 'bg-sky-50 text-sky-700'
    case 'Overdue':
      return 'bg-red-50 text-red-700'
    case 'Missed':
      return 'bg-red-50 text-red-700'
    default:
      return 'bg-amber-50 text-amber-700'
  }
}



function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  
  const [scanImage, setScanImage] = useState(null)
  const [scanPreview, setScanPreview] = useState('')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [scanResult, setScanResult] = useState(null)

  const [notificationHistory, setNotificationHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')  
  const [medications, setMedications] = useState([])
  const [apiError, setApiError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    dose: '',
    time: '08:00',
  })


  
  const takenCount = medications.filter(
    (med) => med.dailyStatus === 'Taken' || med.dailyStatus === 'Taken late'
  ).length

  const upcomingCount = medications.filter(
    (med) => med.dailyStatus === 'Upcoming'
  ).length

  const overdueCount = medications.filter(
    (med) => med.dailyStatus === 'Overdue'
  ).length

  const adherence = medications.length
    ? Math.round((takenCount / medications.length) * 100)
    : 0

  const [user, setUser] = useState(null)
  
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined'
      ? Notification.permission
      : 'unsupported'
  )
  
  const notifiedDoses = useRef(new Set())


  const [authChecking, setAuthChecking] = useState(true)  
  useEffect(() => {
  async function checkSession() {
    try {
      const response = await fetch(
        'http://localhost:5000/api/auth/me',
        { credentials: 'include' }
      )

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      }
    } catch (error) {
      console.error('Session check failed:', error)
    } finally {
      setAuthChecking(false)
    }
  }

  checkSession()
}, [])
  

useEffect(() => {
  if (authChecking) return

  if (!user) {
    setMedications([])
    setApiError('')
    return
  }

  async function loadMedications() {
    try {
      const response = await fetch(
        'http://localhost:5000/api/medications',
        { credentials: 'include' }
      )

      if (!response.ok) {
        throw new Error('Unable to load medications.')
      }

      const data = await response.json()
      setMedications(data.map(formatMedication))
      setApiError('')
    } catch (error) {
      setApiError(error.message || 'Unable to connect to the server.')
    }
  }

  loadMedications()
}, [user, authChecking])


  
async function addMedicine(event) {
  event.preventDefault()

  if (!newMedicine.name.trim() || !newMedicine.dose.trim()) {
    return
  }

  try {
    const response = await fetch('http://localhost:5000/api/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: newMedicine.name.trim(),
        dose: newMedicine.dose.trim(),
        time: newMedicine.time,
      }),
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.error || 'Could not save medicine')
    }

    const savedMedicine = await response.json()

    setMedications((current) => [
      ...current,
      formatMedication(savedMedicine),
    ])

    setNewMedicine({ name: '', dose: '', time: '08:00' })
    setShowAddForm(false)
    setApiError('')
  } catch (error) {
    setApiError(error.message || 'Could not save medicine.')
  }
}

async function analyzeScanImage() {
  if (!scanImage || scanLoading) return

  setScanLoading(true)
  setScanError('')
  setScanResult(null)

  try {
    const formData = new FormData()
    formData.append('file', scanImage)

    const response = await fetch(
      'http://localhost:5000/api/analyze-blister',
      {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(
        result.error || 'Unable to analyze the image.'
      )
    }

    setScanResult(result.data)
  } catch (error) {
    setScanError(
      error.message || 'Could not connect to the AI service.'
    )
  } finally {
    setScanLoading(false)
  }
}

async function markAsTaken(id) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/medications/${id}/taken`,
      { method: 'PATCH',
        credentials: 'include'
       },
    )

    if (!response.ok) {
      throw new Error('Could not update medication status')
    }

    const updatedMedicine = await response.json()

    setMedications((current) =>
      current.map((med) =>
        med.id === id ? formatMedication(updatedMedicine) : med,
      ),
    )

    setApiError('')
  } catch (error) {
    setApiError(error.message || 'Could not update medication.')
  }
}

async function loadNotificationHistory() {
  setHistoryLoading(true)
  setHistoryError('')

  try {
    const response = await fetch(
      'http://localhost:5000/api/notification-history',
      { credentials: 'include' }
    )

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'Please log in to view notification history.'
          : 'Could not load notification history.'
      )
    }

    const data = await response.json()
    setNotificationHistory(data)
  } catch (error) {
    setHistoryError(error.message)
  } finally {
    setHistoryLoading(false)
  }
}


async function enableBrowserNotifications() {
  if (!('Notification' in window)) {
    alert('Your browser does not support notifications.')
    return
  }

  const permission = await Notification.requestPermission()
  setNotificationPermission(permission)
}

async function deleteMedicine(id) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/medications/${id}`,
      { method: 'DELETE',
        credentials: 'include',
       },
    )

    if (!response.ok) {
      throw new Error('Could not delete medication')
    }

    setMedications((current) =>
      current.filter((med) => med.id !== id),
    )

    setApiError('')
  } catch (error) {
    setApiError(error.message || 'Could not delete medication.')
  }
}

async function handleLogout() {
  try {
    const response = await fetch(
      'http://localhost:5000/api/auth/logout',
      {
        method: 'POST',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      throw new Error('Unable to log out. Please try again.')
    }

    setUser(null)
    setMedications([])
    setApiError('')
  } catch (error) {
    setApiError(error.message || 'Unable to log out.')
  }
}

useEffect(() => {
  if (
    notificationPermission !== 'granted' ||
    typeof Notification === 'undefined'
  ) {
    return
  }

  function checkDueDoses() {
    const now = new Date()

    medications.forEach((med) => {
      if (
        med.dailyStatus === 'Taken' ||
        med.dailyStatus === 'Taken late'
      ) {
        return
      }

      // Convert the displayed time, such as "8:00 AM",
      // into hours and minutes.
      const [time, period] = med.time.split(' ')
      if (!time || !period) return

      const [hourText, minuteText] = time.split(':')
      let hours = Number(hourText) % 12

      if (period.toUpperCase() === 'PM') {
        hours += 12
      }

      const scheduledAt = new Date()
      scheduledAt.setHours(hours, Number(minuteText), 0, 0)

      // Notify once the scheduled time has arrived.
      // Notify 20 minutes after the scheduled time.
      const reminderAt = new Date(
        scheduledAt.getTime() + 10* 60 * 1000
      )

      if (now < reminderAt) return

      const dateKey = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-')

      const doseKey = `${dateKey}-${med.id}`

      if (notifiedDoses.current.has(doseKey)) return

      notifiedDoses.current.add(doseKey)

      
    new Notification('MedCheck medication reminder', {
      body: `${med.name} (${med.dose}) was scheduled for ${med.time}. Open MedCheck to update its status.`,
    })


    const scheduledTime = (() => {
      const [timePart, period] = med.time.split(' ')
      const [hourPart, minutePart] = timePart.split(':')

      let hour = Number(hourPart) % 12

      if (period?.toUpperCase() === 'PM') {
        hour += 12
      }

      return `${String(hour).padStart(2, '0')}:${minutePart}`
    })()

    const indiaParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())

    const dateParts = Object.fromEntries(
      indiaParts.map((part) => [part.type, part.value])
    )

    const scheduledDate =
      `${dateParts.year}-${dateParts.month}-${dateParts.day}`

    fetch('http://localhost:5000/api/notification-history', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        medicationId: med.id,
        medicationName: med.name,
        scheduledTime,
        scheduledDate,
      }),
    }).catch((error) => {
      console.error('Could not save notification history:', error)
    })

    })
  }

  checkDueDoses()

  const intervalId = window.setInterval(checkDueDoses, 30_000)

  return () => window.clearInterval(intervalId)
}, [medications, notificationPermission])


  
if (authChecking) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">
        Checking your session...
      </p>
    </div>
  )
}

if (!user) {
  return <AuthPage onLogin={setUser} />
}


  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="flex w-full flex-col border-r border-slate-200 bg-white p-5 md:min-h-screen md:w-64 md:shrink-0">
        <div className="mb-9 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-700 text-xl text-white">
            ✚
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">MedCheck</h1>
            <p className="text-xs text-slate-500">Medication companion</p>
          </div>
        </div>

        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
          Workspace
        </p>

        <nav className="flex flex-wrap gap-2 md:flex-col">
          {navItems.map((item) => (
            <button
              key={item.name}
              
              onClick={() => {
                setActivePage(item.name)

                if (item.name === 'Notification History') {
                  loadNotificationHistory()
                }
              }}

              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition ${
                activePage === item.name
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>

        <div className="mt-8 rounded-2xl bg-slate-900 p-4 text-white md:mt-auto">
          <p className="text-sm font-semibold">Stay consistent 💚</p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            Small steps and timely reminders can help you follow your medication schedule.
          </p>
        </div>

        <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-5">
                  
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 font-bold text-teal-800">
          {(() => {
            const parts = (user?.name || 'User').trim().split(/\s+/);
            if (parts.length === 1) return parts[0][0].toUpperCase();
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
          })()}
        </div>


          <div>
            <p className="text-sm font-semibold">
              {user?.name.split(' ')[0] || 'Guest'}
            </p>
            <p className="text-xs text-slate-500">
              {user?.email || 'Patient'}
            </p>
          </div>
        </div>
        
        <button
          type="button"
          onClick={handleLogout}
          className="mt-4 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
        >
          Log out
        </button>

      </aside>

      <main className="min-w-0 flex-1 p-5 md:p-9">
        {apiError && (
  <div
    role="alert"
    className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
  >
    {apiError}
  </div>
)}
{activePage === 'Notification History' ? (
  <div className="space-y-6">
    <header>
      <h1 className="text-2xl font-bold text-slate-900">
        Notification History
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Review previously recorded medication reminders.
      </p>
    </header>

    <button
      onClick={loadNotificationHistory}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
    >
      Refresh history
    </button>

    {historyLoading ? (
      <p className="text-sm text-slate-600">
        Loading notification history...
      </p>
    ) : historyError ? (
      <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
        {historyError}
      </p>
    ) : notificationHistory.length === 0 ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-semibold text-slate-800">
          No notification history yet
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Reminder events will appear here after they are saved.
        </p>
      </div>
    ) : (
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Medicine</th>
              <th className="px-4 py-3">Scheduled date</th>
              <th className="px-4 py-3">Scheduled time</th>
              <th className="px-4 py-3">Event</th>
            </tr>
          </thead>
          <tbody>
            {notificationHistory.map((item) => (
              <tr
                key={item.id}
                className="border-t border-slate-100"
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  {item.medicationName}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.scheduledDate}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.scheduledTime}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
                    {item.eventType}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    <button
      onClick={() => setActivePage('Dashboard')}
      className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white hover:bg-slate-800"
    >
      Back to Dashboard
    </button>
  </div>
) : activePage === 'Notifications' ? (
  <div>
    <header className="mb-8">
      <p className="text-sm text-slate-500">Stay on top of your schedule</p>
      <h2 className="mt-1 text-3xl font-bold">Notifications</h2>
      <p className="mt-2 text-sm text-slate-500">
        Review your medication dose statuses for today.
      </p>
    </header>
    
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold">Browser notifications</h3>
      <p className="mt-2 text-sm text-slate-500">
        Enable notifications to receive medication reminders in your browser.
      </p>

      {notificationPermission === 'granted' ? (
        <p className="mt-4 text-sm font-medium text-emerald-700">
          Browser notifications are enabled.
        </p>
      ) : notificationPermission === 'unsupported' ? (
        <p className="mt-4 text-sm text-red-600">
          Your browser does not support notifications.
        </p>
      ) : notificationPermission === 'denied' ? (
        <p className="mt-4 text-sm text-red-600">
          Notifications are blocked. Allow them in your browser site settings.
        </p>
      ) : (
        <button
          onClick={enableBrowserNotifications}
          className="mt-4 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Enable notifications
        </button>


      )}
    </div>


    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      {medications.filter(
        (med) =>
          med.dailyStatus === 'Due now' ||
          med.dailyStatus === 'Overdue' ||
          med.dailyStatus === 'Missed'
      ).length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-3xl">🔔</p>
          <h3 className="mt-3 font-semibold">You're all caught up!</h3>
          <p className="mt-2 text-sm text-slate-500">
            There are no due or overdue doses to display right now.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {medications
            .filter(
              (med) =>
                med.dailyStatus === 'Due now' ||
                med.dailyStatus === 'Overdue' ||
                med.dailyStatus === 'Missed'
            )
            .map((med) => (
              <div
                key={med.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"
              >
                <div>
                  <p className="font-semibold">{med.name}</p>
                  
                  <p className="mt-1 text-sm text-slate-500">
                    {med.dose} · Scheduled at {med.time}
                  </p>

                  <p className="mt-2 text-sm text-slate-600">
                    {med.dailyStatus === 'Due now'
                      ? 'Your scheduled dose is due now.'
                      : med.dailyStatus === 'Overdue'
                        ? 'Your scheduled time has passed. If you have taken this dose, record it in MedCheck.'
                        : 'This dose is marked as missed in your schedule.'}
                  </p>

                </div>
                
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(med.dailyStatus)}`}
                    >
                      {med.dailyStatus}
                    </span>

                    {med.dailyStatus !== 'Taken' &&
                      med.dailyStatus !== 'Taken late' && (
                        <button
                          onClick={() => markAsTaken(med.id)}
                          className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                        >
                          Mark taken
                        </button>
                      )}
                  </div>

              </div>
            ))}
        </div>
      )}
    </section>

    <button
      onClick={() => setActivePage('Dashboard')}
      className="mt-5 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
    >
      Back to Dashboard
    </button>
  </div>

) : activePage === 'Scan Medicine' ? (
  <div className="mx-auto max-w-4xl space-y-6">

    {/* Header */}
    <div className="flex items-center gap-4">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-3xl">
        💊
      </div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-gray-800">
          Scan Medicine
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Capture or upload your medicine blister pack.
        </p>
      </div>
    </div>

    {/* Main scanner card */}
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">

      <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 sm:px-8">
        <p className="text-sm font-medium text-blue-700">
          MEDCHECK SCANNER
        </p>
        <h3 className="mt-1 text-xl font-bold text-gray-900">
          Check your medicine
        </h3>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          Take a fresh photo or choose an image from your device.
        </p>
      </div>

      <div className="p-5 sm:p-8">

        {/* Image area */}
        <div className="flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-blue-200 bg-gray-50 p-5 text-center sm:min-h-80">

          {scanPreview ? (
            <div className="w-full">
              <img
                src={scanPreview}
                alt="Medicine blister pack preview"
                className="mx-auto max-h-80 max-w-full rounded-xl object-contain"
              />
              <p className="mt-4 truncate text-sm font-medium text-gray-700">
                {scanImage?.name}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {(scanImage?.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <>
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl">
                📷
              </div>
              <h4 className="text-lg font-semibold text-gray-800">
                Your image will appear here
              </h4>
              <p className="mt-2 max-w-sm text-sm leading-6 text-gray-500">
                Keep the blister pack visible and make sure the image is clear.
              </p>
            </>
          )}
        </div>

        {/* Capture and gallery options */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">

          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl bg-blue-600 px-4 py-4 font-semibold text-white shadow-sm transition hover:bg-blue-700">
            <span className="text-xl">📸</span>
            <span>Take Photo</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (file) {
                  setScanImage(file)
                  setScanPreview(URL.createObjectURL(file))
                  setScanError('')
                  setScanResult(null)
                }

                event.target.value = ''
              }}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-gray-300 bg-white px-4 py-4 font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50">
            <span className="text-xl">🖼️</span>
            <span>Choose from Gallery</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]

                if (file) {
                  setScanImage(file)
                  setScanPreview(URL.createObjectURL(file))
                  setScanError('')
                  setScanResult(null)
                }

                event.target.value = ''
              }}
            />
          </label>

        </div>

        {/* Error or status */}
        {scanError && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            {scanError}
          </div>
        )}

        {/* Scan action */}
        <button
          type="button"
          disabled={!scanImage || scanLoading}
          onClick={analyzeScanImage}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-4 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          <span>✧</span>
          {scanLoading ? 'Analyzing image...' : 'Analyze Medicine'}
        </button>

        {scanImage && (
          <button
            type="button"
            onClick={() => {
              setScanImage(null)
              setScanPreview('')
              setScanError('')
              setScanResult(null)
            }}
            className="mt-3 w-full rounded-xl px-4 py-2 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-red-600"
          >
            Remove image and start again
          </button>
        )}

      </div>
    </div>

    {/* Results */}
    

{scanResult && (
  <section className="space-y-6">

    {/* Results header */}
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
          AI Analysis Report
        </p>
        <h3 className="mt-1 text-2xl font-bold text-slate-900">
          Scan Results
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Image analysis completed using your trained YOLOv8 model.
        </p>
      </div>

      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        Analysis complete
      </span>
    </div>

    {/* Summary cards */}
    <div className="grid gap-4 sm:grid-cols-3">

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">
            Total detections
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-xl">
            ◉
          </span>
        </div>
        <p className="mt-4 text-3xl font-bold text-slate-900">
          {scanResult.total_detections ?? 0}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Cavities identified in the image
        </p>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">
            Intact cavities
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-700">
            ✓
          </span>
        </div>
        <p className="mt-4 text-3xl font-bold text-emerald-700">
          {scanResult.counts?.intact ?? 0}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Predicted as intact by the model
        </p>
      </div>

      <div className="rounded-2xl border border-orange-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-500">
            Broken cavities
          </p>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-xl text-orange-700">
            !
          </span>
        </div>
        <p className="mt-4 text-3xl font-bold text-orange-700">
          {scanResult.counts?.broken ?? 0}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Predicted as broken by the model
        </p>
      </div>

    </div>

    {/* Annotated image */}
    {scanResult.annotated_image && (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h4 className="font-bold text-slate-900">
              Detection Visualization
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Model-generated bounding boxes and class labels
            </p>
          </div>

          <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
            YOLOv8
          </span>
        </div>

        <div className="bg-slate-50 p-3 sm:p-6">
          <img
            src={`http://127.0.0.1:8000${scanResult.annotated_image}`}
            alt="YOLOv8 annotated blister pack detection"
            className="mx-auto max-h-[600px] w-full rounded-xl border border-slate-200 bg-white object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-600 sm:px-6">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Intact prediction
          </span>
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
            Broken prediction
          </span>
        </div>
      </div>
    )}

    {/* Individual detections */}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <h4 className="font-bold text-slate-900">
          Individual Detections
        </h4>
        <p className="mt-1 text-sm text-slate-500">
          Predicted class and confidence for each detected cavity.
        </p>
      </div>

      {!scanResult.detections?.length ? (
        <div className="p-8 text-center">
          <p className="font-medium text-slate-700">
            No cavities detected
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Try a clearer image with the blister pack fully visible.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[440px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">#</th>
                <th className="px-5 py-3 font-semibold">Prediction</th>
                <th className="px-5 py-3 font-semibold">Confidence</th>
              </tr>
            </thead>

            <tbody>
              {scanResult.detections.map((detection, index) => {
                const intact = detection.class_name === 'intact'
                const confidence = Math.max(
                  0,
                  Math.min(100, Number(detection.confidence) * 100)
                )

                return (
                  <tr
                    key={`${detection.class_id}-${index}`}
                    className="border-t border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="px-5 py-4 text-slate-500">
                      {String(index + 1).padStart(2, '0')}
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${
                          intact
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {detection.class_name}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex min-w-36 items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${
                              intact ? 'bg-emerald-500' : 'bg-orange-500'
                            }`}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold tabular-nums text-slate-700">
                          {confidence.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
        Confidence indicates the model's prediction score, not medical certainty.
      </div>
    </div>

    {/* Important limitation */}
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <span className="text-lg">ⓘ</span>
      <div>
        <p className="text-sm font-semibold text-amber-900">
          Important note
        </p>
        <p className="mt-1 text-sm leading-6 text-amber-800">
          This analysis identifies visible blister-pack conditions only.
          It cannot confirm whether a medicine was swallowed or determine
          whether a dose was taken correctly. Verify the result before
          making medication decisions.
        </p>
      </div>
    </div>

  </section>
)}



  </div>
) : activePage === 'My Medications' ? (



  <div>
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-sm text-slate-500">Your personal medication schedule</p>
        <h2 className="mt-1 text-3xl font-bold">My Medications</h2>
        <p className="mt-2 text-sm text-slate-500">
          Manage your medicines and their scheduled times.
        </p>
      </div>

      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
      >
        + Add medicine
      </button>
    </header>

    {showAddForm && (
      <form
        onSubmit={addMedicine}
        className="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2"
      >
        <label className="text-sm font-medium">
          Medicine name
          <input
            required
            value={newMedicine.name}
            onChange={(event) =>
              setNewMedicine({ ...newMedicine, name: event.target.value })
            }
            placeholder="e.g. Vitamin D3"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-teal-600"
          />
        </label>

        <label className="text-sm font-medium">
          Dosage
          <input
            required
            value={newMedicine.dose}
            onChange={(event) =>
              setNewMedicine({ ...newMedicine, dose: event.target.value })
            }
            placeholder="e.g. 1 tablet"
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-teal-600"
          />
        </label>

        <label className="text-sm font-medium">
          Scheduled time
          <input
            type="time"
            required
            value={newMedicine.time}
            onChange={(event) =>
              setNewMedicine({ ...newMedicine, time: event.target.value })
            }
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal outline-none focus:border-teal-600"
          />
        </label>

        <div className="flex items-end gap-3">
          <button
            type="submit"
            className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Save medicine
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(false)}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    )}

    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      <StatCard
        title="Total medicines"
        value={medications.length}
        note="In this demo schedule"
        icon="💊"
      />
      
      <StatCard
        title="Recorded as taken"
        value={takenCount}
        note="Today's recorded doses"
        icon="✓"
      />
      <StatCard
        title="Upcoming"
        value={upcomingCount}
        note="Not yet due"
        icon="◷"
      />

    </div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <h3 className="mb-5 text-lg font-bold">Your medicine list</h3>

      {medications.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          No medicines added yet. Select “Add medicine” to create your schedule.
        </p>
      ) : (
        <div className="space-y-3">
          {medications.map((med) => (
            <div
              key={med.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-100 p-4"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-xl ${med.color}`}>
                {med.icon}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold">{med.name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {med.dose} · {med.time}
                </p>
                
                <span
                  className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusStyle(med.dailyStatus)}`}
                >
                  {med.dailyStatus}
                </span>

              </div>

              
              <div className="flex flex-wrap gap-2">
                {med.dailyStatus !== 'Taken' &&
                  med.dailyStatus !== 'Taken late' && (
                    <button
                      onClick={() => markAsTaken(med.id)}
                      className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800"
                    >
                      Mark taken
                    </button>
                  )}

                <button
                  onClick={() => deleteMedicine(med.id)}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </section>

    <p className="mt-5 text-xs leading-5 text-slate-400">
      
      Medication records are saved to your account. Marking a dose records your action; it does not verify ingestion. Follow your prescribed medication instructions.

    </p>
  </div>
) : (
  <>

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Your health, one step at a time</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {activePage === 'Dashboard' 
                ? `Hello, ${user?.name ? user.name.split(' ')[0] : 'there'}! 👋` 
                : activePage}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Here is your medication overview for today.
            </p>
          </div>
          
          
          <button
            onClick={() => setActivePage('Notifications')}
            className="relative rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm hover:bg-slate-50"
          >
            ♧ Notifications

            <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-bold text-red-700">
              {medications.filter(
                (med) =>
                  med.dailyStatus === 'Due now' ||
                  med.dailyStatus === 'Overdue' ||
                  med.dailyStatus === 'Missed'
              ).length}
            </span>
          </button>
          


        </header>

        <section className="mb-7 rounded-3xl bg-gradient-to-r from-teal-800 to-teal-600 p-6 text-white md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm text-teal-100">Your daily progress</p>
              <h3 className="mt-2 text-2xl font-bold">Every dose counts.</h3>
              <p className="mt-2 max-w-lg text-sm leading-6 text-teal-50">
                Keep track of your schedule and record each dose as you take it.
              </p>
            </div>
            <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full border-4 border-white/30 bg-white/10">
              <span className="text-3xl font-bold">{adherence}%</span>
              <span className="mt-1 text-xs text-teal-50">Recorded today</span>
            </div>
          </div>
        </section>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Scheduled doses" value={medications.length} note="For today" icon="◷" />
          <StatCard title="Marked as taken" value={takenCount} note="Recorded doses" icon="✓" />
          <StatCard title="Upcoming doses" value={upcomingCount} note="Not yet due" icon="◴" />
          <StatCard title="Overdue doses" value={overdueCount} note="Past scheduled time" icon="!" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Today's medications</h3>
                <p className="mt-1 text-sm text-slate-500">Your medication schedule</p>
              </div>
              <button
                onClick={() => setActivePage('My Medications')}
                className="text-sm font-semibold text-teal-700 hover:text-teal-900"
              >
                View all →
              </button>
            </div>

            <div className="space-y-3">
              {medications.map((med) => (
                <div key={med.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 p-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xl ${med.color}`}>
                    {med.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{med.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{med.dose} · {med.time}</p>
                    
                    <span
                      className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${getStatusStyle(med.dailyStatus)}`}
                    >
                      {med.dailyStatus}
                    </span>

                  </div>
                  
                  
                  {med.dailyStatus !== 'Taken' &&
                    med.dailyStatus !== 'Taken late' && (
                      <button
                        onClick={() => markAsTaken(med.id)}
                        className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        Mark taken
                      </button>
                  )}

                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-400">
              
                Marking a dose records your action in your account. It does not verify that the medicine was swallowed.

            </p>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
              <h3 className="text-lg font-bold">Medication activity</h3>
              <p className="mt-1 text-sm text-slate-500">Your recorded doses today</p>
              <div className="mt-6 flex items-end gap-2">
                {medications.map((med) => (
                  <div key={med.id} className="flex flex-1 flex-col items-center gap-2">
                    <div className="flex h-32 w-full items-end overflow-hidden rounded-lg bg-slate-100">
                      
                    <div
                      className={`w-full rounded-lg transition-all ${
                        med.dailyStatus === 'Taken' || med.dailyStatus === 'Taken late'
                          ? 'bg-teal-600'
                          : 'bg-slate-300'
                      }`}
                      style={{
                        height:
                          med.dailyStatus === 'Taken' || med.dailyStatus === 'Taken late'
                            ? '100%'
                            : '15%',
                      }}
                    />

                    </div>
                    <span className="text-center text-xs text-slate-500">{med.time.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" /> Recorded as taken
                <span className="ml-2 h-2.5 w-2.5 rounded-sm bg-slate-300" /> Upcoming
              </div>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
              <div className="flex items-center gap-2">
                <span className="text-xl">✧</span>
                <h3 className="font-bold text-teal-900">MedCheck insight</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-teal-900/80">
                Keep your medication schedule organized and record each dose as you take it.
              </p>
              <button
                onClick={() => setActivePage('AI Insights')}
                className="mt-4 text-sm font-semibold text-teal-800 hover:text-teal-950"
              >
                Explore AI insights →
              </button>
            </div>
          </div>
        </section>

        <footer className="mt-8 border-t border-slate-200 py-5 text-xs leading-5 text-slate-400">
          MedCheck prototype · Sample data only · Not a substitute for professional medical advice
        </footer>
          </>
)}
      </main>
    </div>
  )
}

function StatCard({ title, value, note, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 font-bold text-teal-700">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{note}</p>
    </div>
  )
}

export default App
