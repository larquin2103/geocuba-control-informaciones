#!/bin/bash
# ============================================================
# GEOCUBA SCEI - Script de ejecución en producción
# ============================================================
# Ejecuta la aplicación Next.js en modo standalone con
# reinicio automático en caso de fallo.
# ============================================================

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

# Intentar usar standalone build primero, si no existe usar next start
if [ -f "$APP_DIR/.next/standalone/server.js" ]; then
  SERVER_DIR="$APP_DIR/.next/standalone"
  echo "🚀 Usando standalone build..."
else
  SERVER_DIR="$APP_DIR"
  echo "🚀 Usando next start..."
fi

cd "$SERVER_DIR"

# Crear archivo .env si no existe (para standalone)
if [ ! -f "$SERVER_DIR/.env" ]; then
  echo "DATABASE_URL=file:./db/custom.db" > "$SERVER_DIR/.env"
  echo "SMTP_HOST=192.168.7.4" >> "$SERVER_DIR/.env"
  echo "SMTP_PORT=25" >> "$SERVER_DIR/.env"
  echo "SMTP_SECURE=false" >> "$SERVER_DIR/.env"
  echo "SMTP_USER=larquin@camaguey.geocuba.cu" >> "$SERVER_DIR/.env"
  echo "SMTP_PASS=karenenrrique2103new*" >> "$SERVER_DIR/.env"
  echo "SMTP_FROM=GEOCUBA CM-CA <larquin@camaguey.geocuba.cu>" >> "$SERVER_DIR/.env"
fi

RESTART_COUNT=0
MAX_RESTARTS=10

while [ $RESTART_COUNT -lt $MAX_RESTARTS ]; do
  echo ""
  echo "============================================================"
  echo "  GEOCUBA SCEI - Iniciando servidor (intento $((RESTART_COUNT + 1))/$MAX_RESTARTS)"
  echo "  Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "============================================================"

  if [ -f "$SERVER_DIR/server.js" ]; then
    NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 node server.js 2>&1
  else
    NODE_ENV=production npx next start -p 3000 -H 0.0.0.0 2>&1
  fi

  EXIT_CODE=$?
  RESTART_COUNT=$((RESTART_COUNT + 1))
  echo "Servidor detenido (código: $EXIT_CODE). Reiniciando en 3s..."

  # Reset counter after successful long run
  sleep 3
done

echo "❌ Máximo de reinicios alcanzado ($MAX_RESTARTS). Deteniendo."
