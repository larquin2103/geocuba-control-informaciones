import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST /api/departments/seed - Seed initial departments
export async function POST() {
  try {
    const seedData = [
      // Direcciones Funcionales
      {
        name: 'Departamento de Capital Humano',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Mariela Gómez Alvarez',
        responsibleRole: 'Directora',
        email: 'mariela@camaguey.geocuba.cu',
      },
      {
        name: 'Departamento de Inversiones',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Lázaro Companioni Ordaz',
        responsibleRole: 'Jefe de Grupo',
        email: 'ordaz@camaguey.geocuba.cu',
      },
      {
        name: 'Dirección Técnico Productivo',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Teresa Tórrez Rangel',
        responsibleRole: 'Directora',
        email: 'tere@camaguey.geocuba.cu',
      },
      {
        name: 'Dirección de Mercado',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Odalmis Bichara Guerra',
        responsibleRole: 'Directora',
        email: 'odalmis@camaguey.geocuba.cu',
      },
      {
        name: 'Departamento de Infocomunicaciones',
        type: 'DIRECCION_FUNCIONAL',
        responsibleName: 'Josefa Aguero',
        responsibleRole: 'Directora',
        email: 'josefa@camaguey.geocuba.cu',
      },
      // UEB
      {
        name: 'Unidad Básica de Logística',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'mdiaz@camaguey.geocuba.cu',
      },
      {
        name: 'Agencia Provincial Camagüey',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'erick@camaguey.geocuba.cu',
      },
      {
        name: 'Agencia Gráfica',
        type: 'UEB',
        responsibleName: 'Directora',
        responsibleRole: 'Directora',
        email: 'taniac@camaguey.geocuba.cu',
      },
      {
        name: 'Fábrica de Envases Flexibles',
        type: 'UEB',
        responsibleName: 'Directora',
        responsibleRole: 'Directora',
        email: 'debora@enflex.geocuba.cu',
      },
      {
        name: 'Agencia Provincial Ciego de Ávila',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'yadier@cavila.geocuba.cu',
      },
      {
        name: 'Agencia ANAV Ayuda a la Navegación',
        type: 'UEB',
        responsibleName: 'Director',
        responsibleRole: 'Director',
        email: 'luciano@camaguey.geocuba.cu',
      },
    ]

    const results = {
      created: 0,
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
        results.skipped++
      }
    }

    return NextResponse.json({
      message: 'Seed completed successfully',
      ...results,
    })
  } catch (error) {
    console.error('Error seeding departments:', error)
    return NextResponse.json(
      { error: 'Failed to seed departments' },
      { status: 500 }
    )
  }
}
