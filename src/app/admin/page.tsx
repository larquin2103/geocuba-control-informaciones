'use client'

import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Building2, Lock, Mail, KeyRound, Loader2, Eye, EyeOff,
  BarChart3, Users, FileText, AlertTriangle, Mail as MailIcon,
  RefreshCw, Search, Copy, LogOut, Settings, CheckCircle2,
  XCircle, ArrowRight, Server, Wifi, WifiOff, ChevronLeft,
  ChevronRight, Filter
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// ============================================================================
// TYPES
// ============================================================================

type TabId = 'dashboard' | 'departments' | 'requests' | 'emails' | 'affectations' | 'smtp'

interface DashboardData {
  metrics: {
    totalDepts: number; activeDepts: number; deptsWithPass: number; deptsNoPass: number; deptsNeverLogin: number
    totalReqs: number; solicitadas: number; enFecha: number; cumplidas: number; incumplidas: number; complianceRate: string
    totalEmails: number; okEmails: number; failEmails: number; totalAffect: number; pendingReview: number
  }
  recentLogins: { id: string; name: string; email: string; lastLoginAt: string | null }[]
  upcoming: { id: string; description: string; status: string; deadlineDate: string; providerDept: { name: string }; requesterDept: { name: string } }[]
  deptAffectationEnriched: { departmentName: string; totalAffectation: number; incidentCount: number }[]
}

interface DeptData {
  id: string; name: string; type: string; responsibleName: string; email: string
  phone: string | null; active: boolean; hasPassword: boolean; lastLoginAt: string | null
}

interface EmailLogData {
  id: string
  recipientEmail: string
  subject: string
  emailType: string
  sentAt: string
  success: boolean
  error: string | null
  request: {
    description: string
    status: string
    providerDept: { name: string }
    requesterDept: { name: string }
  } | null
}

interface SmtpTestResult {
  connected: boolean
  authenticated: boolean
  error?: string
  details?: {
    host: string
    port: number
    secure: boolean
    hasAuth: boolean
    authUser: string
  }
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function AdminPage() {
  const [isAuthed, setIsAuthed] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('geocuba_admin_auth') === 'true'
    }
    return false
  })
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [deptSearch, setDeptSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [credentialsResult, setCredentialsResult] = useState<any>(null)

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (loginEmail === 'larquin@camaguey.geocuba.cu' && loginPass === 'geocuba2025*') {
      setIsAuthed(true)
      sessionStorage.setItem('geocuba_admin_auth', 'true')
    } else {
      toast.error('Correo o contraseña incorrectos')
    }
  }

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-4">
        <Card className="w-full max-w-sm shadow-2xl border-0">
          <CardHeader className="text-center">
            <div className="bg-blue-100 p-3 rounded-2xl inline-flex mx-auto mb-3">
              <Building2 className="size-8 text-blue-700" />
            </div>
            <CardTitle className="text-lg">Panel de Administración</CardTitle>
            <p className="text-sm text-muted-foreground">GEOCUBA Camagüey - Ciego de Ávila</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Correo</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="pl-9" placeholder="correo@geocuba.cu" required />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input type={showPass ? 'text' : 'password'} value={loginPass} onChange={e => setLoginPass(e.target.value)} className="pl-9 pr-10" placeholder="Contraseña" required />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full bg-blue-700 hover:bg-blue-800">Iniciar Sesión</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 to-blue-800 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-blue-200 hover:text-white transition-colors">
            <ChevronLeft className="size-4" />
            <span className="text-xs hidden sm:inline">Volver</span>
          </a>
          <div className="w-px h-5 bg-blue-600" />
          <Building2 className="size-5" />
          <h1 className="font-bold text-sm sm:text-base">GEOCUBA CM-CA - Panel de Administración</h1>
        </div>
        <Button variant="ghost" size="sm" className="text-blue-200 hover:text-white hover:bg-blue-800" onClick={() => { sessionStorage.removeItem('geocuba_admin_auth'); setIsAuthed(false) }}>
          <LogOut className="size-4 mr-1" /> Salir
        </Button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-4 flex gap-0 overflow-x-auto">
        {([
          { id: 'dashboard' as TabId, icon: BarChart3, label: 'Dashboard' },
          { id: 'departments' as TabId, icon: Users, label: 'Direcciones' },
          { id: 'requests' as TabId, icon: FileText, label: 'Solicitudes' },
          { id: 'emails' as TabId, icon: MailIcon, label: 'Correos' },
          { id: 'affectations' as TabId, icon: AlertTriangle, label: 'Afectaciones' },
          { id: 'smtp' as TabId, icon: Settings, label: 'SMTP' },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id ? 'text-blue-700 border-blue-700' : 'text-muted-foreground border-transparent hover:text-blue-600'
            }`}>
            <tab.icon className="size-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 max-w-7xl mx-auto">
        {/* Credentials Modal */}
        {credentialsResult && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-blue-800">🔑 Credenciales Restablecidas</h3>
              <Button variant="ghost" size="sm" onClick={() => setCredentialsResult(null)}>✕</Button>
            </div>
            <p className="text-sm text-blue-700 mb-2">Dirección: <strong>{credentialsResult.departmentName}</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="bg-red-50 border border-red-200 rounded p-2">
                <p className="text-xs text-red-600 font-medium">Contraseña Temporal</p>
                <div className="flex items-center gap-2">
                  <code className="text-red-800 font-bold text-lg">{credentialsResult.tempPassword}</code>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(credentialsResult.tempPassword); toast.success('Copiada') }}>
                    <Copy className="size-3" />
                  </Button>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <p className="text-xs text-blue-600 font-medium">Token de Seguridad</p>
                <div className="flex items-center gap-2">
                  <code className="text-blue-800 font-bold text-xs break-all">{credentialsResult.token}</code>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(credentialsResult.token); toast.success('Copiado') }}>
                    <Copy className="size-3" />
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-blue-600 mt-2">Comunique estas credenciales al responsable. El token expira en 24 horas.</p>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'departments' && <DepartmentsTab search={deptSearch} setSearch={setDeptSearch} filter={deptFilter} setFilter={setDeptFilter} onReset={setCredentialsResult} />}
        {activeTab === 'requests' && <RequestsTab />}
        {activeTab === 'emails' && <EmailsTab />}
        {activeTab === 'affectations' && <AffectationsTab />}
        {activeTab === 'smtp' && <SmtpTab />}
      </div>
    </div>
  )
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================

function DashboardTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/admin/dashboard')
      if (!res.ok) throw new Error('Error cargando dashboard')
      return res.json() as Promise<DashboardData>
    },
  })

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-blue-600" /></div>
  if (!data) return <div className="text-center py-12 text-muted-foreground">Error al cargar datos</div>

  const m = data.metrics
  const pctC = m.totalReqs > 0 ? (m.cumplidas / m.totalReqs * 100) : 0
  const pctI = m.totalReqs > 0 ? (m.incumplidas / m.totalReqs * 100) : 0
  const pctE = m.totalReqs > 0 ? (m.enFecha / m.totalReqs * 100) : 0
  const pctS = m.totalReqs > 0 ? (m.solicitadas / m.totalReqs * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">📊 Panel de Control</h2>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="size-4 mr-1" /> Actualizar</Button>
      </div>

      {/* Users */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">👥 Usuarios y Accesos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Direcciones" value={m.totalDepts} color="blue" />
          <MetricCard label="Activas" value={m.activeDepts} color="green" />
          <MetricCard label="Con Contraseña" value={m.deptsWithPass} color="blue" />
          <MetricCard label="Sin Contraseña" value={m.deptsNoPass} color="amber" />
          <MetricCard label="Nunca Han Entrado" value={m.deptsNeverLogin} color="red" />
        </div>
      </div>

      {/* Requests */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">📋 Solicitudes</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total" value={m.totalReqs} color="blue" />
          <MetricCard label="Solicitadas" value={m.solicitadas} color="slate" />
          <MetricCard label="En Fecha" value={m.enFecha} color="amber" />
          <MetricCard label="Cumplidas" value={m.cumplidas} color="green" />
          <MetricCard label="Incumplidas" value={m.incumplidas} color="red" />
          <MetricCard label="Tasa" value={`${m.complianceRate}%`} color="blue" />
        </div>
        {m.totalReqs > 0 && (
          <div className="h-6 rounded-full overflow-hidden flex mt-3">
            {pctC > 0 && <div style={{ width: `${pctC}%` }} className="bg-emerald-500 flex items-center justify-center text-white text-[10px] font-bold">{pctC > 10 ? 'Cumplido' : ''}</div>}
            {pctI > 0 && <div style={{ width: `${pctI}%` }} className="bg-red-500 flex items-center justify-center text-white text-[10px] font-bold">{pctI > 10 ? 'Incumplido' : ''}</div>}
            {pctE > 0 && <div style={{ width: `${pctE}%` }} className="bg-amber-500 flex items-center justify-center text-white text-[10px] font-bold">{pctE > 10 ? 'En Fecha' : ''}</div>}
            {pctS > 0 && <div style={{ width: `${pctS}%` }} className="bg-slate-400 flex items-center justify-center text-white text-[10px] font-bold">{pctS > 10 ? 'Solicitado' : ''}</div>}
          </div>
        )}
      </div>

      {/* Emails + Affectations */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2">📧 Correos / ⚠️ Afectaciones</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Correos Enviados" value={m.totalEmails} color="blue" />
          <MetricCard label="Exitosos" value={m.okEmails} color="green" />
          <MetricCard label="Fallidos" value={m.failEmails} color="red" />
          <MetricCard label="Afectaciones" value={m.totalAffect} color="amber" />
          <MetricCard label="Pendientes Revisión" value={m.pendingReview} color="red" />
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">🕐 Últimos Accesos</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {data.recentLogins.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.recentLogins.map(l => (
                  <div key={l.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                    <div><p className="font-medium">{l.name}</p><p className="text-xs text-muted-foreground">{l.email}</p></div>
                    <p className="text-xs text-muted-foreground">{l.lastLoginAt ? new Date(l.lastLoginAt).toLocaleString('es-CU') : 'Nunca'}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Ningún acceso registrado</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">⏰ Próximos Vencimientos</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {data.upcoming.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data.upcoming.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                    <div><p className="font-medium truncate max-w-[200px]">{r.description}</p><p className="text-xs text-muted-foreground">{r.providerDept.name} → {r.requesterDept.name}</p></div>
                    <p className="text-xs text-amber-600">{new Date(r.deadlineDate).toLocaleDateString('es-CU')}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Sin solicitudes próximas</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// DEPARTMENTS TAB
// ============================================================================

function DepartmentsTab({ search, setSearch, filter, setFilter, onReset }: {
  search: string; setSearch: (s: string) => void; filter: string; setFilter: (f: string) => void
  onReset: (data: any) => void
}) {
  const { data: departments, isLoading, refetch } = useQuery({
    queryKey: ['admin-departments', search, filter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (filter) params.set('filter', filter)
      const res = await fetch(`/api/admin/departments?${params}`)
      if (!res.ok) throw new Error('Error cargando departamentos')
      return res.json() as Promise<DeptData[]>
    },
  })

  const resetMutation = useMutation({
    mutationFn: async (deptId: string) => {
      const res = await fetch('/api/admin/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId }),
      })
      if (!res.ok) throw new Error('Error al restablecer')
      return res.json()
    },
    onSuccess: (data) => {
      onReset(data)
      refetch()
      toast.success(`Contraseña restablecida para ${data.departmentName}`)
    },
    onError: () => toast.error('Error al restablecer contraseña'),
  })

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">👥 Direcciones / Usuarios</h2>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="border rounded-md px-3 py-2 text-sm">
          <option value="">Todos</option>
          <option value="no_password">Sin Contraseña</option>
          <option value="has_password">Con Contraseña</option>
          <option value="never_login">Nunca Han Entrado</option>
        </select>
      </div>

      {isLoading ? <Loader2 className="size-6 animate-spin mx-auto" /> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50">
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Nombre</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Tipo</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Responsable</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Correo</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Contraseña</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Último Acceso</th>
                <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Acciones</th>
              </tr></thead>
              <tbody>
                {(departments || []).map(d => (
                  <tr key={d.id} className="border-t hover:bg-slate-50">
                    <td className="p-3 font-medium">{d.name}</td>
                    <td className="p-3">{d.type === 'DIRECCION_FUNCIONAL' ? <Badge variant="outline" className="bg-blue-50 text-blue-700">Dirección</Badge> : <Badge variant="outline" className="bg-slate-50 text-slate-600">UEB</Badge>}</td>
                    <td className="p-3">{d.responsibleName}</td>
                    <td className="p-3 text-muted-foreground">{d.email}</td>
                    <td className="p-3">{d.active ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Activo</Badge> : <Badge variant="outline" className="bg-red-50 text-red-700">Inactivo</Badge>}</td>
                    <td className="p-3">{d.hasPassword ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Sí</Badge> : <Badge variant="outline" className="bg-amber-50 text-amber-700">No</Badge>}</td>
                    <td className="p-3 text-xs text-muted-foreground">{d.lastLoginAt ? new Date(d.lastLoginAt).toLocaleString('es-CU') : 'Nunca'}</td>
                    <td className="p-3">
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled={resetMutation.isPending}
                        onClick={() => { if (confirm(`¿Restablecer contraseña de ${d.name}?`)) resetMutation.mutate(d.id) }}>
                        <KeyRound className="size-3 mr-1" /> Restablecer
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// REQUESTS TAB
// ============================================================================

function RequestsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-requests'],
    queryFn: async () => {
      const res = await fetch('/api/requests')
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
  })

  if (isLoading) return <Loader2 className="size-6 animate-spin mx-auto" />
  const requests: any[] = data || []

  const statusBadge = (s: string) => {
    const cfg: Record<string, string> = { SOLICITADO: 'bg-slate-50 text-slate-600', EN_FECHA: 'bg-amber-50 text-amber-700', CUMPLIDO: 'bg-emerald-50 text-emerald-700', INCUMPLIDO: 'bg-red-50 text-red-700' }
    return <Badge variant="outline" className={cfg[s] || ''}>{s}</Badge>
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">📋 Solicitudes de Información</h2>
      <div className="bg-white rounded-xl border overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="bg-slate-50">
            <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Descripción</th>
            <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Estado</th>
            <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Prioridad</th>
            <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Solicitante</th>
            <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Proveedor</th>
            <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Límite</th>
          </tr></thead>
          <tbody>
            {requests.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-slate-50">
                <td className="p-3 max-w-[200px] truncate">{r.description}</td>
                <td className="p-3">{statusBadge(r.status)}</td>
                <td className="p-3"><Badge variant="outline">{r.priority}</Badge></td>
                <td className="p-3">{r.requesterDept?.name}</td>
                <td className="p-3">{r.providerDept?.name}</td>
                <td className="p-3 text-xs">{new Date(r.deadlineDate).toLocaleDateString('es-CU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================================================
// EMAILS TAB - with real email logs
// ============================================================================

function EmailsTab() {
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [successFilter, setSuccessFilter] = useState('')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-email-logs', page, typeFilter, successFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set('page', page.toString())
      params.set('limit', '50')
      if (typeFilter) params.set('type', typeFilter)
      if (successFilter) params.set('success', successFilter)
      const res = await fetch(`/api/admin/email-logs?${params}`)
      if (!res.ok) throw new Error('Error cargando correos')
      return res.json() as Promise<{ logs: EmailLogData[]; total: number; page: number; totalPages: number }>
    },
  })

  const emailTypeBadge = (type: string) => {
    const cfg: Record<string, string> = {
      RECORDATORIO: 'bg-amber-50 text-amber-700',
      NOTIFICACION: 'bg-blue-50 text-blue-700',
      CONFIRMACION: 'bg-emerald-50 text-emerald-700',
      EN_FECHA: 'bg-orange-50 text-orange-700',
      INCUMPLIDO: 'bg-red-50 text-red-700',
      CREDENCIALES: 'bg-purple-50 text-purple-700',
    }
    return <Badge variant="outline" className={cfg[type] || 'bg-slate-50 text-slate-600'}>{type}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-xl font-bold">📧 Registro de Correos</h2>
        <div className="flex gap-2 items-center">
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
            className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">Todos los tipos</option>
            <option value="RECORDATORIO">Recordatorio</option>
            <option value="NOTIFICACION">Notificación</option>
            <option value="CONFIRMACION">Confirmación</option>
            <option value="EN_FECHA">En Fecha</option>
            <option value="INCUMPLIDO">Incumplido</option>
            <option value="CREDENCIALES">Credenciales</option>
          </select>
          <select value={successFilter} onChange={e => { setSuccessFilter(e.target.value); setPage(1) }}
            className="border rounded-md px-2 py-1.5 text-sm">
            <option value="">Todos</option>
            <option value="true">Exitosos</option>
            <option value="false">Fallidos</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="size-4 mr-1" /> Actualizar
          </Button>
        </div>
      </div>

      {isLoading ? <Loader2 className="size-6 animate-spin mx-auto" /> : (
        <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50">
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Fecha</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Tipo</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Destinatario</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Asunto</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Estado</th>
                  <th className="text-left p-3 font-semibold text-xs text-muted-foreground">Error</th>
                </tr></thead>
                <tbody>
                  {(data?.logs || []).map((log: EmailLogData) => (
                    <tr key={log.id} className={`border-t hover:bg-slate-50 ${!log.success ? 'bg-red-50/50' : ''}`}>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(log.sentAt).toLocaleString('es-CU')}</td>
                      <td className="p-3">{emailTypeBadge(log.emailType)}</td>
                      <td className="p-3 text-xs">{log.recipientEmail}</td>
                      <td className="p-3 max-w-[200px] truncate text-xs">{log.subject}</td>
                      <td className="p-3">
                        {log.success
                          ? <Badge variant="outline" className="bg-emerald-50 text-emerald-700"><CheckCircle2 className="size-3 mr-1" />OK</Badge>
                          : <Badge variant="outline" className="bg-red-50 text-red-700"><XCircle className="size-3 mr-1" />Falló</Badge>
                        }
                      </td>
                      <td className="p-3 text-xs text-red-600 max-w-[200px] truncate">{log.error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {data.total} correos en total - Página {data.page} de {data.totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ============================================================================
// AFFECTATIONS TAB
// ============================================================================

function AffectationsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-affectations'],
    queryFn: async () => {
      const res = await fetch('/api/reports/affectation')
      if (!res.ok) throw new Error('Error')
      return res.json()
    },
  })

  if (isLoading) return <Loader2 className="size-6 animate-spin mx-auto" />
  const affectData: any = data

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">⚠️ Registro de Afectaciones</h2>
      {affectData?.departments?.length > 0 ? (
        affectData.departments.map((dept: any) => (
          <Card key={dept.departmentId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{dept.departmentName} ({dept.departmentType})</span>
                <span className="text-xs font-normal text-muted-foreground">Afectación acumulada: <strong className={dept.totalAffectation >= 3 ? 'text-red-600' : 'text-amber-600'}>{dept.totalAffectation.toFixed(1)}</strong></span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {dept.records?.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{r.requestDescription}</p>
                    <p className="text-xs text-muted-foreground">Solicitado por {r.requesterDeptName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{r.affectationValue.toFixed(1)}</p>
                    <Badge variant="outline" className={r.reviewStatus === 'RESUELTO' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>{r.reviewStatus}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      ) : <p className="text-sm text-muted-foreground text-center py-8">No hay afectaciones registradas</p>}
    </div>
  )
}

// ============================================================================
// SMTP DIAGNOSTICS TAB
// ============================================================================

function SmtpTab() {
  const [testResult, setTestResult] = useState<SmtpTestResult | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testEmail, setTestEmail] = useState('larquin@camaguey.geocuba.cu')
  const [sendingTest, setSendingTest] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null)

  const runTest = async () => {
    setIsTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/admin/test-smtp')
      const data = await res.json() as SmtpTestResult
      setTestResult(data)
      if (data.connected) {
        toast.success('Conexión SMTP exitosa')
      } else {
        toast.error(`Conexión SMTP fallida: ${data.error}`)
      }
    } catch (err) {
      setTestResult({
        connected: false,
        authenticated: false,
        error: err instanceof Error ? err.message : 'Error desconocido',
      })
      toast.error('Error al probar conexión SMTP')
    } finally {
      setIsTesting(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testEmail.trim()) {
      toast.error('Ingrese un correo de destino')
      return
    }
    setSendingTest(true)
    setTestEmailResult(null)
    try {
      const res = await fetch('/api/email/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: 'test',
          message: 'Este es un correo de prueba del sistema GEOCUBA SCEI',
        }),
      })
      const data = await res.json()
      if (res.ok && !data.error) {
        setTestEmailResult({ success: true, message: `Correo enviado exitosamente a ${testEmail}` })
        toast.success('Correo de prueba enviado')
      } else {
        setTestEmailResult({ success: false, message: data.error || data.message || 'Error al enviar' })
        toast.error('Error al enviar correo de prueba')
      }
    } catch (err) {
      setTestEmailResult({ success: false, message: err instanceof Error ? err.message : 'Error desconocido' })
      toast.error('Error al enviar correo de prueba')
    } finally {
      setSendingTest(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">⚙️ Configuración SMTP</h2>

      {/* Connection Test */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Server className="size-4 text-blue-600" />
            Prueba de Conexión SMTP
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <p className="text-sm text-muted-foreground">
            Verifique la conexión con el servidor de correo GEOCUBA (Exchange).
          </p>
          <Button onClick={runTest} disabled={isTesting} className="bg-blue-700 hover:bg-blue-800">
            {isTesting ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Wifi className="size-4 mr-1" />}
            {isTesting ? 'Probando...' : 'Probar Conexión'}
          </Button>

          {testResult && (
            <div className={`p-4 rounded-lg border ${testResult.connected ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-3">
                {testResult.connected ? (
                  <Wifi className="size-5 text-emerald-600" />
                ) : (
                  <WifiOff className="size-5 text-red-600" />
                )}
                <span className={`font-semibold ${testResult.connected ? 'text-emerald-700' : 'text-red-700'}`}>
                  {testResult.connected ? 'Conexión Exitosa' : 'Conexión Fallida'}
                </span>
              </div>

              {testResult.details && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Servidor</p>
                    <p className="font-medium">{testResult.details.host}:{testResult.details.port}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">SSL/TLS</p>
                    <p className="font-medium">{testResult.details.secure ? 'Sí' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Autenticación</p>
                    <p className="font-medium">{testResult.details.hasAuth ? `Sí (${testResult.details.authUser})` : 'No'}</p>
                  </div>
                </div>
              )}

              {testResult.error && (
                <div className="mt-3 p-3 bg-red-100 rounded text-sm">
                  <p className="font-medium text-red-700">Error:</p>
                  <p className="text-red-600 text-xs mt-1 break-all">{testResult.error}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Settings className="size-4 text-slate-600" />
            Configuración Actual
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Servidor SMTP</p>
              <p className="font-medium">192.168.7.4:25</p>
              <p className="text-xs text-muted-foreground mt-1">Exchange Server GEOCUBA</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Cuenta de Envío</p>
              <p className="font-medium">larquin@camaguey.geocuba.cu</p>
              <p className="text-xs text-muted-foreground mt-1">Autenticación con contraseña</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-muted-foreground">SSL/TLS</p>
              <p className="font-medium">Desactivado (Puerto 25)</p>
              <p className="text-xs text-muted-foreground mt-1">STARTTLS automático</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-muted-foreground">Certificados</p>
              <p className="font-medium">Auto-firmados permitidos</p>
              <p className="text-xs text-muted-foreground mt-1">rejectUnauthorized: false</p>
            </div>
          </div>

          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-medium text-amber-700">📌 Nota importante:</p>
            <p className="text-xs text-amber-600 mt-1">
              Si la conexión falla, verifique que: (1) El servidor SMTP 192.168.7.4 esté accesible desde esta red,
              (2) El puerto 25 no esté bloqueado por firewall, (3) Las credenciales sean correctas,
              (4) El servidor Exchange permita relay para esta cuenta.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent Email Errors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" />
            Últimos Errores de Envío
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <RecentEmailErrors />
        </CardContent>
      </Card>
    </div>
  )
}

function RecentEmailErrors() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-email-errors'],
    queryFn: async () => {
      const res = await fetch('/api/admin/email-logs?success=false&limit=10')
      if (!res.ok) throw new Error('Error')
      return res.json() as Promise<{ logs: EmailLogData[]; total: number }>
    },
  })

  if (isLoading) return <Loader2 className="size-5 animate-spin" />

  const logs = data?.logs || []

  if (logs.length === 0) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No hay errores de envío registrados</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {logs.map(log => (
        <div key={log.id} className="p-2.5 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-red-700">{log.recipientEmail}</span>
            <span className="text-[10px] text-muted-foreground">{new Date(log.sentAt).toLocaleString('es-CU')}</span>
          </div>
          <p className="text-xs text-red-600 break-all">{log.error || 'Sin detalles del error'}</p>
          <p className="text-[10px] text-muted-foreground mt-1 truncate">{log.subject}</p>
        </div>
      ))}
      {data && data.total > 10 && (
        <p className="text-xs text-muted-foreground text-center">
          Mostrando 10 de {data.total} errores. Vea la pestaña "Correos" para más detalles.
        </p>
      )}
    </div>
  )
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function MetricCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-700', green: 'text-emerald-700', red: 'text-red-700', amber: 'text-amber-700', slate: 'text-slate-600'
  }
  return (
    <Card className="py-3 gap-1">
      <CardContent className="p-3 text-center pt-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className={`text-2xl font-bold ${colorMap[color] || 'text-blue-700'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
