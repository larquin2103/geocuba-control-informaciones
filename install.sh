#!/bin/bash
# ============================================================
# GEOCUBA SCEI - Script de Instalación Inicial
# ============================================================
# Este script configura la aplicación en un servidor nuevo.
# Ejecutar una sola vez: bash install.sh
# ============================================================

set -e

echo "============================================================"
echo "  GEOCUBA SCEI - Instalación en Servidor de Producción"
echo "============================================================"
echo ""

# Verificar Node.js
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo "✅ Node.js encontrado: $NODE_VERSION"
else
  echo "❌ Node.js no encontrado. Instale Node.js 18+ primero."
  exit 1
fi

# Verificar npm/bun
if command -v bun &> /dev/null; then
  echo "✅ Bun encontrado"
  PKG_CMD="bun"
elif command -v npm &> /dev/null; then
  echo "✅ npm encontrado"
  PKG_CMD="npm"
else
  echo "❌ Ni bun ni npm encontrados. Instale uno de los dos."
  exit 1
fi

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "📁 Directorio: $APP_DIR"

# Instalar dependencias
echo ""
echo "📦 Instalando dependencias..."
$PKG_CMD install

# Generar Prisma client
echo ""
echo "🗄️  Generando cliente Prisma..."
npx prisma generate

# Crear base de datos si no existe
echo ""
echo "💾 Inicializando base de datos..."
if [ ! -f "$APP_DIR/db/custom.db" ]; then
  mkdir -p "$APP_DIR/db"
  npx prisma db push
  echo "✅ Base de datos creada"
else
  echo "✅ Base de datos ya existe"
fi

# Crear archivo .env si no existe
if [ ! -f "$APP_DIR/.env" ]; then
  echo "DATABASE_URL=file:./db/custom.db" > "$APP_DIR/.env"
  echo "SMTP_HOST=192.168.7.4" >> "$APP_DIR/.env"
  echo "SMTP_PORT=25" >> "$APP_DIR/.env"
  echo "SMTP_SECURE=false" >> "$APP_DIR/.env"
  echo "SMTP_USER=larquin@camaguey.geocuba.cu" >> "$APP_DIR/.env"
  echo "SMTP_PASS=karenenrrique2103new*" >> "$APP_DIR/.env"
  echo "SMTP_FROM=GEOCUBA CM-CA <larquin@camaguey.geocuba.cu>" >> "$APP_DIR/.env"
  echo "✅ Archivo .env creado"
else
  echo "✅ Archivo .env ya existe"
fi

# Construir la aplicación
echo ""
echo "🔨 Construyendo aplicación para producción..."
$PKG_CMD run build

echo ""
echo "🎉 ¡Instalación completada!"
echo ""
echo "Para iniciar el servidor:"
echo "  bash run-server.sh"
echo ""
echo "Para usar con start-stop-daemon (recomendado):"
echo "  start-stop-daemon --start --background --make-pidfile --pidfile /var/run/geocuba-scei.pid --exec /bin/bash -- -c 'cd $APP_DIR && bash run-server.sh >> /var/log/geocuba-scei.log 2>&1'"
echo ""
echo "Para detener:"
echo "  start-stop-daemon --stop --pidfile /var/run/geocuba-scei.pid"
