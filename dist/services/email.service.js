"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailConfigured = void 0;
exports.sendInvitationEmail = sendInvitationEmail;
const mail_1 = __importDefault(require("@sendgrid/mail"));
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'no-reply@futcademic.com';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Futcademic';
if (SENDGRID_API_KEY) {
    mail_1.default.setApiKey(SENDGRID_API_KEY);
}
const ROLE_LABELS = {
    super_admin: 'Super administrador',
    admin: 'Administrador',
    profesor: 'Profesor',
    padre: 'Padre de familia',
    alumno: 'Alumno',
};
const isEmailConfigured = () => !!SENDGRID_API_KEY;
exports.isEmailConfigured = isEmailConfigured;
/**
 * Envía la invitación con SendGrid (Twilio) usando HTML personalizado con el
 * estilo de la app. Supabase solo genera el token de activación; el correo lo
 * mandamos nosotros para poder controlar el diseño.
 *
 * Si SENDGRID_API_KEY no está configurada, no falla: registra un aviso y
 * devuelve false para que el caller decida qué informar.
 */
async function sendInvitationEmail(params) {
    if (!SENDGRID_API_KEY) {
        console.warn('[email] SENDGRID_API_KEY no configurada — se omite el envío de la invitación.');
        return false;
    }
    try {
        await mail_1.default.send({
            to: params.to,
            from: { email: FROM_EMAIL, name: FROM_NAME },
            subject: `Te invitaron a ${params.schoolName || 'Futcademic'}`,
            html: buildInvitationHtml(params),
        });
        return true;
    }
    catch (err) {
        console.error('[email] Error enviando invitación con SendGrid:', err?.response?.body || err);
        throw err;
    }
}
function buildInvitationHtml({ fullName, role, schoolName, activationLink }) {
    const roleLabel = ROLE_LABELS[role] || role;
    const brand = schoolName || 'Futcademic';
    const green = '#2f9e44';
    const greenDark = '#237a34';
    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitación a ${escapeHtml(brand)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f3f5;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f3f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.06);">
          <tr>
            <td style="background:linear-gradient(135deg,${green},${greenDark});padding:32px 32px 24px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.3px;">${escapeHtml(brand)}</div>
              <div style="font-size:13px;color:#e6fcf5;margin-top:4px;">Gestión de academia de fútbol</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:20px;color:#212529;">¡Hola, ${escapeHtml(fullName)}!</h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#495057;">
                Fuiste invitado a <strong>${escapeHtml(brand)}</strong> como
                <strong style="color:${greenDark};">${escapeHtml(roleLabel)}</strong>.
                Activa tu cuenta y crea tu contraseña para empezar.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="${activationLink}" target="_blank"
                       style="display:inline-block;background-color:${green};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:10px;">
                      Activar mi cuenta
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#868e96;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0;font-size:12px;line-height:1.5;color:${greenDark};word-break:break-all;">
                ${activationLink}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background-color:#f8f9fa;text-align:center;">
              <p style="margin:0;font-size:12px;color:#adb5bd;">
                Si no esperabas esta invitación, puedes ignorar este correo.
              </p>
            </td>
          </tr>
        </table>
        <p style="max-width:480px;margin:16px auto 0;font-size:11px;color:#adb5bd;text-align:center;">
          © ${new Date().getFullYear()} ${escapeHtml(brand)} · Enviado por Futcademic
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
function escapeHtml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
