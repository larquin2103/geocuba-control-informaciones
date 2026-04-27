'use client'

import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2, Mail, Lock, KeyRound, Loader2, Shield,
  ArrowRight, Eye, EyeOff, CheckCircle2, Info
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// ============================================================================
// TYPES
// ============================================================================

type LoginStep = 'email' | 'password' | 'verify-token' | 'setup-password'

interface SessionUser {
  departmentId: string
  email: string
  departmentName: string
  responsibleName: string
  departmentType: string
  isDirectorGeneral: boolean
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

  // Step 1: Initialize credentials (first-time user)
  const initCredentials = useMutation({
    mutationFn: async (emailAddr: string) => {
      const res = await fetch('/api/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al inicializar credenciales')
      return data
    },
    onSuccess: (data) => {
      setInitMessage(data.message)
      setStep('password')
      toast.success('Credenciales enviadas a su correo')
    },
    onError: (error: Error) => {
      if (error.message.includes('ya tiene una contraseña')) {
        // User already has password, go to login
        setStep('password')
        toast.info('Su cuenta ya está activa. Ingrese su contraseña.')
      } else {
        toast.error(error.message)
      }
    },
  })

  // Step 2: Login with email + password
  const loginMutation = useMutation({
    mutationFn: async ({ emailAddr, pass }: { emailAddr: string; pass: string }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr, password: pass }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === 'FIRST_TIME_LOGIN') {
          throw new Error('FIRST_TIME_LOGIN')
        }
        throw new Error(data.error || 'Error al iniciar sesión')
      }
      return data
    },
    onSuccess: () => {
      window.location.href = '/'
    },
    onError: (error: Error) => {
      if (error.message === 'FIRST_TIME_LOGIN') {
        initCredentials.mutate(email)
      } else {
        toast.error(error.message)
      }
    },
  })

  // Step 3: Verify security token
  const verifyTokenMutation = useMutation({
    mutationFn: async ({ emailAddr, pass, securityToken }: { emailAddr: string; pass: string; securityToken: string }) => {
      const res = await fetch('/api/auth/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailAddr, password: pass, token: securityToken }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Token inválido')
      return data
    },
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
    mutationFn: async ({ deptId, newPass }: { deptId: string; newPass: string }) => {
      const res = await fetch('/api/auth/setup-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId, newPassword: newPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al configurar contraseña')
      return data
    },
    onSuccess: () => {
      toast.success('Contraseña configurada exitosamente')
      window.location.href = '/'
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  // Handle email submit
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    // Check if this is a first-time login attempt
    loginMutation.mutate({ emailAddr: email, pass: '' })
  }

  // Handle login submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    loginMutation.mutate({ emailAddr: email, pass: password })
  }

  // Handle token verification
  const handleTokenVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    verifyTokenMutation.mutate({ emailAddr: email, pass: password, securityToken: token })
  }

  // Handle password setup
  const handlePasswordSetup = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPassword || newPassword !== confirmPassword) return
    if (newPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setupPasswordMutation.mutate({ deptId: verifiedDeptId, newPass: newPassword })
  }

  const isLoading = initCredentials.isPending || loginMutation.isPending || verifyTokenMutation.isPending || setupPasswordMutation.isPending

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
            { key: 'email', label: '1', done: step !== 'email' },
            { key: 'password', label: '2', done: step === 'verify-token' || step === 'setup-password' },
            { key: 'verify', label: '3', done: step === 'setup-password' },
            { key: 'setup', label: '4', done: false },
          ].filter(s => {
            // Only show steps that are relevant
            if (s.key === 'verify' || s.key === 'setup') {
              return step === 'verify-token' || step === 'setup-password'
            }
            return true
          }).map((s, i, arr) => (
            <React.Fragment key={s.key}>
              <div className={`flex items-center gap-1.5 ${s.done ? 'text-emerald-400' : arr[i] ? 'text-blue-300' : 'text-blue-500'}`}>
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

          {/* Step: Password Entry */}
          {step === 'password' && (
            <>
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">Ingrese su Contraseña</CardTitle>
                <CardDescription>
                  <span className="text-blue-700 font-medium">{email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                {initMessage && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-start gap-2">
                    <Info className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-700">{initMessage}</p>
                  </div>
                )}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Ingrese su contraseña"
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
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => setStep('email')}
                    disabled={isLoading}
                  >
                    Cambiar correo
                  </Button>
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
                      Por seguridad, debe ingresar el token que recibió en su correo para verificar su identidad antes de crear su contraseña.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="token">Token de Seguridad</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        id="token"
                        type="text"
                        placeholder="Ingrese el token de 64 caracteres"
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
