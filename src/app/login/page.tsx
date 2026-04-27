'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2, Mail, Lock, KeyRound, Loader2, Shield,
  ArrowRight, Eye, EyeOff, CheckCircle2, Info, User,
  Copy, AlertTriangle
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================================================
// TYPES
// ============================================================================

type LoginStep = 'email' | 'password' | 'credentials-shown' | 'verify-token' | 'setup-password'

/** Safe fetch that handles non-JSON responses gracefully */
async function safeApiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let errorMsg = `Error del servidor (${res.status})`
    try { const d = JSON.parse(text); errorMsg = d.error || errorMsg } catch {}
    throw new Error(errorMsg)
  }
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('Respuesta del servidor no es válida')
  }
}

// ============================================================================
// LOGIN PAGE
// ============================================================================

export default function LoginPage() {
  const [step, setStep] = useState<LoginStep>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [verifiedDeptId, setVerifiedDeptId] = useState('')
  const [initMessage, setInitMessage] = useState('')
  const [isFirstTime, setIsFirstTime] = useState(false)
  const [deptInfo, setDeptInfo] = useState<{ name: string; responsibleName: string } | null>(null)
  const [shownCredentials, setShownCredentials] = useState<{ tempPassword: string; token: string } | null>(null)

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(`${label} copiado al portapapeles`)
    }).catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      toast.success(`${label} copiado al portapapeles`)
    })
  }

  // Step 1: Check if email exists in the system
  const checkEmail = useMutation({
    mutationFn: (emailAddr: string) => safeApiFetch<{ exists: boolean; hasPassword: boolean; departmentName: string; responsibleName: string }>('/api/auth/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailAddr }),
    }),
    onSuccess: (data) => {
      setDeptInfo({ name: data.departmentName, responsibleName: data.responsibleName })

      if (!data.hasPassword) {
        // First time user - initialize credentials
        setIsFirstTime(true)
        initCredentials.mutate(email)
      } else {
        // Returning user - go to password step
        setIsFirstTime(false)
        setInitMessage('')
        setStep('password')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Initialize credentials for first-time user
  const initCredentials = useMutation({
    mutationFn: (emailAddr: string) => safeApiFetch<any>('/api/auth/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailAddr }),
    }),
    onSuccess: (data) => {
      if (!data.emailSent && data.tempPassword && data.token) {
        // Email failed - show credentials on screen
        setShownCredentials({ tempPassword: data.tempPassword, token: data.token })
        setInitMessage(data.message)
        setStep('credentials-shown')
      } else {
        // Email sent - go to password step
        setInitMessage(data.message)
        setStep('password')
        toast.success('Credenciales enviadas a su correo electrónico')
      }
    },
    onError: (error: Error) => {
      if (error.message.includes('ya tiene una contraseña')) {
        setIsFirstTime(false)
        setStep('password')
        toast.info('Su cuenta ya está activa. Ingrese su contraseña.')
      } else {
        toast.error(error.message)
      }
    },
  })

  // Reset credentials (forgot password)
  const resetCredentials = useMutation({
    mutationFn: (emailAddr: string) => safeApiFetch<any>('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: emailAddr }),
    }),
    onSuccess: (data) => {
      if (!data.emailSent && data.tempPassword && data.token) {
        // Email failed - show credentials on screen
        setShownCredentials({ tempPassword: data.tempPassword, token: data.token })
        setInitMessage(data.message)
        setIsFirstTime(true) // will need to verify token and set new password
        setStep('credentials-shown')
      } else {
        setInitMessage(data.message)
        setIsFirstTime(true) // will need to verify token and set new password
        setStep('password')
        toast.success('Nuevas credenciales enviadas a su correo electrónico')
      }
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Step 2: Login with email + password
  const loginMutation = useMutation({
    mutationFn: async ({ emailAddr, pass }: { emailAddr: string; pass: string }) => {
      try {
        return await safeApiFetch<any>('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailAddr, password: pass }),
        })
      } catch (err) {
        if (err instanceof Error && err.message === 'FIRST_TIME_LOGIN') {
          throw new Error('FIRST_TIME_LOGIN')
        }
        throw err
      }
    },
    onSuccess: (data) => {
      if (data.requiresTokenVerification) {
        setStep('verify-token')
        toast.info('Debe verificar su identidad con el token de seguridad')
      } else {
        window.location.href = '/'
      }
    },
    onError: (error: Error) => {
      if (error.message === 'FIRST_TIME_LOGIN') {
        setStep('verify-token')
        toast.info('Verifique su identidad con el token enviado a su correo')
      } else {
        toast.error(error.message)
      }
    },
  })

  // Step 3: Verify security token
  const verifyTokenMutation = useMutation({
    mutationFn: ({ emailAddr, pass, securityToken }: { emailAddr: string; pass: string; securityToken: string }) =>
      safeApiFetch<any>('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr, password: pass, token: securityToken }),
      }),
    onSuccess: (data) => {
      setVerifiedDeptId(data.departmentId)
      setStep('setup-password')
      toast.success('Token verificado correctamente')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Step 4: Setup new password
  const setupPasswordMutation = useMutation({
    mutationFn: ({ deptId, newPass }: { deptId: string; newPass: string }) =>
      safeApiFetch<any>('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId, newPassword: newPass }),
      }),
    onSuccess: () => {
      toast.success('Contraseña configurada exitosamente')
      window.location.href = '/'
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Handle email submit (Step 1)
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    checkEmail.mutate(email)
  }

  // Handle login submit (Step 2)
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    loginMutation.mutate({ emailAddr: email, pass: password })
  }

  // Handle token verification (Step 3)
  const handleTokenVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    verifyTokenMutation.mutate({ emailAddr: email, pass: password, securityToken: token })
  }

  // Handle password setup (Step 4)
  const handlePasswordSetup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword !== confirmPassword) return
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setupPasswordMutation.mutate({ deptId: verifiedDeptId, newPass: newPassword })
  }

  const isLoading = checkEmail.isPending || initCredentials.isPending || resetCredentials.isPending || loginMutation.isPending || verifyTokenMutation.isPending || setupPasswordMutation.isPending

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="bg-white/10 p-3 rounded-2xl inline-flex mb-4">
            <Building2 className="size-10 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">GEOCUBA Camagüey - Ciego de Ávila</h1>
          <p className="text-blue-300 text-sm mt-1">Sistema de Control de Entrega de Informaciones</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[
            { key: 'email', label: '1', done: step !== 'email' && step !== 'credentials-shown' },
            { key: 'password', label: '2', done: step === 'verify-token' || step === 'setup-password' },
            { key: 'verify', label: '3', done: step === 'setup-password' },
            { key: 'setup', label: '4', done: false },
          ].filter(s => {
            // Only show token/setup steps when relevant (first-time login)
            if (s.key === 'verify' || s.key === 'setup') {
              return isFirstTime || step === 'verify-token' || step === 'setup-password'
            }
            return true
          }).map((s, i, arr) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 ${s.done ? 'text-emerald-400' : 'text-blue-300'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  s.done ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white'
                }`}>
                  {s.done ? <CheckCircle2 className="size-4" /> : s.label}
                </div>
              </div>
              {i < arr.length - 1 && (
                <div className={`w-8 h-0.5 ${s.done ? 'bg-emerald-500' : 'bg-white/20'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Login Card */}
        <Card className="shadow-2xl border-0">
          {/* Step: Email Entry */}
          {step === 'email' && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">Iniciar Sesión</CardTitle>
                <CardDescription>Ingrese su correo institucional para acceder al sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="nombre@camaguey.geocuba.cu"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-9 min-h-[44px]"
                        autoFocus
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white min-h-[44px]"
                    disabled={isLoading || !email.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRight className="size-4 mr-2" />
                    )}
                    Continuar
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* Step: Credentials Shown (when email delivery failed) */}
          {step === 'credentials-shown' && shownCredentials && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <KeyRound className="size-5 text-amber-600" />
                  Sus Credenciales de Acceso
                </CardTitle>
                <CardDescription>
                  No se pudo enviar el correo. Guarde esta información.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    El servidor de correo no está disponible. Anote sus credenciales y guárdelas en un lugar seguro. No podrá verlas de nuevo.
                  </p>
                </div>

                {/* Department info */}
                {deptInfo && (
                  <div className="bg-slate-50 border rounded-lg p-3 mb-4">
                    <p className="text-sm font-medium">{deptInfo.responsibleName}</p>
                    <p className="text-xs text-muted-foreground">{deptInfo.name}</p>
                    <p className="text-xs text-muted-foreground">{email}</p>
                  </div>
                )}

                {/* Temp Password */}
                <div className="space-y-3 mb-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-semibold text-red-700">Contraseña Temporal</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(shownCredentials.tempPassword, 'Contraseña')}
                      >
                        <Copy className="size-3 mr-1" /> Copiar
                      </Button>
                    </div>
                    <p className="text-lg font-bold font-mono text-red-800 tracking-wider break-all">
                      {shownCredentials.tempPassword}
                    </p>
                  </div>

                  {/* Security Token */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-semibold text-blue-700">Token de Seguridad</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(shownCredentials.token, 'Token')}
                      >
                        <Copy className="size-3 mr-1" /> Copiar
                      </Button>
                    </div>
                    <p className="text-sm font-bold font-mono text-blue-800 tracking-wide break-all leading-relaxed">
                      {shownCredentials.token}
                    </p>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-xs text-blue-700 font-semibold mb-1">📌 Instrucciones:</p>
                  <ol className="text-xs text-blue-700 list-decimal list-inside space-y-1">
                    <li>Copie la <strong>contraseña temporal</strong> y el <strong>token</strong></li>
                    <li>Haga clic en &quot;Continuar&quot; para ir al inicio de sesión</li>
                    <li>Ingrese la contraseña temporal</li>
                    <li>Ingrese el token de seguridad</li>
                    <li>Cree su nueva contraseña personal</li>
                  </ol>
                </div>

                <Button
                  type="button"
                  className="w-full bg-blue-700 hover:bg-blue-800 text-white min-h-[44px]"
                  onClick={() => {
                    setPassword('') // User will enter the temp password they just saw
                    setStep('password')
                  }}
                >
                  <ArrowRight className="size-4 mr-2" />
                  Continuar al Inicio de Sesión
                </Button>
              </CardContent>
            </>
          )}

          {/* Step: Password Entry */}
          {step === 'password' && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">Ingrese su Contraseña</CardTitle>
                <CardDescription>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <User className="size-3.5 text-blue-700" />
                    <span className="text-blue-700 font-medium">{email}</span>
                  </div>
                  {deptInfo && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {deptInfo.responsibleName} · {deptInfo.name}
                    </p>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {initMessage && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <Info className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">{initMessage}</p>
                  </div>
                )}
                {isFirstTime && !initMessage && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <Info className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Es su primer acceso. Ingrese la contraseña temporal que recibió en su correo electrónico.
                    </p>
                  </div>
                )}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">
                      {isFirstTime ? 'Contraseña Temporal' : 'Contraseña'}
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder={isFirstTime ? 'Ingrese la contraseña temporal' : 'Ingrese su contraseña'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-10 min-h-[44px]"
                        autoFocus
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white min-h-[44px]"
                    disabled={isLoading || !password}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Lock className="size-4 mr-2" />
                    )}
                    Iniciar Sesión
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1 text-xs"
                      onClick={() => { setStep('email'); setPassword(''); setInitMessage(''); }}
                      disabled={isLoading}
                    >
                      Cambiar correo
                    </Button>
                    {!isFirstTime && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="flex-1 text-xs text-amber-700 hover:text-amber-800"
                        onClick={() => resetCredentials.mutate(email)}
                        disabled={isLoading || resetCredentials.isPending}
                      >
                        {resetCredentials.isPending ? (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        ) : (
                          <KeyRound className="size-3 mr-1" />
                        )}
                        Olvidé mi contraseña
                      </Button>
                    )}
                  </div>
                </form>
              </CardContent>
            </>
          )}

          {/* Step: Token Verification */}
          {step === 'verify-token' && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <Shield className="size-5 text-amber-600" />
                  Verificación de Seguridad
                </CardTitle>
                <CardDescription>
                  Ingrese el token de seguridad que fue enviado a su correo electrónico
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleTokenVerify} className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <Shield className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700">
                      Por seguridad, debe ingresar el token que recibió en su correo para verificar su identidad antes de crear su contraseña definitiva.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="token">Token de Seguridad</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => copyToClipboard(token, 'Token')}
                      >
                        <Copy className="size-3 mr-1" /> Copiar campo
                      </Button>
                    </div>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="token"
                        type="text"
                        placeholder="Ingrese el token de seguridad"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="pl-9 min-h-[44px] font-mono text-sm"
                        autoFocus
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-700 hover:bg-blue-800 text-white min-h-[44px]"
                    disabled={isLoading || token.length < 10}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Shield className="size-4 mr-2" />
                    )}
                    Verificar Token
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => setStep('password')}
                    disabled={isLoading}
                  >
                    Volver
                  </Button>
                </form>
              </CardContent>
            </>
          )}

          {/* Step: Setup New Password */}
          {step === 'setup-password' && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <KeyRound className="size-5 text-emerald-600" />
                  Crear Contraseña
                </CardTitle>
                <CardDescription>
                  Cree su contraseña personal para acceder al sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSetup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nueva Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-9 pr-10 min-h-[44px]"
                        autoFocus
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Repita la contraseña"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-9 min-h-[44px]"
                        disabled={isLoading}
                      />
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-xs text-red-500">Las contraseñas no coinciden</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px]"
                    disabled={isLoading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-4 mr-2" />
                    )}
                    Crear Contraseña y Entrar
                  </Button>
                </form>
              </CardContent>
            </>
          )}
        </Card>

        {/* Footer */}
        <p className="text-center text-blue-400/60 text-[11px] mt-6">
          © {new Date().getFullYear()} GEOCUBA Camagüey - Ciego de Ávila · Sistema de Control de Entrega de Informaciones
        </p>
      </div>
    </div>
  )
}
