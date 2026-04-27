#!/bin/bash
# ============================================================
# GEOCUBA SCEI - Script de Despliegue en Producción
# ============================================================
# Uso: bash deploy.sh
# Este script construye la aplicación y la prepara para
# ejecutarse en el servidor de producción.
# ============================================================

set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "📁 Directorio de la aplicación: $APP_DIR"

# Paso 1: Instalar dependencias
echo ""
echo "📦 Paso 1/4: Instalando dependencias..."
bun install

# Paso 2: Generar cliente Prisma
echo ""
echo "🗄️  Paso 2/4: Generando cliente Prisma..."
npx prisma generate

# Paso 3: Construir la aplicación
echo ""
echo "🔨 Paso 3/4: Construyendo aplicación..."
npx next build

# Paso 4: Verificar build
echo ""
echo "✅ Paso 4/4: Verificando build..."
ERRORS=0

# Verificar que el build existe
if [ -d "$APP_DIR/.next" ]; then
  echo "  ✅ .next - OK"
else
  echo "  ❌ .next - FALTANTE"
  ERRORS=$((ERRORS + 1))
fi

if [ -d "$APP_DIR/.next/static" ]; then
  echo "  ✅ .next/static - OK"
else
  echo "  ❌ .next/static - FALTANTE"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "$APP_DIR/.next/BUILD_ID" ]; then
  echo "  ✅ BUILD_ID - OK"
else
  echo "  ❌ BUILD_ID - FALTANTE"
  ERRORS=$((ERRORS + 1))
fi

if [ -f "$APP_DIR/db/custom.db" ]; then
  echo "  ✅ db/custom.db - OK"
else
  echo "  ❌ db/custom.db - FALTANTE"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "🎉 ¡Build completado exitosamente!"
  echo ""
  echo "Para ejecutar en desarrollo:"
  echo "  bun run dev"
  echo ""
  echo "Para ejecutar en producción:"
  echo "  npx next start -H 0.0.0.0 -p 3000"
  echo ""
  echo "O use el script de inicio:"
  echo "  bash run-server.sh"
else
  echo "⚠️  Build completado con $ERRORS errores. Revise los problemas arriba."
fi
