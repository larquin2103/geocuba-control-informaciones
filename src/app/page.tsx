'use client'

import React, { useEffect, useCallback, useState, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { create } from 'zustand'
import { format, formatDistanceToNow, isPast, isWithinInterval, addDays, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  LayoutDashboard, FilePlus, ListChecks, BarChart3, Phone,
  ChevronRight, AlertTriangle, CheckCircle2, Clock, XCircle,
  Send, Bell, Search, Filter, Building2, Mail, User,
  CalendarIcon, ArrowRight, TrendingUp, Activity, Loader2,
  RefreshCw, ChevronDown, ChevronUp, AlertCircle, Users,
  FileText, MapPin, PhoneCall, Shield, Eye, Info, Download
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useIsMobile } from '@/hooks/use-mobile'

// Lazy load heavy components
const ComplianceChart = dynamic(() => import('@/components/compliance-chart'), {
  loading: () => <Skeleton className="h-72 rounded-xl" />,
  ssr: false,
})

const MobileTabIndicator = dynamic(() => import('@/components/mobile-tab-indicator'), {
  ssr: false,
})

// ============================================================================
// TYPES
// ============================================================================

interface Department {
  id: string
  name: string
  type: string
  responsibleName: string
  responsibleRole: string
  email: string
  phone: string | null
  active: boolean
}

interface InformationRequest {
  id: string
  description: string
  deadlineDate: string
  status: 'SOLICITADO' | 'EN_FECHA' | 'CUMPLIDO' | 'INCUMPLIDO'
  completedAt: string | null
  completedNotes: string | null
  priority: 'ALTA' | 'NORMAL' | 'BAJA'
  createdAt: string
  requesterDeptId: string
  providerDeptId: string
  requesterDept: { id: string; name: string; type: string }
  providerDept: { id: string; name: string; type: string }
}

interface StatsData {
  total: number
  cumplidas: number
  enFecha: number
  incumplidas: number
  solicitadas: number
  tasaCumplimiento: number
  complianceByDept: {
    name: string
    type: string
    total: number
    completed: number
    uncompleted: number
    rate: number
  }[]
  upcomingDeadlines: (InformationRequest & { daysUntilDeadline: number })[]
  recentActivity: {
    id: string
    fromStatus: string | null
    toStatus: string
    changedAt: string
    notes: string | null
    request: {
      description: string
      requesterDept: { name: string }
      providerDept: { name: string }
    }
  }[]
}

interface ComplianceData {
  summary: { total: number; completed: number; incumplidas: number; rate: number }
  departments: {
    id: string
    name: string
    type: string
    asProvider: { total: number; completed: number; incumplidas: number; enFecha: number; solicitadas: number; rate: number }
    asRequester: { total: number }
  }[]
  matrix: Record<string, Record<string, { total: number; completed: number }>>
}

interface AffectationData {
  summary: { totalRecords: number; departmentsAffected: number; departmentsForReview: number }
  departments: {
    departmentId: string
    departmentName: string
    departmentType: string
    responsibleName: string
    totalAffectation: number
    requiresCommissionReview: boolean
    records: {
      id: string
      requestDescription: string
      requesterDeptName: string
      deadlineDate: string
      affectationValue: number
      cumulativeAffectation: number
      detectedAt: string
    }[]
  }[]
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

type TabId = 'dashboard' | 'nueva' | 'solicitudes' | 'reportes' | 'directorio'

interface AppState {
  activeTab: TabId
  setActiveTab: (tab: TabId) => void
  statusFilter: string
  setStatusFilter: (f: string) => void
  deptFilter: string
  setDeptFilter: (f: string) => void
  searchQuery: string
  setSearchQuery: (q: string) => void
  reportSubTab: 'compliance' | 'affectation'
  setReportSubTab: (t: 'compliance' | 'affectation') => void
  expandedRequestId: string | null
  setExpandedRequestId: (id: string | null) => void
  seeded: boolean
  setSeeded: (s: boolean) => void
}

const useAppStore = create<AppState>((set) => ({
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  statusFilter: 'TODOS',
  setStatusFilter: (f) => set({ statusFilter: f }),
  deptFilter: 'TODOS',
  setDeptFilter: (f) => set({ deptFilter: f }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),
  reportSubTab: 'compliance',
  setReportSubTab: (t) => set({ reportSubTab: t }),
  expandedRequestId: null,
  setExpandedRequestId: (id) => set({ expandedRequestId: id }),
  seeded: false,
  setSeeded: (s) => set({ seeded: s }),
}))

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: React.ElementType }> = {
  SOLICITADO: { label: 'Solicitado', color: 'text-slate-600', bgColor: 'bg-slate-100', icon: Clock },
  EN_FECHA: { label: 'En Fecha', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: AlertTriangle },
  CUMPLIDO: { label: 'Cumplido', color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: CheckCircle2 },
  INCUMPLIDO: { label: 'Incumplido', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
}

const priorityConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  ALTA: { label: 'Alta', color: 'text-red-700', bgColor: 'bg-red-100' },
  NORMAL: { label: 'Normal', color: 'text-slate-600', bgColor: 'bg-slate-100' },
  BAJA: { label: 'Baja', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
}

function getDeadlineColor(deadlineDate: string): string {
  const deadline = new Date(deadlineDate)
  const now = new Date()
  if (isPast(deadline)) return 'text-red-600'
  const daysLeft = differenceInDays(deadline, now)
  if (daysLeft <= 3) return 'text-amber-600'
  return 'text-emerald-600'
}

function getDeadlineBg(deadlineDate: string): string {
  const deadline = new Date(deadlineDate)
  const now = new Date()
  if (isPast(deadline)) return 'bg-red-50'
  const daysLeft = differenceInDays(deadline, now)
  if (daysLeft <= 3) return 'bg-amber-50'
  return 'bg-emerald-50'
}

function formatDate(date: string | Date): string {
  return format(new Date(date), "d 'de' MMM, yyyy", { locale: es })
}

function formatDateShort(date: string | Date): string {
  return format(new Date(date), 'dd/MM/yyyy', { locale: es })
}

function formatRelative(date: string | Date): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

// ============================================================================
// CSS TRANSITION HELPERS (replacing framer-motion)
// ============================================================================

/** Collapsible section using CSS max-height transition */
function CollapsibleSection({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity] duration-200 ease-in-out ${
        show ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      {children}
    </div>
  )
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await fetch('/api/departments')
      if (!res.ok) throw new Error('Error cargando departamentos')
      return res.json() as Promise<Department[]>
    },
  })
}

function useRequests() {
  const { statusFilter, deptFilter, searchQuery } = useAppStore()
  return useQuery({
    queryKey: ['requests', statusFilter, deptFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'TODOS') params.set('status', statusFilter)
      if (deptFilter && deptFilter !== 'TODOS') params.set('departmentId', deptFilter)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/requests?${params.toString()}`)
      if (!res.ok) throw new Error('Error cargando solicitudes')
      return res.json() as Promise<InformationRequest[]>
    },
  })
}

function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Error cargando estadísticas')
      return res.json() as Promise<StatsData>
    },
  })
}

function useComplianceReport() {
  return useQuery({
    queryKey: ['compliance-report'],
    queryFn: async () => {
      const res = await fetch('/api/reports/compliance')
      if (!res.ok) throw new Error('Error cargando reporte de cumplimiento')
      return res.json() as Promise<ComplianceData>
    },
  })
}

function useAffectationReport() {
  return useQuery({
    queryKey: ['affectation-report'],
    queryFn: async () => {
      const res = await fetch('/api/reports/affectation')
      if (!res.ok) throw new Error('Error cargando reporte de afectación')
      return res.json() as Promise<AffectationData>
    },
  })
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status]
  if (!config) return null
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 gap-1 text-xs`}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = priorityConfig[priority]
  if (!config) return null
  return (
    <Badge variant="outline" className={`${config.bgColor} ${config.color} border-0 text-xs`}>
      {config.label}
    </Badge>
  )
}

// ============================================================================
// LOADING SKELETONS
// ============================================================================

function DashboardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}

function RequestsSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  )
}

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

function MetricCard({ title, value, icon: Icon, color, bgColor, subtitle }: {
  title: string
  value: number | string
  icon: React.ElementType
  color: string
  bgColor: string
  subtitle?: string
}) {
  return (
    <Card className="py-3 gap-2">
      <CardContent className="p-4 pt-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`${bgColor} p-2.5 rounded-xl`}>
            <Icon className={`size-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// DASHBOARD TAB
// ============================================================================

function DashboardTab() {
  const { data: stats, isLoading, refetch } = useStats()
  const queryClient = useQueryClient()

  const updateStatuses = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/requests/update-statuses', { method: 'POST' })
      if (!res.ok) throw new Error('Error actualizando estados')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`${data.updatedCount || 0} estados actualizados`)
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['requests'] })
    },
    onError: () => {
      toast.error('Error al actualizar estados')
    },
  })

  if (isLoading) return <DashboardSkeleton />

  if (!stats) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="size-12 text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No se pudieron cargar las estadísticas</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
          <RefreshCw className="size-4 mr-1" /> Reintentar
        </Button>
      </div>
    )
  }

  const chartData = stats.complianceByDept.map(d => ({
    name: d.name.length > 15 ? d.name.substring(0, 15) + '…' : d.name,
    fullName: d.name,
    cumplimiento: d.rate,
    incumplimiento: 100 - d.rate,
  }))

  return (
    <div className="space-y-4 p-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Panel de Control</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => updateStatuses.mutate()}
          disabled={updateStatuses.isPending}
        >
          {updateStatuses.isPending ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="size-4 mr-1" />
          )}
          Actualizar
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard
          title="Total Solicitudes"
          value={stats.total}
          icon={FileText}
          color="text-blue-700"
          bgColor="bg-blue-100"
        />
        <MetricCard
          title="Cumplidas"
          value={stats.cumplidas}
          icon={CheckCircle2}
          color="text-emerald-700"
          bgColor="bg-emerald-100"
        />
        <MetricCard
          title="En Fecha"
          value={stats.enFecha}
          icon={Clock}
          color="text-amber-700"
          bgColor="bg-amber-100"
        />
        <MetricCard
          title="Incumplidas"
          value={stats.incumplidas}
          icon={XCircle}
          color="text-red-700"
          bgColor="bg-red-100"
        />
        <MetricCard
          title="Tasa Cumplimiento"
          value={`${stats.tasaCumplimiento}%`}
          icon={TrendingUp}
          color="text-blue-700"
          bgColor="bg-blue-100"
          subtitle={`${stats.cumplidas} de ${stats.total}`}
        />
      </div>

      {/* Compliance Chart - lazy loaded */}
      {chartData.length > 0 && <ComplianceChart data={chartData} />}

      {/* Upcoming Deadlines */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            Plazos Próximos (7 días)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {stats.upcomingDeadlines.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle2 className="size-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No hay plazos próximos</p>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {stats.upcomingDeadlines.map((req) => {
                  const deadline = new Date(req.deadlineDate)
                  const daysLeft = differenceInDays(deadline, new Date())
                  return (
                    <div key={req.id} className={`flex items-start gap-3 p-3 rounded-lg ${getDeadlineBg(req.deadlineDate)}`}>
                      <div className={`text-center min-w-[3rem] ${getDeadlineColor(req.deadlineDate)}`}>
                        <p className="text-lg font-bold leading-none">{daysLeft}</p>
                        <p className="text-[10px] mt-0.5">días</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{req.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {req.providerDept.name} → {req.requesterDept.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(req.deadlineDate)}</p>
                      </div>
                      <PriorityBadge priority={req.priority} />
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="size-4 text-blue-500" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {stats.recentActivity.length === 0 ? (
            <div className="text-center py-6">
              <Clock className="size-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
            </div>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {stats.recentActivity.map((activity) => {
                  const config = statusConfig[activity.toStatus]
                  const ActIcon = config?.icon || Activity
                  return (
                    <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className={`p-1.5 rounded-full ${config?.bgColor || 'bg-slate-100'}`}>
                        <ActIcon className={`size-3.5 ${config?.color || 'text-slate-500'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{activity.request.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {activity.request.providerDept.name} → {activity.requesterDept ? activity.request.requesterDept.name : ''}
                        </p>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatRelative(activity.changedAt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// NEW REQUEST TAB
// ============================================================================

function NuevaSolicitudTab() {
  const { data: departments } = useDepartments()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    requesterDeptId: '',
    providerDeptIds: [] as string[],
    description: '',
    deadlineDate: undefined as Date | undefined,
    priority: 'NORMAL' as string,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [calendarOpen, setCalendarOpen] = useState(false)

  const direcciones = (departments || []).filter(d => d.type === 'DIRECCION_FUNCIONAL')
  const uebs = (departments || []).filter(d => d.type === 'UEB')

  // Available providers (excluding the requester)
  const availableSuperior = direcciones.filter(d => (d.name === 'Director General' || d.name === 'Coordinador General') && d.id !== form.requesterDeptId)
  const availableDirecciones = direcciones.filter(d => d.name !== 'Director General' && d.name !== 'Coordinador General' && d.id !== form.requesterDeptId)
  const availableUebs = uebs.filter(d => d.id !== form.requesterDeptId)

  // Toggle a provider in the selection
  const toggleProvider = (deptId: string) => {
    setForm(f => ({
      ...f,
      providerDeptIds: f.providerDeptIds.includes(deptId)
        ? f.providerDeptIds.filter(id => id !== deptId)
        : [...f.providerDeptIds, deptId],
    }))
    // Clear error when selecting
    if (errors.providerDeptIds) {
      setErrors(e => ({ ...e, providerDeptIds: '' }))
    }
  }

  // Select/deselect all in a group
  const toggleAllInGroup = (groupDepts: Department[], selectAll: boolean) => {
    const groupIds = groupDepts.map(d => d.id)
    setForm(f => {
      if (selectAll) {
        // Add all from group that aren't already selected
        const newIds = [...new Set([...f.providerDeptIds, ...groupIds])]
        return { ...f, providerDeptIds: newIds }
      } else {
        // Remove all from group
        return { ...f, providerDeptIds: f.providerDeptIds.filter(id => !groupIds.includes(id)) }
      }
    })
  }

  // Check if all in a group are selected
  const isGroupAllSelected = (groupDepts: Department[]) => {
    const groupIds = groupDepts.map(d => d.id)
    return groupIds.length > 0 && groupIds.every(id => form.providerDeptIds.includes(id))
  }

  const createRequest = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterDeptId: data.requesterDeptId,
          providerDeptIds: data.providerDeptIds,
          description: data.description,
          deadlineDate: data.deadlineDate?.toISOString(),
          priority: data.priority,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al crear solicitud')
      }
      return res.json()
    },
    onSuccess: (data) => {
      const count = data.created || 1
      toast.success(`${count} solicitud${count > 1 ? 'es creadas' : ' creada'} exitosamente`)
      setForm({
        requesterDeptId: '',
        providerDeptIds: [],
        description: '',
        deadlineDate: undefined,
        priority: 'NORMAL',
      })
      setErrors({})
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => {
      toast.error(error.message)
    },
  })

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!form.requesterDeptId) newErrors.requesterDeptId = 'Seleccione una dirección solicitante'
    if (form.providerDeptIds.length === 0) newErrors.providerDeptIds = 'Seleccione al menos una dirección proveedora'
    if (!form.description.trim()) newErrors.description = 'Ingrese una descripción'
    if (!form.deadlineDate) newErrors.deadlineDate = 'Seleccione una fecha límite'
    if (!form.priority) newErrors.priority = 'Seleccione una prioridad'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    createRequest.mutate(form)
  }

  // Get selected provider names for display
  const selectedProviderNames = form.providerDeptIds
    .map(id => departments?.find(d => d.id === id)?.name)
    .filter(Boolean) as string[]

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Nueva Solicitud</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Departamento Solicitante */}
        <div className="space-y-2">
          <Label htmlFor="requester" className="text-sm font-medium">
            Dirección Solicitante *
          </Label>
          <Select value={form.requesterDeptId} onValueChange={(v) => {
            setForm(f => ({
              ...f,
              requesterDeptId: v,
              // Remove the newly selected requester from providers if it was there
              providerDeptIds: f.providerDeptIds.filter(id => id !== v),
            }))
          }}>
            <SelectTrigger className={`w-full ${errors.requesterDeptId ? 'border-red-400' : ''}`}>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Dirección Superior</SelectLabel>
                {direcciones.filter(d => d.name === 'Director General' || d.name === 'Coordinador General').map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Direcciones Funcionales</SelectLabel>
                {direcciones.filter(d => d.name !== 'Director General' && d.name !== 'Coordinador General').map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>UEB</SelectLabel>
                {uebs.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {errors.requesterDeptId && <p className="text-xs text-red-500">{errors.requesterDeptId}</p>}
        </div>

        {/* Departamentos Proveedores (Multi-select) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Direcciones Proveedores *
            </Label>
            {form.providerDeptIds.length > 0 && (
              <span className="text-xs text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
                {form.providerDeptIds.length} seleccionado{form.providerDeptIds.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <Card className={`py-0 ${errors.providerDeptIds ? 'border-red-400' : ''}`}>
            <CardContent className="p-0">
              {!form.requesterDeptId ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  <Users className="size-5 mx-auto mb-1 opacity-50" />
                  Seleccione primero una dirección solicitante
                </div>
              ) : (
                <div className="divide-y">
                  {/* Dirección Superior Group */}
                  {availableSuperior.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Shield className="size-3" />
                          Dirección Superior
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-blue-700 hover:text-blue-800"
                          onClick={() => toggleAllInGroup(availableSuperior, !isGroupAllSelected(availableSuperior))}
                        >
                          {isGroupAllSelected(availableSuperior) ? 'Ninguno' : 'Todos'}
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {availableSuperior.map(d => (
                          <label
                            key={d.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                              form.providerDeptIds.includes(d.id) ? 'bg-blue-50' : 'hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              checked={form.providerDeptIds.includes(d.id)}
                              onCheckedChange={() => toggleProvider(d.id)}
                              className="data-[state=checked]:bg-blue-700 data-[state=checked]:border-blue-700"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{d.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{d.responsibleName} · {d.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Direcciones Funcionales Group */}
                  {availableDirecciones.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <Shield className="size-3" />
                          Direcciones Funcionales
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-blue-700 hover:text-blue-800"
                          onClick={() => toggleAllInGroup(availableDirecciones, !isGroupAllSelected(availableDirecciones))}
                        >
                          {isGroupAllSelected(availableDirecciones) ? 'Ninguno' : 'Todos'}
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {availableDirecciones.map(d => (
                          <label
                            key={d.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                              form.providerDeptIds.includes(d.id) ? 'bg-blue-50' : 'hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              checked={form.providerDeptIds.includes(d.id)}
                              onCheckedChange={() => toggleProvider(d.id)}
                              className="data-[state=checked]:bg-blue-700 data-[state=checked]:border-blue-700"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{d.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{d.responsibleName} · {d.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* UEB Group */}
                  {availableUebs.length > 0 && (
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                          <MapPin className="size-3" />
                          Unidades Empresariales de Base
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] px-2 text-blue-700 hover:text-blue-800"
                          onClick={() => toggleAllInGroup(availableUebs, !isGroupAllSelected(availableUebs))}
                        >
                          {isGroupAllSelected(availableUebs) ? 'Ninguno' : 'Todos'}
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        {availableUebs.map(d => (
                          <label
                            key={d.id}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                              form.providerDeptIds.includes(d.id) ? 'bg-blue-50' : 'hover:bg-muted/50'
                            }`}
                          >
                            <Checkbox
                              checked={form.providerDeptIds.includes(d.id)}
                              onCheckedChange={() => toggleProvider(d.id)}
                              className="data-[state=checked]:bg-blue-700 data-[state=checked]:border-blue-700"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{d.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{d.responsibleName} · {d.email}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected providers as badges */}
          {selectedProviderNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedProviderNames.map((name, idx) => (
                <Badge key={idx} variant="secondary" className="text-[11px] bg-blue-50 text-blue-800 hover:bg-blue-100 gap-1 pr-1">
                  {name}
                  <button
                    type="button"
                    onClick={() => {
                      const deptId = form.providerDeptIds[idx]
                      if (deptId) toggleProvider(deptId)
                    }}
                    className="ml-0.5 rounded-full hover:bg-blue-200 p-0.5 transition-colors"
                  >
                    <XCircle className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {errors.providerDeptIds && <p className="text-xs text-red-500">{errors.providerDeptIds}</p>}
        </div>

        {/* Descripción */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            Descripción de la Información *
          </Label>
          <Textarea
            id="description"
            placeholder="Describa la información que se solicita..."
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
            className={`min-h-[100px] ${errors.description ? 'border-red-400' : ''}`}
          />
          {errors.description && <p className="text-xs text-red-500">{errors.description}</p>}
        </div>

        {/* Fecha Límite */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Fecha Límite de Entrega *</Label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={`w-full justify-start text-left font-normal ${!form.deadlineDate ? 'text-muted-foreground' : ''} ${errors.deadlineDate ? 'border-red-400' : ''}`}
              >
                <CalendarIcon className="size-4 mr-2" />
                {form.deadlineDate ? formatDate(form.deadlineDate) : 'Seleccionar fecha...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={form.deadlineDate}
                onSelect={(date) => {
                  setForm(f => ({ ...f, deadlineDate: date || undefined }))
                  setCalendarOpen(false)
                }}
                disabled={{ before: new Date() }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          {errors.deadlineDate && <p className="text-xs text-red-500">{errors.deadlineDate}</p>}
        </div>

        {/* Prioridad */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Prioridad *</Label>
          <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
            <SelectTrigger className={`w-full ${errors.priority ? 'border-red-400' : ''}`}>
              <SelectValue placeholder="Seleccionar..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALTA">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-red-500" /> Alta</span>
              </SelectItem>
              <SelectItem value="NORMAL">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-slate-400" /> Normal</span>
              </SelectItem>
              <SelectItem value="BAJA">
                <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> Baja</span>
              </SelectItem>
            </SelectContent>
          </Select>
          {errors.priority && <p className="text-xs text-red-500">{errors.priority}</p>}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          className="w-full bg-blue-700 hover:bg-blue-800 text-white"
          disabled={createRequest.isPending}
        >
          {createRequest.isPending ? (
            <>
              <Loader2 className="size-4 mr-2 animate-spin" />
              Creando {form.providerDeptIds.length > 1 ? `${form.providerDeptIds.length} solicitudes...` : '...'}
            </>
          ) : (
            <>
              <Send className="size-4 mr-2" />
              {form.providerDeptIds.length > 1
                ? `Crear ${form.providerDeptIds.length} Solicitudes`
                : 'Crear Solicitud'}
            </>
          )}
        </Button>
      </form>
    </div>
  )
}

// ============================================================================
// REQUESTS LIST TAB
// ============================================================================

function SolicitudesTab() {
  const { data: requests, isLoading } = useRequests()
  const { data: departments } = useDepartments()
  const { statusFilter, setStatusFilter, deptFilter, setDeptFilter, searchQuery, setSearchQuery, expandedRequestId, setExpandedRequestId } = useAppStore()
  const queryClient = useQueryClient()

  const completeRequest = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const res = await fetch(`/api/requests/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      })
      if (!res.ok) throw new Error('Error al completar solicitud')
      return res.json()
    },
    onSuccess: () => {
      toast.success('Solicitud marcada como cumplida')
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: () => {
      toast.error('Error al completar solicitud')
    },
  })

  const sendReminder = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await fetch('/api/email/remind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      })
      if (!res.ok) throw new Error('Error al enviar recordatorio')
      return res.json()
    },
    onSuccess: (data) => {
      toast.success(`Recordatorio enviado a ${data.recipient}`)
    },
    onError: () => {
      toast.error('Error al enviar recordatorio')
    },
  })

  const handleComplete = (id: string) => {
    completeRequest.mutate({ id, notes: 'Completada desde el sistema' })
  }

  if (isLoading) return <RequestsSkeleton />

  const direcciones = (departments || []).filter(d => d.type === 'DIRECCION_FUNCIONAL')
  const uebs = (departments || []).filter(d => d.type === 'UEB')

  return (
    <div className="space-y-3 p-4">
      <h2 className="text-lg font-semibold">Solicitudes</h2>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por descripción..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="size-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="SOLICITADO">Solicitado</SelectItem>
            <SelectItem value="EN_FECHA">En Fecha</SelectItem>
            <SelectItem value="CUMPLIDO">Cumplido</SelectItem>
            <SelectItem value="INCUMPLIDO">Incumplido</SelectItem>
          </SelectContent>
        </Select>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-[160px]">
            <Building2 className="size-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectGroup>
              <SelectLabel>Direcciones</SelectLabel>
              {direcciones.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>UEB</SelectLabel>
              {uebs.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {/* Request Cards - using CSS transitions instead of framer-motion */}
      {!requests || requests.length === 0 ? (
        <div className="text-center py-12">
          <ListChecks className="size-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No se encontraron solicitudes</p>
          <p className="text-xs text-muted-foreground mt-1">Intente ajustar los filtros o cree una nueva solicitud</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const isExpanded = expandedRequestId === req.id
            const deadline = new Date(req.deadlineDate)
            const isOverdue = isPast(deadline) && req.status !== 'CUMPLIDO'
            const daysLeft = differenceInDays(deadline, new Date())

            return (
              <div
                key={req.id}
                className="animate-in fade-in slide-in-from-bottom-2 duration-200"
              >
                <Card className={`py-3 gap-2 overflow-hidden ${isOverdue ? 'border-red-200' : ''}`}>
                  <CardContent className="p-4 pt-0">
                    {/* Header Row */}
                    <div
                      className="flex items-start justify-between gap-2 cursor-pointer"
                      onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{req.description}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                          <span className="truncate max-w-[120px]">{req.requesterDept.name}</span>
                          <ArrowRight className="size-3 flex-shrink-0" />
                          <span className="truncate max-w-[120px]">{req.providerDept.name}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <StatusBadge status={req.status} />
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Bottom Row */}
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={req.priority} />
                        <span className={`text-xs font-medium ${getDeadlineColor(req.deadlineDate)}`}>
                          {isOverdue ? `Vencida hace ${Math.abs(daysLeft)}d` : daysLeft === 0 ? 'Vence hoy' : `${daysLeft}d restantes`}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{formatDateShort(req.deadlineDate)}</span>
                    </div>

                    {/* Expanded Details - CSS transition instead of AnimatePresence */}
                    <CollapsibleSection show={isExpanded}>
                      <Separator className="my-3" />
                      <div className="space-y-2.5 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Solicitante</p>
                            <p className="font-medium text-xs">{req.requesterDept.name}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Proveedor</p>
                            <p className="font-medium text-xs">{req.providerDept.name}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">Fecha Límite</p>
                            <p className="font-medium text-xs">{formatDate(req.deadlineDate)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Creada</p>
                            <p className="font-medium text-xs">{formatRelative(req.createdAt)}</p>
                          </div>
                        </div>
                        {req.completedAt && (
                          <div>
                            <p className="text-xs text-muted-foreground">Completada</p>
                            <p className="font-medium text-xs">{formatDate(req.completedAt)}</p>
                          </div>
                        )}
                        {req.completedNotes && (
                          <div>
                            <p className="text-xs text-muted-foreground">Notas</p>
                            <p className="text-xs">{req.completedNotes}</p>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          {req.status !== 'CUMPLIDO' && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                              onClick={() => handleComplete(req.id)}
                              disabled={completeRequest.isPending}
                            >
                              <CheckCircle2 className="size-3.5 mr-1" />
                              Marcar Cumplida
                            </Button>
                          )}
                          {req.status !== 'CUMPLIDO' && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-8"
                              onClick={() => sendReminder.mutate(req.id)}
                              disabled={sendReminder.isPending}
                            >
                              <Bell className="size-3.5 mr-1" />
                              Recordar
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleSection>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// REPORTS TAB
// ============================================================================

function ReportesTab() {
  const { reportSubTab, setReportSubTab } = useAppStore()

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Reportes</h2>

      {/* Sub-tab selector */}
      <div className="flex gap-2 bg-muted p-1 rounded-lg">
        <button
          onClick={() => setReportSubTab('compliance')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
            reportSubTab === 'compliance'
              ? 'bg-background shadow-sm text-blue-700'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="size-3.5 inline mr-1.5" />
          Cumplimiento
        </button>
        <button
          onClick={() => setReportSubTab('affectation')}
          className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
            reportSubTab === 'affectation'
              ? 'bg-background shadow-sm text-blue-700'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertTriangle className="size-3.5 inline mr-1.5" />
          Afectación
        </button>
      </div>

      {reportSubTab === 'compliance' ? <ComplianceReport /> : <AffectationReport />}
    </div>
  )
}

function ComplianceReport() {
  const { data, isLoading } = useComplianceReport()
  const [exporting, setExporting] = useState(false)

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/reports/export/compliance')
      if (!res.ok) throw new Error('Error al generar reporte')
      const html = await res.text()
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 500)
        toast.success('Reporte abierto para impresión/PDF')
      } else {
        toast.error('Permita las ventanas emergentes para exportar')
      }
    } catch {
      toast.error('Error al exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <DashboardSkeleton />

  if (!data) return <EmptyReport message="No se pudo cargar el reporte de cumplimiento" />

  return (
    <div className="space-y-4">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Resumen General</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting}
          className="text-blue-700 border-blue-200 hover:bg-blue-50"
        >
          {exporting ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="size-4 mr-1.5" />
          )}
          Exportar PDF
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard title="Total" value={data.summary.total} icon={FileText} color="text-blue-700" bgColor="bg-blue-100" />
        <MetricCard title="Cumplidas" value={data.summary.completed} icon={CheckCircle2} color="text-emerald-700" bgColor="bg-emerald-100" />
        <MetricCard title="Incumplidas" value={data.summary.incumplidas} icon={XCircle} color="text-red-700" bgColor="bg-red-100" />
        <MetricCard title="Tasa" value={`${data.summary.rate}%`} icon={TrendingUp} color="text-blue-700" bgColor="bg-blue-100" />
      </div>

      {/* Department Cards */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Cumplimiento por Dirección (Proveedor)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {data.departments.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">Sin datos de cumplimiento</p>
            </div>
          ) : (
            <ScrollArea className="max-h-96">
              <div className="space-y-3">
                {data.departments.map((dept) => (
                  <div key={dept.id} className="p-3 rounded-lg border bg-card">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium">{dept.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {dept.type === 'DIRECCION_FUNCIONAL' ? 'Dirección Funcional' : 'UEB'}
                        </p>
                      </div>
                      <span className={`text-lg font-bold ${
                        dept.asProvider.rate >= 80 ? 'text-emerald-600' :
                        dept.asProvider.rate >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {dept.asProvider.rate}%
                      </span>
                    </div>
                    <Progress
                      value={dept.asProvider.rate}
                      className="h-2 mb-2"
                    />
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>Total: {dept.asProvider.total}</span>
                      <span className="text-emerald-600">✓ {dept.asProvider.completed}</span>
                      <span className="text-red-600">✗ {dept.asProvider.incumplidas}</span>
                      <span className="text-amber-600">⏳ {dept.asProvider.enFecha}</span>
                      <span className="text-slate-500">○ {dept.asProvider.solicitadas}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Cross-evaluation Matrix */}
      {Object.keys(data.matrix).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="size-4" />
              Matriz de Evaluación Cruzada
            </CardTitle>
            <CardDescription className="text-xs">Solicitante → Proveedor: cumplidas/total</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {Object.entries(data.matrix).map(([requesterId, providers]) => {
                  const requester = data.departments.find(d => d.id === requesterId)
                  if (!requester) return null
                  return (
                    <div key={requesterId} className="text-xs">
                      <p className="font-medium text-muted-foreground py-1">{requester.name} solicita:</p>
                      <div className="ml-3 space-y-0.5">
                        {Object.entries(providers).map(([providerId, stats]) => {
                          const provider = data.departments.find(d => d.id === providerId)
                          if (!provider) return null
                          const rate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
                          return (
                            <div key={providerId} className="flex items-center gap-2 py-0.5">
                              <ChevronRight className="size-3 text-muted-foreground" />
                              <span>{provider.name}:</span>
                              <span className={rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600'}>
                                {stats.completed}/{stats.total} ({rate}%)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function AffectationReport() {
  const { data, isLoading } = useAffectationReport()
  const [exporting, setExporting] = useState(false)

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/reports/export/affectation')
      if (!res.ok) throw new Error('Error al generar reporte')
      const html = await res.text()
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(html)
        printWindow.document.close()
        setTimeout(() => {
          printWindow.print()
        }, 500)
        toast.success('Reporte abierto para impresión/PDF')
      } else {
        toast.error('Permita las ventanas emergentes para exportar')
      }
    } catch {
      toast.error('Error al exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  if (isLoading) return <DashboardSkeleton />

  if (!data) return <EmptyReport message="No se pudo cargar el reporte de afectación" />

  return (
    <div className="space-y-4">
      {/* Header with export button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Resumen General</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportPDF}
          disabled={exporting}
          className="text-red-700 border-red-200 hover:bg-red-50"
        >
          {exporting ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="size-4 mr-1.5" />
          )}
          Exportar PDF
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard title="Registros" value={data.summary.totalRecords} icon={FileText} color="text-red-700" bgColor="bg-red-100" />
        <MetricCard title="Depts. Afectados" value={data.summary.departmentsAffected} icon={Building2} color="text-amber-700" bgColor="bg-amber-100" />
        <MetricCard title="Requieren Revisión" value={data.summary.departmentsForReview} icon={AlertCircle} color="text-red-700" bgColor="bg-red-100" />
      </div>

      {/* Department Affectation Cards */}
      {data.departments.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 className="size-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">Sin afectaciones registradas</p>
          <p className="text-xs text-muted-foreground mt-1">Todas las direcciones están al día</p>
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3">
            {data.departments.map((dept) => (
              <AffectationDepartmentCard key={dept.departmentId} dept={dept} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}

function AffectationDepartmentCard({ dept }: {
  dept: AffectationData['departments'][number]
}) {
  const [expanded, setExpanded] = useState(false)
  const maxAffectation = 0.5 // Scale: 0 to 0.5
  const percentage = Math.min((dept.totalAffectation / maxAffectation) * 100, 100)
  const barColor = dept.totalAffectation >= 0.3 ? 'bg-red-500' : dept.totalAffectation >= 0.2 ? 'bg-amber-500' : 'bg-yellow-400'

  return (
    <Card className={`py-3 gap-2 ${dept.requiresCommissionReview ? 'border-red-300' : ''}`}>
      <CardContent className="p-4 pt-0">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate">{dept.departmentName}</p>
              {dept.requiresCommissionReview && (
                <Badge variant="destructive" className="text-[10px] py-0 px-1.5">
                  Revisión Comisión
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{dept.responsibleName}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${dept.totalAffectation >= 0.3 ? 'text-red-600' : 'text-amber-600'}`}>
              {dept.totalAffectation.toFixed(1)}
            </span>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </div>

        {/* Affectation Progress Bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
            <span>Afectación</span>
            <span>{dept.totalAffectation >= 0.3 ? '⚠ Requiere revisión' : ''}</span>
          </div>
          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>0</span>
            <span className="text-amber-500">0.2</span>
            <span className="text-red-500">0.3</span>
            <span>0.5</span>
          </div>
        </div>

        {/* Expanded Details - CSS transition instead of AnimatePresence */}
        <CollapsibleSection show={expanded}>
          <Separator className="my-2" />
          <p className="text-xs font-medium text-muted-foreground mb-2">Detalle de Incumplimientos:</p>
          <div className="space-y-2">
            {dept.records.map((rec) => (
              <div key={rec.id} className="p-2 rounded-md bg-red-50 text-xs space-y-1">
                <p className="font-medium">{rec.requestDescription}</p>
                <div className="flex justify-between text-muted-foreground">
                  <span>Solicitado por: {rec.requesterDeptName}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Vencimiento: {formatDateShort(rec.deadlineDate)}</span>
                  <span>Afectación: +{rec.affectationValue.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      </CardContent>
    </Card>
  )
}

function EmptyReport({ message }: { message: string }) {
  return (
    <div className="text-center py-12">
      <Info className="size-12 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  )
}

// ============================================================================
// DIRECTORY TAB
// ============================================================================

function DirectorioTab() {
  const { data: departments, isLoading } = useDepartments()

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!departments || departments.length === 0) {
    return (
      <div className="text-center py-12 p-4">
        <Building2 className="size-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground font-medium">No hay direcciones registradas</p>
      </div>
    )
  }

  const direcciones = departments.filter(d => d.type === 'DIRECCION_FUNCIONAL')
  const uebs = departments.filter(d => d.type === 'UEB')

  return (
    <div className="space-y-4 p-4">
      <h2 className="text-lg font-semibold">Directorio de Direcciones</h2>

      {/* Direcciones Funcionales */}
      {direcciones.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Shield className="size-4" />
            Direcciones Funcionales
          </h3>
          <div className="space-y-3">
            {direcciones.map((dept) => (
              <DeptCard key={dept.id} dept={dept} />
            ))}
          </div>
        </div>
      )}

      {/* UEBs */}
      {uebs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <MapPin className="size-4" />
            Unidades Empresariales de Base
          </h3>
          <div className="space-y-3">
            {uebs.map((dept) => (
              <DeptCard key={dept.id} dept={dept} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DeptCard({ dept }: { dept: Department }) {
  return (
    <Card className="py-3 gap-2">
      <CardContent className="p-4 pt-0">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{dept.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
              <User className="size-3" />
              <span>{dept.responsibleName}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="italic">{dept.responsibleRole}</span>
            </div>
            {dept.phone && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                <PhoneCall className="size-3" />
                <span>{dept.phone}</span>
              </div>
            )}
          </div>
          <a
            href={`mailto:${dept.email}`}
            className="flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors flex-shrink-0"
          >
            <Mail className="size-3.5" />
            <span className="hidden sm:inline">{dept.email}</span>
            <span className="sm:hidden">Correo</span>
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// NAV CONFIG
// ============================================================================

const navItems: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'nueva', label: 'Nueva', icon: FilePlus },
  { id: 'solicitudes', label: 'Solicitudes', icon: ListChecks },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'directorio', label: 'Directorio', icon: Phone },
]

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function Home() {
  const { activeTab, setActiveTab, seeded, setSeeded } = useAppStore()
  const isMobile = useIsMobile()
  const queryClient = useQueryClient()

  // Seed departments on first load
  useEffect(() => {
    if (!seeded) {
      fetch('/api/departments/seed', { method: 'POST' })
        .then(res => res.json())
        .then(() => {
          setSeeded(true)
          queryClient.invalidateQueries({ queryKey: ['departments'] })
        })
        .catch(() => {
          // Seeding may fail if already done
          setSeeded(true)
        })
    }
  }, [seeded, setSeeded, queryClient])

  // Update statuses on tab change
  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTab(tab)
    if (tab === 'dashboard' || tab === 'solicitudes') {
      fetch('/api/requests/update-statuses', { method: 'POST' }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['stats'] })
        queryClient.invalidateQueries({ queryKey: ['requests'] })
      }).catch(() => {})
    }
  }, [setActiveTab, queryClient])

  const tabContent: Record<TabId, React.ReactNode> = {
    dashboard: <DashboardTab />,
    nueva: <NuevaSolicitudTab />,
    solicitudes: <SolicitudesTab />,
    reportes: <ReportesTab />,
    directorio: <DirectorioTab />,
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2 rounded-lg">
              <Building2 className="size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-bold leading-tight truncate">
                GEOCUBA Camagüey - Ciego de Ávila
              </h1>
              <p className="text-[11px] sm:text-xs text-blue-200 leading-tight truncate">
                Sistema de Control de Entrega de Informaciones
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        {!isMobile && (
          <div className="max-w-4xl mx-auto px-4">
            <nav className="flex gap-1 -mb-px">
              {navItems.map((item) => {
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                      isActive
                        ? 'border-white text-white'
                        : 'border-transparent text-blue-300 hover:text-white hover:border-blue-400'
                    }`}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content - CSS transition instead of AnimatePresence */}
      <main className="flex-1 max-w-4xl mx-auto w-full pb-20 sm:pb-4">
        <div
          key={activeTab}
          className="animate-in fade-in duration-150"
        >
          {tabContent[activeTab]}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-blue-950 text-blue-300 py-3 mt-auto">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-[11px]">
            © {new Date().getFullYear()} GEOCUBA Camagüey - Ciego de Ávila · Sistema de Control de Entrega de Informaciones
          </p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50 safe-area-bottom">
          <div className="flex justify-around">
            {navItems.map((item) => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex flex-col items-center justify-center py-2 px-1 min-w-[60px] transition-colors ${
                    isActive ? 'text-blue-700' : 'text-muted-foreground'
                  }`}
                >
                  <item.icon className={`size-5 ${isActive ? 'text-blue-700' : ''}`} />
                  <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-blue-700' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && <MobileTabIndicator />}
                </button>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
