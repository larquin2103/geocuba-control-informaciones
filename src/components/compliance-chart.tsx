'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ChartDataItem {
  name: string
  fullName: string
  cumplimiento: number
  incumplimiento: number
}

export default function ComplianceChart({ data }: { data: ChartDataItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Cumplimiento por Dirección</CardTitle>
        <CardDescription className="text-xs">Porcentaje de cumplimiento como proveedor</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
              <YAxis type="category" dataKey="name" width={110} fontSize={10} />
              <Tooltip
                formatter={(value: number, name: string) => [`${value}%`, name === 'cumplimiento' ? 'Cumplimiento' : 'Incumplimiento']}
                labelFormatter={(label: string) => data.find(d => d.name === label)?.fullName || label}
              />
              <Bar dataKey="cumplimiento" stackId="a" radius={[0, 0, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.cumplimiento >= 80 ? '#059669' : entry.cumplimiento >= 50 ? '#d97706' : '#dc2626'}
                  />
                ))}
              </Bar>
              <Bar dataKey="incumplimiento" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
