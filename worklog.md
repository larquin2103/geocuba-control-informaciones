---
Task ID: 1
Agent: Main Agent
Task: Apply user-requested adjustments - rename departments, add Director General/Coordinador General, add phone numbers, change "departamentos" to "Direcciones", update color palette to red/blue modern professional

Work Log:
- Added `phone` field (String?) to Department model in Prisma schema
- Updated seed data: renamed "Departamento de Capital Humano" → "Dirección de Capital Humano", "Departamento de Infocomunicaciones" → "Dirección de Info-comunicaciones", "Departamento de Inversiones" → "Dirección de Inversiones"
- Added phone numbers for all directors/departments as specified by user
- Added "Director General" and "Coordinador General" as new DIRECCION_FUNCIONAL entries
- Updated Department TypeScript interface to include `phone: string | null`
- Updated DeptCard component to display phone numbers with PhoneCall icon
- Changed all "departamento/Departamento" references in frontend to "dirección/Dirección"
- Updated DirectorioTab title from "Directorio de Departamentos" to "Directorio de Direcciones"
- Updated NuevaSolicitudTab labels from "Departamento Solicitante" to "Dirección Solicitante" etc.
- Updated Dashboard and Reports "Cumplimiento por Departamento" → "Cumplimiento por Dirección"
- Added "Dirección Superior" group in requester select (Director General, Coordinador General)
- Added "Dirección Superior" checkbox group in provider multi-select
- Changed entire color palette from teal to blue/red: header bg-blue-900, footer bg-blue-950, all teal → blue
- Updated globals.css with blue-based oklch primary colors and chart colors
- Pushed schema changes and re-seeded database successfully
- Lint passes with no errors

Stage Summary:
- All departments renamed correctly in database
- Phone numbers added for all departments
- Director General and Coordinador General added as requesters
- "Departamentos" replaced with "Direcciones" throughout UI
- Color palette updated to professional blue/red scheme
- Application running successfully on localhost:3000
