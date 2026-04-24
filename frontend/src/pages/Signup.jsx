import { useState } from 'react'
import { Link, useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const tiers = {
  free: { name: 'Free', price: '$0', color: 'slate' },
  premium: { name: 'Premium', price: '$49', color: 'blue' },
  exclusive: { name: 'Exclusive', price: '$199', color: 'blue' },
}

export default function Signup() {
  const [searchParams] = useSearchParams()
  const initialTier = searchParams.get('tier') || 'free'

  const [tier, setTier] = useState(initialTier)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [teamPin, setTeamPin] = useState('')
  const [isTeamLeader, setIsTeamLeader] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const currentTier = tiers[tier]

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const userData = {
        username: email,
        email,
        password,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        tier: tier.toUpperCase(),
      }

      // Exclusive: send team role + PIN if joining
      if (tier === 'exclusive') {
        userData.is_team_leader = isTeamLeader
        if (!isTeamLeader && teamPin) {
          userData.team_pin = teamPin
        }
      }

      await register(userData)
      navigate('/dashboard')
    } catch (err) {
      const data = err.response?.data
      if (data) {
        const msg = data.detail || data.error || (typeof data === 'object' ? Object.values(data).flat().join(' ') : String(data))
        setError(msg)
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-4 py-2.5 text-sm text-white placeholder-slate-600 outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all'

  return (
    <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center px-4 py-12 font-sans antialiased">
      {/* Background grid */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Background glow */}
      <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="white" className="size-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
              </svg>
            </div>
            <span className="text-xl font-semibold tracking-tight text-white group-hover:text-slate-200 transition-colors">DurianDetector</span>
          </Link>
          <p className="mt-3 text-sm text-slate-500">Create your account</p>
        </div>

        {/* Card */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8">
          {/* Tier selector */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2.5">Select your plan</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(tiers).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTier(key)}
                  className={`relative rounded-lg px-3 py-3 text-center transition-all cursor-pointer ${
                    tier === key
                      ? 'bg-blue-500/15 border border-blue-500/30 text-white'
                      : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:border-white/[0.1] hover:text-slate-300'
                  }`}
                >
                  <div className="text-xs font-semibold uppercase tracking-wide">{t.name}</div>
                  <div className={`text-lg font-bold mt-0.5 ${tier === key ? 'text-blue-400' : 'text-slate-300'}`}>
                    {t.price}
                  </div>
                  <div className="text-[10px] text-slate-500">/month</div>
                  {tier === key && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="size-2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tier badge */}
          <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-blue-500/[0.06] border border-blue-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 text-blue-400 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            <span className="text-xs text-blue-300/80">
              {tier === 'free' && 'Get started with core IDS monitoring — 7-day alert history, analytics, and more.'}
              {tier === 'premium' && 'Unlock full alert history, custom rules, incident management, ML configuration & more.'}
              {tier === 'exclusive' && 'Everything in Premium plus team workspaces, alert assignment & dedicated support.'}
            </span>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name fields */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                  First Name
                </label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="John"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="last-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Last Name
                </label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password"
                  required
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your password"
                required
                className={inputClass}
              />
            </div>

            {/* Exclusive role selection + optional Team PIN */}
            {tier === 'exclusive' && (
              <>
                {/* Role selector */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">I am a...</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsTeamLeader(true); setTeamPin('') }}
                      className={`rounded-lg px-3 py-3 text-center transition-all cursor-pointer ${
                        isTeamLeader
                          ? 'bg-purple-500/15 border border-purple-500/30 text-white'
                          : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide">Team Leader</div>
                      <div className="text-[11px] text-slate-500 mt-1">Create a new team</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsTeamLeader(false)}
                      className={`rounded-lg px-3 py-3 text-center transition-all cursor-pointer ${
                        !isTeamLeader
                          ? 'bg-blue-500/15 border border-blue-500/30 text-white'
                          : 'bg-white/[0.03] border border-white/[0.06] text-slate-400 hover:border-white/[0.1]'
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide">Team Member</div>
                      <div className="text-[11px] text-slate-500 mt-1">Join with a PIN</div>
                    </button>
                  </div>
                </div>

                {/* PIN input — only for members joining a team */}
                {!isTeamLeader && (
                  <div>
                    <label htmlFor="team-pin" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Team PIN
                      <span className="text-slate-500 font-normal ml-1.5">(from your team leader)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="team-pin"
                        type="text"
                        value={teamPin}
                        onChange={(e) => setTeamPin(e.target.value)}
                        placeholder="e.g. A7X42K"
                        required
                        className={`${inputClass} tracking-widest font-mono`}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 text-slate-600">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                        </svg>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-600">Enter the PIN shared by your team leader to join their workspace.</p>
                  </div>
                )}

                {/* Leader info */}
                {isTeamLeader && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/[0.06] border border-purple-500/15">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4 text-purple-400 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                    </svg>
                    <span className="text-xs text-purple-300/80">
                      You'll be the team leader. After signing up, you can generate a PIN to invite up to 4 team members.
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-all shadow-lg shadow-blue-600/20 hover:shadow-blue-500/30 cursor-pointer text-sm mt-2"
            >
              {submitting ? 'Creating account...' : `Create ${currentTier.name} Account`}
            </button>
          </form>

        </div>

        {/* Sign in link */}
        <p className="text-center mt-6 text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
