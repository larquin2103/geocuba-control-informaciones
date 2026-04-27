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
echo "📦 Paso 1/5: Instalando dependencias..."
bun install

# Paso 2: Generar cliente Prisma
echo ""
echo "🗄️  Paso 2/5: Generando cliente Prisma..."
npx prisma generate

# Paso 3: Construir la aplicación
echo ""
echo "🔨 Paso 3/5: Construyendo aplicación..."
next build

# Paso 4: Copiar archivos adicionales al build standalone
echo ""
echo "📋 Paso 4/5: Copiando archivos al build..."
STANDALONE_DIR="$APP_DIR/.next/standalone"

# Copiar archivos estáticos
cp -r "$APP_DIR/.next/static" "$STANDALONE_DIR/.next/"

# Copiar carpeta public
cp -r "$APP_DIR/public" "$STANDALONE_DIR/"

# Copiar prisma schema
cp -r "$APP_DIR/prisma" "$STANDALONE_DIR/"

# Copiar base de datos
cp -r "$APP_DIR/db" "$STANDALONE_DIR/"

# Crear archivo .env de producción si no existe
if [ ! -f "$STANDALONE_DIR/.env" ]; then
  echo "DATABASE_URL=file:./db/custom.db" > "$STANDALONE_DIR/.env"
  echo "SMTP_HOST=192.168.7.4" >> "$STANDALONE_DIR/.env"
  echo "SMTP_PORT=25" >> "$STANDALONE_DIR/.env"
  echo "SMTP_SECURE=false" >> "$STANDALONE_DIR/.env"
  echo "SMTP_USER=larquin@camaguey.geocuba.cu" >> "$STANDALONE_DIR/.env"
  echo "SMTP_PASS=karenenrrique2103new*" >> "$STANDALONE_DIR/.env"
  echo "SMTP_FROM=GEOCUBA CM-CA <larquin@camaguey.geocuba.cu>" >> "$STANDALONE_DIR/.env"
  echo "✅ Archivo .env creado"
else
  echo "✅ Archivo .env ya existe"
fi

# Paso 5: Verificar build
echo ""
echo "✅ Paso 5/5: Verificando build..."
ERRORS=0

# Verificar dependencias críticas
for pkg in bcryptjs nodemailer jose; do
  if [ -d "$STANDALONE_DIR/node_modules/$pkg" ]; then
    echo "  ✅ $pkg - OK"
  else
    echo "  ❌ $pkg - FALTANTE"
    ERRORS=$((ERRORS + 1))
  fi
done

# Verificar archivos críticos
for file in "server.js" ".env" "prisma/schema.prisma" "db/custom.db"; do
  if [ -f "$STANDALONE_DIR/$file" ]; then
    echo "  ✅ $file - OK"
  else
    echo "  ❌ $file - FALTANTE"
    ERRORS=$((ERRORS + 1))
  fi
done

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "🎉 ¡Build completado exitosamente!"
  echo ""
  echo "Para ejecutar en producción:"
  echo "  cd $STANDALONE_DIR"
  echo "  NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 node server.js"
  echo ""
  echo "O use el script de inicio:"
  echo "  bash run-server.sh"
else
  echo "⚠️  Build completado con $ERRORS errores. Revise los problemas arriba."
fi
