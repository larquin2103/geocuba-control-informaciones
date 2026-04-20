import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/reports/export/compliance - Generate printable HTML for compliance report
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')

    const where: Record<string, unknown> = {}
    if (departmentId) {
      where.OR = [
        { requesterDeptId: departmentId },
        { providerDeptId: departmentId },
      ]
    }

    const requests = await db.informationRequest.findMany({
      where,
      include: {
        requesterDept: true,
        providerDept: true,
      },
    })

    const total = requests.length
    const completed = requests.filter((r) => r.status === 'CUMPLIDO').length
    const incumplidas = requests.filter((r) => r.status === 'INCUMPLIDO').length
    const enFecha = requests.filter((r) => r.status === 'EN_FECHA').length
    const solicitadas = requests.filter((r) => r.status === 'SOLICITADO').length
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0

    const departments = await db.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })

    const deptBreakdown = departments.map((dept) => {
      const asRequester = requests.filter((r) => r.requesterDeptId === dept.id)
      const asProvider = requests.filter((r) => r.providerDeptId === dept.id)
      const providerCompleted = asProvider.filter((r) => r.status === 'CUMPLIDO').length
      const providerIncumplidas = asProvider.filter((r) => r.status === 'INCUMPLIDO').length
      const providerEnFecha = asProvider.filter((r) => r.status === 'EN_FECHA').length
      const providerSolicitadas = asProvider.filter((r) => r.status === 'SOLICITADO').length
      const providerRate = asProvider.length > 0 ? Math.round((providerCompleted / asProvider.length) * 100) : 0

      return {
        name: dept.name,
        type: dept.type,
        responsibleName: dept.responsibleName,
        asProvider: { total: asProvider.length, completed: providerCompleted, incumplidas: providerIncumplidas, enFecha: providerEnFecha, solicitadas: providerSolicitadas, rate: providerRate },
        asRequester: { total: asRequester.length },
      }
    }).filter(d => d.asProvider.total > 0 || d.asRequester.total > 0)

    const matrix: Record<string, Record<string, { total: number; completed: number }>> = {}
    for (const req of requests) {
      const rName = req.requesterDept.name
      const pName = req.providerDept.name
      if (!matrix[rName]) matrix[rName] = {}
      if (!matrix[rName][pName]) matrix[rName][pName] = { total: 0, completed: 0 }
      matrix[rName][pName].total++
      if (req.status === 'CUMPLIDO') matrix[rName][pName].completed++
    }

    const dateStr = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de Cumplimiento - GEOCUBA</title>
<style>
  @page { size: letter; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1f2937; font-size: 11px; line-height: 1.4; background: #fff; }
  .header { background: #115e59; color: #fff; padding: 16px 20px; margin: -15mm -15mm 15px -15mm; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 16px; font-weight: 700; }
  .header .subtitle { font-size: 10px; color: #99f6e4; margin-top: 2px; }
  .header .date { font-size: 10px; color: #ccfbf1; }
  h2 { font-size: 14px; color: #0f766e; margin: 15px 0 8px; border-bottom: 2px solid #0f766e; padding-bottom: 4px; }
  h3 { font-size: 12px; color: #115e59; margin: 12px 0 6px; }
  .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 15px; }
  .summary-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; text-align: center; background: #f8fafc; }
  .summary-card .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
  .summary-card .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
  .teal { color: #0f766e; } .emerald { color: #059669; } .amber { color: #d97706; } .red { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
  th { background: #0f766e; color: #fff; padding: 6px 8px; text-align: center; font-weight: 600; font-size: 9px; }
  th:first-child { text-align: left; }
  td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f8fafc; }
  td:first-child { text-align: left; font-weight: 500; }
  .rate-high { color: #059669; font-weight: 700; } .rate-mid { color: #d97706; font-weight: 700; } .rate-low { color: #dc2626; font-weight: 700; }
  .matrix-section { margin-top: 10px; }
  .matrix-row { margin-bottom: 6px; }
  .matrix-requester { font-weight: 600; color: #115e59; font-size: 10px; margin-bottom: 2px; }
  .matrix-provider { padding-left: 15px; font-size: 9px; color: #4b5563; }
  .footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #9ca3af; text-align: center; }
  .badge-review { display: inline-block; background: #dc2626; color: #fff; font-size: 8px; padding: 1px 6px; border-radius: 3px; margin-left: 5px; font-weight: 600; }
  @media print { .header { -webkit-print-color-adjust: exact; print-color-adjust: exact; } th, .summary-card, tr:nth-child(even) { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
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

<h2>Reporte de Cumplimiento</h2>

<div class="summary-grid">
  <div class="summary-card"><div class="label">Total</div><div class="value teal">${total}</div></div>
  <div class="summary-card"><div class="label">Cumplidas</div><div class="value emerald">${completed}</div></div>
  <div class="summary-card"><div class="label">En Fecha</div><div class="value amber">${enFecha}</div></div>
  <div class="summary-card"><div class="label">Incumplidas</div><div class="value red">${incumplidas}</div></div>
  <div class="summary-card"><div class="label">Tasa</div><div class="value teal">${rate}%</div></div>
</div>

<h2>Cumplimiento por Departamento (como Proveedor)</h2>
<table>
  <thead>
    <tr><th>Departamento</th><th>Total</th><th>Cumplidas</th><th>Incumplidas</th><th>En Fecha</th><th>Solicitadas</th><th>% Cumpl.</th></tr>
  </thead>
  <tbody>
    ${deptBreakdown.map(d => {
      const typeLabel = d.type === 'DIRECCION_FUNCIONAL' ? '(DF)' : '(UEB)'
      const rateClass = d.asProvider.rate >= 80 ? 'rate-high' : d.asProvider.rate >= 50 ? 'rate-mid' : 'rate-low'
      return `<tr>
        <td>${d.name} ${typeLabel}</td>
        <td>${d.asProvider.total}</td>
        <td>${d.asProvider.completed}</td>
        <td>${d.asProvider.incumplidas}</td>
        <td>${d.asProvider.enFecha}</td>
        <td>${d.asProvider.solicitadas}</td>
        <td class="${rateClass}">${d.asProvider.rate}%</td>
      </tr>`
    }).join('')}
  </tbody>
</table>

${Object.keys(matrix).length > 0 ? `
<h2>Matriz de Evaluación Cruzada</h2>
<p style="font-size:9px;color:#6b7280;margin-bottom:8px;">Solicitante → Proveedor: cumplidas/total (tasa)</p>
<div class="matrix-section">
  ${Object.entries(matrix).map(([reqName, providers]) => `
    <div class="matrix-row">
      <div class="matrix-requester">${reqName} solicita:</div>
      ${Object.entries(providers).map(([provName, stats]) => {
        const r = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0
        const color = r >= 80 ? '#059669' : r >= 50 ? '#d97706' : '#dc2626'
        return `<div class="matrix-provider">→ ${provName}: <strong style="color:${color}">${stats.completed}/${stats.total} (${r}%)</strong></div>`
      }).join('')}
    </div>
  `).join('')}
</div>
` : ''}

<div class="footer">
  GEOCUBA Camagüey - Ciego de Ávila · Reporte de Cumplimiento · Generado el ${dateStr}
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
    console.error('Error generating compliance report HTML:', error)
    return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 })
  }
}
