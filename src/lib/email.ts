import nodemailer from 'nodemailer'

// ============================================================================
// EMAIL CONFIGURATION - SMTP GEOCUBA Exchange Server
// ============================================================================

const APP_NAME = 'GEOCUBA Camagüey - Ciego de Ávila'

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || '192.168.7.4',
  port: parseInt(process.env.SMTP_PORT || '25'),
  secure: process.env.SMTP_SECURE === 'true', // false for port 25, true for port 465
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  // Allow self-signed certificates for internal corporate servers
  tls: {
    rejectUnauthorized: false,
  },
  // Connection timeout settings
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
}

const SMTP_FROM = process.env.SMTP_FROM || `GEOCUBA CM-CA <${SMTP_CONFIG.auth.user}>`

// Create reusable SMTP transporter (lazy initialization)
let transporter: nodemailer.Transporter | null = null

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_CONFIG.host,
      port: SMTP_CONFIG.port,
      secure: SMTP_CONFIG.secure,
      auth: SMTP_CONFIG.auth.user ? SMTP_CONFIG.auth : undefined,
      tls: SMTP_CONFIG.tls,
      connectionTimeout: SMTP_CONFIG.connectionTimeout,
      greetingTimeout: SMTP_CONFIG.greetingTimeout,
      socketTimeout: SMTP_CONFIG.socketTimeout,
    })
  }
  return transporter
}

// ============================================================================
// EMAIL TYPES
// ============================================================================

interface EmailParams {
  to: string | string[]
  subject: string
  html: string
  emailType: 'RECORDATORIO' | 'NOTIFICACION' | 'CONFIRMACION' | 'EN_FECHA' | 'INCUMPLIDO' | 'CREDENCIALES'
}

interface RequestEmailData {
  requestDescription: string
  requesterDeptName: string
  providerDeptName: string
  deadlineDate: string
  priority: string
  requestId?: string
  currentStatus?: string
  customMessage?: string
}

// ============================================================================
// HTML TEMPLATE HELPERS
// ============================================================================

function getStatusColor(status: string): string {
  switch (status) {
    case 'CUMPLIDO': return '#059669'
    case 'EN_FECHA': return '#d97706'
    case 'INCUMPLIDO': return '#dc2626'
    case 'SOLICITADO': return '#475569'
    default: return '#475569'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'CUMPLIDO': return 'Cumplido'
    case 'EN_FECHA': return 'En Fecha'
    case 'INCUMPLIDO': return 'Incumplido'
    case 'SOLICITADO': return 'Solicitado'
    default: return status
  }
}

function getPriorityLabel(priority: string): string {
  switch (priority) {
    case 'ALTA': return '🔴 Alta'
    case 'NORMAL': return '⚪ Normal'
    case 'BAJA': return '🟢 Baja'
    default: return priority
  }
}

function formatDateEs(dateStr: string): string {
  const date = new Date(dateStr)
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`
}

function baseTemplate(title: string, content: string, footer?: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e3a5f 0%,#1e40af 100%);padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">GEOCUBA Camagüey - Ciego de Ávila</h1>
                    <p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Sistema de Control de Entrega de Informaciones</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Title Bar -->
          <tr>
            <td style="padding:20px 32px 0;">
              <h2 style="margin:0;color:#1e3a5f;font-size:16px;font-weight:700;">${title}</h2>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:16px 32px;">
              ${content}
            </td>
          </tr>
          ${footer ? `<!-- Footer --><tr><td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;">${footer}</td></tr>` : ''}
          <!-- Bottom -->
          <tr>
            <td style="background-color:#0f172a;padding:16px 32px;text-align:center;">
              <p style="margin:0;color:#64748b;font-size:11px;">© ${new Date().getFullYear()} GEOCUBA Camagüey - Ciego de Ávila · Sistema de Control de Entrega de Informaciones</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function requestInfoBlock(data: RequestEmailData): string {
  const statusBadge = data.currentStatus
    ? `<span style="display:inline-block;background-color:${getStatusColor(data.currentStatus)};color:#fff;font-size:11px;font-weight:600;padding:3px 10px;border-radius:12px;margin-left:8px;">${getStatusLabel(data.currentStatus)}</span>`
    : ''

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
              <span style="color:#64748b;font-size:12px;font-weight:500;">Descripción</span><br>
              <span style="color:#1e293b;font-size:14px;font-weight:600;">${data.requestDescription}</span>
              ${statusBadge}
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:4px 0;">
                    <span style="color:#64748b;font-size:11px;">Solicitante</span><br>
                    <span style="color:#1e293b;font-size:13px;font-weight:500;">${data.requesterDeptName}</span>
                  </td>
                  <td width="50%" style="padding:4px 0;">
                    <span style="color:#64748b;font-size:11px;">Proveedor</span><br>
                    <span style="color:#1e293b;font-size:13px;font-weight:500;">${data.providerDeptName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:4px 0;">
                    <span style="color:#64748b;font-size:11px;">Fecha Límite</span><br>
                    <span style="color:#1e293b;font-size:13px;font-weight:600;">${formatDateEs(data.deadlineDate)}</span>
                  </td>
                  <td width="50%" style="padding:4px 0;">
                    <span style="color:#64748b;font-size:11px;">Prioridad</span><br>
                    <span style="color:#1e293b;font-size:13px;font-weight:500;">${getPriorityLabel(data.priority)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`
}

// ============================================================================
// EMAIL TEMPLATE FUNCTIONS
// ============================================================================

/**
 * Template for reminder emails (RECORDATORIO)
 */
export function reminderTemplate(data: RequestEmailData): string {
  const content = `
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">
      Le informamos que la siguiente solicitud de información está pendiente de entrega y requiere su atención:
    </p>
    ${requestInfoBlock(data)}
    ${data.customMessage ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fbbf24;border-radius:8px;margin-top:12px;">
      <tr>
        <td style="padding:12px 16px;">
          <span style="color:#92400e;font-size:12px;font-weight:600;">💬 Mensaje del solicitante:</span><br>
          <span style="color:#78350f;font-size:13px;">${data.customMessage}</span>
        </td>
      </tr>
    </table>` : ''}
    <p style="margin:16px 0 0;color:#475569;font-size:13px;line-height:1.5;">
      Por favor, entregue la información solicitada antes de la fecha límite para evitar que la solicitud sea marcada como <strong style="color:#dc2626;">INCUMPLIDA</strong>.
    </p>`

  const footer = `<p style="margin:0;color:#64748b;font-size:12px;">Este correo fue enviado automáticamente por el Sistema de Control de Entrega de Informaciones.</p>`

  return baseTemplate('⏰ Recordatorio de Solicitud Pendiente', content, footer)
}

/**
 * Template for new request notification (NOTIFICACION)
 */
export function newRequestTemplate(data: RequestEmailData): string {
  const content = `
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">
      Se ha registrado una nueva solicitud de información que requiere su atención:
    </p>
    ${requestInfoBlock(data)}
    <p style="margin:16px 0 0;color:#475569;font-size:13px;line-height:1.5;">
      Por favor, prepare y entregue la información solicitada antes de la fecha límite indicada.
    </p>`

  const footer = `<p style="margin:0;color:#64748b;font-size:12px;">Este correo fue enviado automáticamente por el Sistema de Control de Entrega de Informaciones.</p>`

  return baseTemplate('📋 Nueva Solicitud de Información', content, footer)
}

/**
 * Template for completion confirmation (CONFIRMACION)
 */
export function completionTemplate(data: RequestEmailData): string {
  const content = `
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">
      Nos complace informarle que la siguiente solicitud de información ha sido <strong style="color:#059669;">completada exitosamente</strong>:
    </p>
    ${requestInfoBlock({ ...data, currentStatus: 'CUMPLIDO' })}
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ecfdf5;border:1px solid #34d399;border-radius:8px;margin-top:12px;">
      <tr>
        <td style="padding:12px 16px;text-align:center;">
          <span style="color:#065f46;font-size:15px;font-weight:600;">✅ Solicitud Cumplida</span>
        </td>
      </tr>
    </table>`

  const footer = `<p style="margin:0;color:#64748b;font-size:12px;">Este correo fue enviado automáticamente por el Sistema de Control de Entrega de Informaciones.</p>`

  return baseTemplate('✅ Solicitud Completada', content, footer)
}

/**
 * Template for overdue/INCUMPLIDO notification
 */
export function overdueTemplate(data: RequestEmailData): string {
  const content = `
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">
      Le informamos que la siguiente solicitud de información ha sido marcada como <strong style="color:#dc2626;">INCUMPLIDA</strong> por no haberse entregado en el plazo establecido:
    </p>
    ${requestInfoBlock({ ...data, currentStatus: 'INCUMPLIDO' })}
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border:1px solid #fca5a5;border-radius:8px;margin-top:12px;">
      <tr>
        <td style="padding:12px 16px;">
          <span style="color:#991b1b;font-size:13px;font-weight:600;">⚠️ Afectación registrada</span><br>
          <span style="color:#7f1d1d;font-size:12px;">Se ha registrado una afectación de 0.1 puntos por incumplimiento. Las afectaciones acumuladas serán evaluadas por la Comisión de Cumplimiento.</span>
        </td>
      </tr>
    </table>`

  const footer = `<p style="margin:0;color:#64748b;font-size:12px;">Este correo fue enviado automáticamente por el Sistema de Control de Entrega de Informaciones.</p>`

  return baseTemplate('⚠️ Solicitud Incumplida', content, footer)
}

/**
 * Template for EN_FECHA (deadline approaching) notification
 */
export function deadlineApproachingTemplate(data: RequestEmailData): string {
  const content = `
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">
      Le informamos que el plazo de la siguiente solicitud está próximo a vencer:
    </p>
    ${requestInfoBlock({ ...data, currentStatus: 'EN_FECHA' })}
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffbeb;border:1px solid #fbbf24;border-radius:8px;margin-top:12px;">
      <tr>
        <td style="padding:12px 16px;text-align:center;">
          <span style="color:#92400e;font-size:14px;font-weight:600;">⏳ El plazo vence pronto</span><br>
          <span style="color:#78350f;font-size:12px;">La solicitud ha cambiado al estado "En Fecha". Por favor entregue la información a la brevedad.</span>
        </td>
      </tr>
    </table>`

  const footer = `<p style="margin:0;color:#64748b;font-size:12px;">Este correo fue enviado automáticamente por el Sistema de Control de Entrega de Informaciones.</p>`

  return baseTemplate('⏳ Plazo Próximo a Vencer', content, footer)
}

/**
 * Template for login credentials email (CREDENCIALES)
 */
export function credentialsTemplate(data: {
  responsibleName: string
  departmentName: string
  email: string
  tempPassword: string
  token: string
  appUrl: string
}): string {
  const content = `
    <p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.5;">
      Estimado/a <strong>${data.responsibleName}</strong>,
    </p>
    <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5;">
      Se ha creado su cuenta en el Sistema de Control de Entrega de Informaciones de GEOCUBA Camagüey - Ciego de Ávila. A continuación encontrará sus credenciales de acceso:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;font-weight:500;">Dirección / Unidad</span><br>
                <span style="color:#1e293b;font-size:14px;font-weight:600;">${data.departmentName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;font-weight:500;">Correo de Acceso</span><br>
                <span style="color:#1e293b;font-size:14px;font-weight:600;">${data.email}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <span style="color:#64748b;font-size:12px;font-weight:500;">Contraseña Temporal</span><br>
                <span style="color:#dc2626;font-size:18px;font-weight:700;letter-spacing:2px;font-family:monospace;">${data.tempPassword}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 0;">
                <span style="color:#64748b;font-size:12px;font-weight:500;">Token de Seguridad</span><br>
                <span style="color:#1e40af;font-size:16px;font-weight:700;letter-spacing:1px;font-family:monospace;word-break:break-all;">${data.token}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#eff6ff;border:1px solid #93c5fd;border-radius:8px;margin-top:16px;">
      <tr>
        <td style="padding:12px 16px;">
          <span style="color:#1e40af;font-size:13px;font-weight:600;">📌 Instrucciones para su primer acceso:</span><br>
          <ol style="margin:8px 0 0;padding-left:20px;color:#1e3a5f;font-size:13px;line-height:1.8;">
            <li>Acceda al sistema en <a href="${data.appUrl}" style="color:#2563eb;font-weight:500;">${data.appUrl}</a></li>
            <li>Ingrese su correo y la <strong>contraseña temporal</strong></li>
            <li>El sistema le pedirá el <strong>token de seguridad</strong> para verificar su identidad</li>
            <li>Cree su nueva contraseña personal</li>
          </ol>
        </td>
      </tr>
    </table>
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fef2f2;border:1px solid #fca5a5;border-radius:8px;margin-top:12px;">
      <tr>
        <td style="padding:10px 16px;">
          <span style="color:#991b1b;font-size:12px;font-weight:600;">⚠️ Importante:</span>
          <span style="color:#7f1d1d;font-size:12px;">Esta contraseña y token son de un solo uso. Guárdelos en un lugar seguro y no los comparta con nadie.</span>
        </td>
      </tr>
    </table>`

  const footer = `<p style="margin:0;color:#64748b;font-size:12px;">Este correo fue enviado automáticamente por el Sistema de Control de Entrega de Informaciones. Si no solicitó este acceso, ignore este correo.</p>`

  return baseTemplate('🔐 Credenciales de Acceso al Sistema', content, footer)
}

// ============================================================================
// SEND EMAIL FUNCTION - SMTP ONLY (Production)
// ============================================================================

/**
 * Send email via SMTP (GEOCUBA Exchange Server)
 * Production-ready - sends directly to any internal GEOCUBA address
 */
export async function sendEmail(params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { to, subject, html, emailType } = params
    const recipients = Array.isArray(to) ? to : [to]

    const transport = getTransporter()

    const result = await transport.sendMail({
      from: SMTP_FROM,
      to: recipients.join(', '),
      subject,
      html,
      headers: {
        'X-Mailer': 'GEOCUBA-SCEI',
        'X-Priority': emailType === 'RECORDATORIO' ? '1' : emailType === 'INCUMPLIDO' ? '1' : '3',
        'X-Email-Type': emailType,
      },
    })

    console.log(`[SMTP SENT] Type: ${emailType}, To: ${recipients.join(', ')}, Subject: ${subject}, MessageId: ${result.messageId}`)
    return { success: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[SMTP ERROR] Type: ${params.emailType}, To: ${Array.isArray(params.to) ? params.to.join(', ') : params.to}, Error:`, errorMessage)

    // Reset transporter on connection errors so it's recreated next time
    transporter = null

    return { success: false, error: errorMessage }
  }
}
