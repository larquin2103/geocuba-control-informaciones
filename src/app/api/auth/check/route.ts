import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

// Seed data duplicated from /api/departments/seed for auto-initialization
const SEED_DEPARTMENTS = [
  { name: 'Dirección de Capital Humano', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Mariela Gómez Alvarez', responsibleRole: 'Directora', email: 'mariela@camaguey.geocuba.cu', phone: '52104017' },
  { name: 'Dirección de Inversiones', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Lázaro Companioni Ordaz', responsibleRole: 'Jefe de Grupo', email: 'ordaz@camaguey.geocuba.cu', phone: '52177126' },
  { name: 'Dirección Técnico Productivo', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Teresa Tórrez Rangel', responsibleRole: 'Directora', email: 'tere@camaguey.geocuba.cu', phone: '52809694' },
  { name: 'Dirección de Mercado', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Odalmis Bichara Guerra', responsibleRole: 'Directora', email: 'odalmis@camaguey.geocuba.cu', phone: '59873154' },
  { name: 'Dirección de Info-comunicaciones', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Josefa Aguero', responsibleRole: 'Directora', email: 'josefa@camaguey.geocuba.cu', phone: '52177114' },
  { name: 'Director General', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Ramón Larquin Pintado', responsibleRole: 'Director General', email: 'larquin@camaguey.geocuba.cu', phone: '' },
  { name: 'Coordinador General', type: 'DIRECCION_FUNCIONAL', responsibleName: 'Ida', responsibleRole: 'Coordinador General', email: 'ida@camaguey.geocuba.cu', phone: '' },
  { name: 'Unidad Básica de Logística', type: 'UEB', responsibleName: 'Director', responsibleRole: 'Director', email: 'mdiaz@camaguey.geocuba.cu', phone: '52105092' },
  { name: 'Agencia Provincial Camagüey', type: 'UEB', responsibleName: 'Director', responsibleRole: 'Director', email: 'erick@camaguey.geocuba.cu', phone: '52177121' },
  { name: 'Agencia Gráfica', type: 'UEB', responsibleName: 'Directora', responsibleRole: 'Directora', email: 'taniac@camaguey.geocuba.cu', phone: '52105094' },
  { name: 'Fábrica de Envases Flexibles', type: 'UEB', responsibleName: 'Directora', responsibleRole: 'Directora', email: 'debora@enflex.geocuba.cu', phone: '52177111' },
  { name: 'Agencia Provincial Ciego de Ávila', type: 'UEB', responsibleName: 'Director', responsibleRole: 'Director', email: 'yadier@cavila.geocuba.cu', phone: '50105111' },
  { name: 'Agencia ANAV Ayuda a la Navegación', type: 'UEB', responsibleName: 'Director', responsibleRole: 'Director', email: 'luciano@camaguey.geocuba.cu', phone: '52104020' },
]

async function ensureSeedData() {
  const count = await db.department.count()
  if (count > 0) return false // Already seeded

  console.log('[Auto-Seed] No departments found. Seeding initial data...')

  for (const data of SEED_DEPARTMENTS) {
    await db.department.create({ data })
  }

  // Set initial password for Director General
  const director = await db.department.findFirst({ where: { name: 'Director General' } })
  if (director) {
    const hashedPassword = await hashPassword('geocuba2025*')
    await db.department.update({
      where: { id: director.id },
      data: { passwordHash: hashedPassword },
    })
  }

  console.log('[Auto-Seed] Departments seeded successfully. Director: larquin@camaguey.geocuba.cu / geocuba2025*')
  return true
}

// POST /api/auth/check - Check if an email exists and if it has a password set
// This is a public endpoint used in the login flow before authentication
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Correo electrónico es requerido' },
        { status: 400 }
      )
    }

    // Auto-seed if database is empty (first run on a new machine)
    await ensureSeedData()

    // Find department by email
    const department = await db.department.findFirst({
      where: { email: email.toLowerCase().trim() },
    })

    if (!department) {
      return NextResponse.json(
        { error: 'No se encontró una dirección con ese correo electrónico. Verifique que el correo sea correcto o contacte al administrador.' },
        { status: 404 }
      )
    }

    if (!department.active) {
      return NextResponse.json(
        { error: 'Esta cuenta está desactivada. Contacte al administrador.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      exists: true,
      hasPassword: !!department.passwordHash,
      departmentName: department.name,
      responsibleName: department.responsibleName,
    })
  } catch (error) {
    console.error('Error verificando correo:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
