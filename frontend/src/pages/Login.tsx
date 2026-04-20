import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { signIn, signUp, confirmSignUp, signInWithRedirect, resendSignUpCode } from 'aws-amplify/auth'
import { useAuth } from '../context/AuthContext'

type Mode = 'signin' | 'signup'
type Step = 'form' | 'verify'

export default function Login() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const authError = (location.state as { error?: string } | null)?.error

  const [mode, setMode] = useState<Mode>('signin')
  const [step, setStep] = useState<Step>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState(authError ?? '')
  const [loading, setLoading] = useState(false)

  const passwordLongEnough = password.length >= 14
  const passwordsMatch = confirm === password && password.length > 0

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && !passwordsMatch) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn({ username: email, password })
        navigate('/dashboard', { replace: true })
      } else {
        await signUp({
          username: email,
          password,
          options: { userAttributes: { email } },
        })
        setStep('verify')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await confirmSignUp({ username: email, confirmationCode: code })
      await signIn({ username: email, password })
      navigate('/dashboard', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignIn() {
    setError('')
    await signInWithRedirect({ provider: 'Google' })
  }

  function switchMode(next: Mode) {
    setMode(next)
    setStep('form')
    setError('')
    setCode('')
    setConfirm('')
  }

  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="w-full max-w-sm px-6 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-white">Check your email</h1>
            <p className="text-brand-accent/70 text-sm">We sent a code to {email}</p>
          </div>
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full px-4 py-3 bg-brand-light/20 border border-brand-light/30 rounded-lg text-white placeholder-brand-accent/40 focus:outline-none focus:border-brand-cta text-center text-xl tracking-widest"
              maxLength={6}
              required
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-cta text-brand-bg rounded-lg font-semibold hover:bg-brand-cta/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
          <button
            onClick={() => resendSignUpCode({ username: email })}
            className="w-full text-sm text-brand-accent/60 hover:text-brand-accent transition-colors"
          >
            Resend code
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="w-full max-w-sm px-6 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-white">Summarizinator</h1>
          <p className="text-brand-accent/70 text-sm">
            Turn activity into executive-ready updates in 30 seconds.
          </p>
        </div>

        <div className="flex rounded-lg overflow-hidden border border-brand-light/30">
          <button
            onClick={() => switchMode('signin')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signin' ? 'bg-brand-cta text-brand-bg' : 'text-brand-accent/70 hover:text-white'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => switchMode('signup')}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === 'signup' ? 'bg-brand-cta text-brand-bg' : 'text-brand-accent/70 hover:text-white'}`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-brand-light/20 border border-brand-light/30 rounded-lg text-white placeholder-brand-accent/40 focus:outline-none focus:border-brand-cta"
            required
          />
          <div className="space-y-1">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-brand-light/20 border border-brand-light/30 rounded-lg text-white placeholder-brand-accent/40 focus:outline-none focus:border-brand-cta"
              required
            />
            {mode === 'signup' && (
              <p className={`text-xs px-1 transition-colors ${passwordLongEnough ? 'text-green-400' : 'text-brand-accent/50'}`}>
                {passwordLongEnough ? '✓' : '·'} At least 14 characters
              </p>
            )}
          </div>
          {mode === 'signup' && (
            <div className="space-y-1">
              <input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-brand-light/20 border border-brand-light/30 rounded-lg text-white placeholder-brand-accent/40 focus:outline-none focus:border-brand-cta"
                required
              />
              {confirm.length > 0 && (
                <p className={`text-xs px-1 transition-colors ${passwordsMatch ? 'text-green-400' : 'text-red-400/70'}`}>
                  {passwordsMatch ? '✓ Passwords match' : '· Passwords do not match'}
                </p>
              )}
            </div>
          )}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-cta text-brand-bg rounded-lg font-semibold hover:bg-brand-cta/90 transition-colors disabled:opacity-50"
          >
            {loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-brand-light/20" />
          <span className="text-brand-accent/40 text-xs">or</span>
          <div className="flex-1 h-px bg-brand-light/20" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-brand-light/30 rounded-lg text-white hover:bg-brand-light/10 transition-colors"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}
