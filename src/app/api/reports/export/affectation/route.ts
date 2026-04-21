import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/export/affectation - Generate printable HTML for affectation report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')

    const where: Record<string, unknown> = {}
    if (departmentId) {
      where.departmentId = departmentId
    }

    const affectationRecords = await db.affectationRecord.findMany({
      where,
      include: { department: true },
      orderBy: { detectedAt: 'desc' },
    })

    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    const deptAffectation = departments.map((dept) => {
      const records = affectationRecords.filter((r) => r.departmentId === dept.id)
      const latestRecord = records[0]
      const totalAffectation = latestRecord?.cumulativeAffectation || 0
      const requiresCommission = totalAffectation >= 0.3

      return {
        departmentName: dept.name,
        departmentType: dept.type,
        responsibleName: dept.responsibleName,
        responsibleRole: dept.responsibleRole,
        email: dept.email,
        totalAffectation,
        requiresCommissionReview: requiresCommission,
        records: records.map((r) => ({
          requestDescription: r.requestDescription,
          requesterDeptName: r.requesterDeptName,
          deadlineDate: r.deadlineDate,
          affectationValue: r.affectationValue,
          cumulativeAffectation: r.cumulativeAffectation,
          detectedAt: r.detectedAt,
          reviewStatus: r.reviewStatus,
        })),
      }
    }).filter((d) => d.records.length > 0)

    const totalRecords = affectationRecords.length
    const departmentsAffected = deptAffectation.length
    const departmentsForReview = deptAffectation.filter(d => d.requiresCommissionReview).length

    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Afectación - GEOCUBA</title>
<style>
  @page { size: letter; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.4; background: #fff; }
  .header { background: #7f1d1d; color: #fff; padding: 16px 20px; margin: -15mm -15mm 15px -15mm; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 16px; font-weight: 700; }
  .header .subtitle { font-size: 10px; color: #fca5a5; margin-top: 2px; }
  .header .date { font-size: 10px; color: #fecaca; }
  h2 { font-size: 14px; color: #dc2626; margin: 15px 0 8px; border-bottom: 2px solid #dc2626; padding-bottom: 4px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 15px; }
  .summary-card { border: 1px solid #fecaca; border-radius: 6px; padding: 10px; text-align: center; background: #fef2f2; }
  .summary-card .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .red { color: #dc2626; } .amber { color: #d97706; } .teal { color: #0f766e; }
  .system-note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 4px; padding: 6px 10px; font-size: 9px; color: #92400e; margin-bottom: 15px; }
  .dept-card { border: 1px solid #e5e7eb; border-radius: 6px; margin-bottom: 12px; overflow: hidden; page-break-inside: avoid; }
  .dept-header { padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; }
  .dept-header.warning { background: #fffbeb; border-left: 4px solid #d97706; }
  .dept-header.danger { background: #fef2f2; border-left: 4px solid #dc2626; }
  .dept-name { font-size: 12px; font-weight: 700; color: #1f2937; }
  .dept-responsible { font-size: 9px; color: #6b7280; margin-top: 2px; }
  .dept-score { text-align: right; }
  .dept-score .value { font-size: 18px; font-weight: 700; }
  .dept-score .label { font-size: 8px; color: #9ca3af; }
  .badge-review { display: inline-block; background: #dc2626; color: #fff; font-size: 8px; padding: 1px 6px; border-radius: 3px; margin-left: 5px; font-weight: 600; }
  .progress-bar { height: 6px; background: #f3f4f6; margin: 0 12px; border-radius: 3px; overflow: hidden; }
  .progress-fill { height: 100%; border-radius: 3px; }
  .progress-scale { display: flex; justify-content: space-between; font-size: 7px; color: #9ca3af; padding: 2px 12px; }
  .records-table { width: calc(100% - 24px); margin: 8px 12px 10px; border-collapse: collapse; font-size: 9px; }
  .records-table th { background: #e5e7eb; padding: 4px 6px; text-align: left; font-size: 8px; font-weight: 600; color: #374151; }
  .records-table td { padding: 4px 6px; border-bottom: 1px solid #f3f4f6; }
  .records-table tr:nth-child(even) td { background: #fef2f2; }
  .empty-state { text-align: center; padding: 30px; color: #059669; }
  .empty-state h3 { font-size: 16px; margin-bottom: 5px; }
  .empty-state p { font-size: 11px; color: #6b7280; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #9ca3af; text-align: center; }
  @media print { .header, th, .summary-card, .dept-header, .records-table tr:nth-child(even) td, .progress-bar, .system-note { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>GEOCUBA Camagüey - Ciego de Ávila</h1>
    <div class="subtitle">Sistema de Control de Entrega de Informaciones</div>
  </div>
  <div class="date">${dateStr}</div>
</div>

<h2>Reporte de Afectación por Incumplimiento</h2>

<div class="system-note">
  <strong>Sistema de afectación:</strong> 0.1 por incumplimiento. A los 0.3 (3 incumplimientos) se requiere revisión por la Comisión de Cuadros.
</div>

<div class="summary-grid">
  <div class="summary-card"><div class="label">Registros de Afectación</div><div class="value red">${totalRecords}</div></div>
  <div class="summary-card"><div class="label">Departamentos Afectados</div><div class="value amber">${departmentsAffected}</div></div>
  <div class="summary-card"><div class="label">Requieren Revisión</div><div class="value red">${departmentsForReview}</div></div>
</div>

${deptAffectation.length === 0 ? `
<div class="empty-state">
  <h3>Sin Afectaciones Registradas</h3>
  <p>Todos los departamentos están al día con sus entregas.</p>
</div>
` : `
<h2>Detalle de Afectaciones por Departamento</h2>
${deptAffectation.map(dept => {
  const fillPct = Math.min((dept.totalAffectation / 0.5) * 100, 100)
  const fillColor = dept.totalAffectation >= 0.3 ? '#ef4444' : dept.totalAffectation >= 0.2 ? '#f59e0b' : '#fbbf24'
  const scoreColor = dept.totalAffectation >= 0.3 ? '#dc2626' : '#d97706'
  const headerClass = dept.requiresCommissionReview ? 'danger' : 'warning'
  const typeLabel = dept.departmentType === 'DIRECCION_FUNCIONAL' ? '(Dirección Funcional)' : '(UEB)'
  return `
  <div class="dept-card">
    <div class="dept-header ${headerClass}">
      <div>
        <div class="dept-name">${dept.departmentName} ${typeLabel}${dept.requiresCommissionReview ? '<span class="badge-review">REVISIÓN COMISIÓN</span>' : ''}</div>
        <div class="dept-responsible">Responsable: ${dept.responsibleName} (${dept.responsibleRole})</div>
      </div>
      <div class="dept-score">
        <div class="value" style="color:${scoreColor}">${dept.totalAffectation.toFixed(1)}</div>
        <div class="label">Afectación acumulada</div>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${fillPct}%;background:${fillColor}"></div></div>
    <div class="progress-scale"><span>0</span><span>0.2</span><span style="color:#dc2626">0.3</span><span>0.5</span></div>
    <table class="records-table">
      <thead><tr><th>Solicitud</th><th>Solicitado por</th><th>Vencimiento</th><th>Afectación</th><th>Acumulada</th><th>Estado</th></tr></thead>
      <tbody>
        ${dept.records.map(rec => {
          const deadline = new Date(rec.deadlineDate).toLocaleDateString('es-ES')
          const statusLabel = rec.reviewStatus === 'PENDIENTE' ? 'Pendiente' : rec.reviewStatus === 'REVISADO' ? 'Revisado' : 'Resuelto'
          return `<tr>
            <td>${rec.requestDescription.substring(0, 45)}${rec.requestDescription.length > 45 ? '...' : ''}</td>
            <td>${rec.requesterDeptName}</td>
            <td>${deadline}</td>
            <td style="color:#dc2626;font-weight:600">+${rec.affectationValue.toFixed(1)}</td>
            <td style="font-weight:600">${rec.cumulativeAffectation.toFixed(1)}</td>
            <td>${statusLabel}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>`
}).join('')}
`}

<div class="footer">
  GEOCUBA Camagüey - Ciego de Ávila · Reporte de Afectación · Generado el ${dateStr}
</div>
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating affectation report HTML:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
