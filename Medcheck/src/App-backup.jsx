
import { useEffect, useState } from 'react'

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
]

function formatMedication(med) {
  const [hours, minutes] = med.time.split(':')
  const hour = Number(hours)

  return {
    ...med,
    time: `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`,
    color: 'bg-teal-100 text-teal-700',
    icon: '💊',
  }
}

function App() {
  const [activePage, setActivePage] = useState('Dashboard')
  const [medications, setMedications] = useState([])
  const [apiError, setApiError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newMedicine, setNewMedicine] = useState({
    name: '',
    dose: '',
    time: '08:00',
  })


  const takenCount = medications.filter((med) => med.status === 'Taken').length
  const adherence = medications.length
  ? Math.round((takenCount / medications.length) * 100)
  : 0
  
useEffect(() => {
  async function loadMedications() {
    try {
      const response = await fetch('http://localhost:5000/api/medications')

      if (!response.ok) {
        throw new Error('Could not load medications')
      }

      const data = await response.json()
      setMedications(data.map(formatMedication))
      setApiError('')
    } catch (error) {
      console.error(error)
      setApiError(
        'Could not connect to the MedCheck server. Check that the backend is running.',
      )
    }
  }

  loadMedications()
}, [])

  
async function addMedicine(event) {
  event.preventDefault()

  if (!newMedicine.name.trim() || !newMedicine.dose.trim()) {
    return
  }

  try {
    const response = await fetch('http://localhost:5000/api/medications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

async function markAsTaken(id) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/medications/${id}/taken`,
      { method: 'PATCH' },
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

async function deleteMedicine(id) {
  try {
    const response = await fetch(
      `http://localhost:5000/api/medications/${id}`,
      { method: 'DELETE' },
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
              onClick={() => setActivePage(item.name)}
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
            S
          </div>
          <div>
            <p className="text-sm font-semibold">Sneha</p>
            <p className="text-xs text-slate-500">Patient account</p>
          </div>
        </div>
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
{activePage === 'My Medications' ? (
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
        value={medications.filter((med) => med.status === 'Taken').length}
        note="Today's sample records"
        icon="✓"
      />
      <StatCard
        title="Upcoming"
        value={medications.filter((med) => med.status === 'Upcoming').length}
        note="Not yet marked as taken"
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
                <span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  med.status === 'Taken'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-amber-50 text-amber-700'
                }`}>
                  {med.status}
                </span>
              </div>

              <button
                onClick={() => deleteMedicine(med.id)}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </section>

    <p className="mt-5 text-xs leading-5 text-slate-400">
      Prototype only. These changes are held in browser memory and will reset on refresh. Follow your prescribed medication instructions.
    </p>
  </div>
) : (
  <>

        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Your health, one step at a time</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight md:text-3xl">
              {activePage === 'Dashboard' ? 'Good morning, Sneha 👋' : activePage}
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
          <StatCard title="Upcoming doses" value={medications.filter((med) => med.status === 'Upcoming').length} note="Still on your schedule" icon="◴" />
          <StatCard title="Needs review" value="0" note="No review flags in this demo" icon="!" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">Today's medications</h3>
                <p className="mt-1 text-sm text-slate-500">Your sample daily schedule</p>
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
                    <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                      med.status === 'Taken'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {med.status}
                    </span>
                  </div>
                  {med.status !== 'Taken' && (
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
              Demo only: marking a dose records a sample action in this browser session. It does not verify ingestion.
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
                        className={`w-full rounded-lg transition-all ${med.status === 'Taken' ? 'bg-teal-600' : 'bg-slate-300'}`}
                        style={{ height: med.status === 'Taken' ? '100%' : '15%' }}
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
                Your dashboard is ready to track sample medication records. AI-generated insights will be added after the monitoring service is connected.
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
