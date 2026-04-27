import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { NextResponse } from 'next/server'

// GET /api/departments/seed - Seed initial departments (convenient browser access)
export async function GET() {
  return POST()
}

// POST /api/departments/seed - Seed initial departments
export async function POST() {
  try {
    // Rename old department names to new ones (safe - skips if not found)
    const nameRenames: Record<string, string> = {
      'Departamento de Capital Humano': 'Dirección de Capital Humano',
      'Departamento de Inversiones': 'Dirección de Inversiones',
      'Departamento de Infocomunicaciones': 'Dirección de Info-comunicaciones',
    }

    for (const [oldName, newName] of Object.entries(nameRenames)) {
      try {
        const existing = await db.department.findUnique({ where: { name: oldName } })
        if (existing) {
          await db.department.update({
            where: { id: existing.id },
            data: { name: newName },
          })
        }
      } catch {
        // Skip if rename fails (name might not exist)
      }
    }

    // Then, seed all departments with full data
    const seedData = [
      // Direcciones Funcionales
      {
        name: 'Dirección de Capital Humano',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Mariela Gómez Alvarez',
        responsibleRole: 'Directora',
        email: 'mariela@camaguey.geocuba.cu',
        phone: '52104017',
      },
      {
        name: 'Dirección de Inversiones',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Lázaro Companioni Ordaz',
        responsibleRole: 'Jefe de Grupo',
        email: 'ordaz@camaguey.geocuba.cu',
        phone: '52177126',
      },
      {
        name: 'Dirección Técnico Productivo',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Teresa Tórrez Rangel',
        responsibleRole: 'Directora',
        email: 'tere@camaguey.geocuba.cu',
        phone: '52809694',
      },
      {
        name: 'Dirección de Mercado',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Odalmis Bichara Guerra',
        responsibleRole: 'Directora',
        email: 'odalmis@camaguey.geocuba.cu',
        phone: '59873154',
      },
      {
        name: 'Dirección de Info-comunicaciones',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Josefa Aguero',
        responsibleRole: 'Directora',
        email: 'josefa@camaguey.geocuba.cu',
        phone: '52177114',
      },
      // Director General y Coordinador General
      {
        name: 'Director General',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Ramón Larquin Pintado',
        responsibleRole: 'Director General',
        email: 'larquin@camaguey.geocuba.cu',
        phone: '',
      },
      {
        name: 'Coordinador General',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Ida',
        responsibleRole: 'Coordinador General',
        email: 'ida@camaguey.geocuba.cu',
        phone: '',
      },
      // UEB
      {
        name: 'Unidad Básica de Logística',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'mdiaz@camaguey.geocuba.cu',
        phone: '52105092',
      },
      {
        name: 'Agencia Provincial Camagüey',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'erick@camaguey.geocuba.cu',
        phone: '52177121',
      },
      {
        name: 'Agencia Gráfica',
        type: 'UEB',
        responsibleName: 'Directora',
        responsibleRole: 'Directora',
        email: 'taniac@camaguey.geocuba.cu',
        phone: '52105094',
      },
      {
        name: 'Fábrica de Envases Flexibles',
        type: 'UEB',
        responsibleName: 'Directora',
        responsibleRole: 'Directora',
        email: 'debora@enflex.geocuba.cu',
        phone: '52177111',
      },
      {
        name: 'Agencia Provincial Ciego de Ávila',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'yadier@cavila.geocuba.cu',
        phone: '50105111',
      },
      {
        name: 'Agencia ANAV Ayuda a la Navegación',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'luciano@camaguey.geocuba.cu',
        phone: '52104020',
      },
    ]

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      departments: [] as string[],
    }

    for (const data of seedData) {
      const existing = await db.department.findUnique({
        where: { name: data.name },
      })

      if (!existing) {
        await db.department.create({ data })
        results.created++
        results.departments.push(data.name)
      } else {
        // Update existing with new data (phone, etc.)
        await db.department.update({
          where: { id: existing.id },
          data: {
            responsibleName: data.responsibleName,
            responsibleRole: data.responsibleRole,
            email: data.email,
            phone: data.phone ?? null,
          },
        })
        results.updated++
      }
    }

    // Set initial password for Director General if not set
    const director = await db.department.findFirst({
      where: { name: 'Director General' },
    })
    let passwordSet = false
    if (director && !director.passwordHash) {
      const hashedPassword = await hashPassword('geocuba2025*')
      await db.department.update({
        where: { id: director.id },
        data: { passwordHash: hashedPassword },
      })
      passwordSet = true
    }

    return NextResponse.json({
      message: 'Seed completed successfully',
      ...results,
      directorPasswordSet: passwordSet,
      directorLogin: passwordSet ? 'larquin@camaguey.geocuba.cu / geocuba2025*' : undefined,
    })
  } catch (error) {
    console.error('Error seeding departments:', error)
    return NextResponse.json(
      { error: 'Failed to seed departments' },
      { status: 500 }
    )
  }
}
