
import { useState } from 'react'

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      const endpoint =
        mode === 'login'
          ? '/api/auth/login'
          : '/api/auth/register'

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          mode === 'login'
            ? { email, password }
            : { name, email, password }
        ),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.')
      }

      if (mode === 'login') {
        onLogin(data.user)
      } else {
        setMode('login')
        setPassword('')
        setMessage('Account created successfully! Please log in.')
      }
    } catch (err) {
      setError(
        err.message || 'Unable to connect to the server. Check that the backend is running.'
      )
    } finally {
      setLoading(false)
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setMessage('')
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-600 text-2xl text-white">
            +
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            MedCheck
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Your personal medication management companion
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-slate-900">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              {mode === 'login'
                ? 'Log in to manage your medication schedule.'
                : 'Register to get started with MedCheck.'}
            </p>
          </div>

          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => changeMode('login')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => changeMode('register')}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-white text-teal-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {message && (
            <div
              role="status"
              className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Full name
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your full name"
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  required
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                maxLength={254}
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                minLength={8}
                maxLength={72}
                autoComplete={
                  mode === 'login' ? 'current-password' : 'new-password'
                }
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
              />

              {mode === 'register' && (
                <p className="mt-1.5 text-xs text-slate-500">
                  Use at least 8 characters.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Log in to MedCheck'
                  : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-500">
            Your medication information should remain private to your account.
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          MedCheck · Medication monitoring and management
        </p>
      </div>
    </div>
  )
}
