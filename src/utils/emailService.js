const axios = require('axios');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Construir HTML optimizado y completo del email de verificación
 */
function buildVerificationHTML(code) {
  // HTML compacto pero completo - evita truncamiento y problemas de encoding
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifica tu cuenta</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0014"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0014;padding:40px 20px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border-radius:16px;border:1px solid rgba(168,85,247,0.2)"><tr><td align="center" style="padding:40px 30px;border-bottom:1px solid rgba(168,85,247,0.1)"><h1 style="margin:0;color:#a855f7;font-size:28px;font-weight:600">Q-MESSAGE</h1><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">CIFRADO CUANTICO</p></td></tr><tr><td style="padding:40px 30px"><h2 style="margin:0 0 16px;color:#e9d5ff;font-size:22px;text-align:center">Verifica tu cuenta</h2><p style="margin:0 0 30px;color:#d1d5db;font-size:14px;line-height:1.6;text-align:center">Introduce este codigo en la aplicacion:</p><div style="background:rgba(168,85,247,0.1);border:2px solid #a855f7;border-radius:12px;padding:24px;text-align:center;margin:30px 0"><span style="font-size:44px;font-weight:700;letter-spacing:8px;color:#c084fc;font-family:monospace">${code}</span></div><p style="margin:20px 0 0;color:#9ca3af;font-size:13px;text-align:center">Expira en: <strong>5 minutos</strong></p></td></tr><tr><td style="padding:20px 30px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(168,85,247,0.1);text-align:center"><p style="margin:0;color:#6b7280;font-size:11px">© 2026 Q-Message</p></td></tr></table></td></tr></table></body></html>`;
}

/**
 * Construir HTML optimizado del email de bienvenida
 */
function buildWelcomeHTML(username) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bienvenido!</title></head><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#0a0014"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0014;padding:40px 20px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border-radius:16px;border:1px solid rgba(168,85,247,0.2)"><tr><td align="center" style="padding:40px 30px;border-bottom:1px solid rgba(168,85,247,0.1)"><h1 style="margin:0;color:#a855f7;font-size:28px;font-weight:600">Q-MESSAGE</h1><p style="margin:8px 0 0;color:#9ca3af;font-size:12px">CIFRADO CUANTICO</p></td></tr><tr><td style="padding:40px 30px"><div style="text-align:center;margin-bottom:24px;font-size:48px">✓</div><h2 style="margin:0 0 12px;color:#e9d5ff;font-size:22px;text-align:center">Cuenta verificada!</h2><p style="margin:0 0 24px;color:#d1d5db;font-size:14px;line-height:1.6;text-align:center">${username}, bienvenido a Q-Message. Tu cuenta esta lista para usar.</p><div style="background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.1);border-radius:8px;padding:16px;margin:24px 0;font-size:13px;color:#d1d5db"><strong style="color:#c084fc">Cifrado Post-Cuantico</strong><br>Mensajes protegidos contra amenazas futuras.</div></td></tr><tr><td style="padding:20px 30px;background:rgba(0,0,0,0.2);border-top:1px solid rgba(168,85,247,0.1);text-align:center"><p style="margin:0;color:#6b7280;font-size:11px">© 2026 Q-Message</p></td></tr></table></td></tr></table></body></html>`;
}

/**
 * Enviar código de verificación por email
 * @param {string} to - Email del destinatario
 * @param {string} username - Username del usuario
 * @param {string} verificationCode - Código de 6 dígitos
 * @returns {Promise<object>} Respuesta de Resend
 */
async function sendVerificationCode(to, username, verificationCode) {
  try {
    // Validaciones previas
    if (!RESEND_API_KEY) {
      console.error('ERROR: RESEND_API_KEY no configurada');
      return { success: false, error: 'Email service not configured' };
    }

    // Validar email
    if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      console.error('ERROR: Email invalido:', to);
      return { success: false, error: 'Invalid email' };
    }

    // Validar código (debe ser exactamente 6 dígitos)
    if (!verificationCode || !/^\d{6}$/.test(verificationCode.toString())) {
      console.error('ERROR: Codigo de verificacion invalido:', verificationCode);
      return { success: false, error: 'Invalid verification code' };
    }

    const htmlContent = buildVerificationHTML(verificationCode);

    // Payload optimizado
    const payload = {
      from: 'Q-Message <verificacion@qmessage.info>',
      to: to,
      subject: 'Tu codigo de verificacion - Q-Message',
      html: htmlContent,
    };

    // Request con timeout
    const response = await axios.post(RESEND_URL, payload, {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000, // 15 segundos timeout
      maxRedirects: 3,
    });

    // Validar respuesta
    if (!response.data || !response.data.id) {
      throw new Error('Invalid response from Resend API');
    }

    console.log(`OK: Email enviado a ${to} - ID: ${response.data.id}`);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`ERROR: Enviando email a ${to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Enviar email de bienvenida después de verificación
 * @param {string} to - Email del destinatario
 * @param {string} username - Username del usuario
 * @returns {Promise<object>} Respuesta de Resend
 */
async function sendWelcomeEmail(to, username) {
  try {
    // Validaciones previas
    if (!RESEND_API_KEY) {
      console.error('ERROR: RESEND_API_KEY no configurada');
      return { success: false, error: 'Email service not configured' };
    }

    // Validar email
    if (!to || typeof to !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      console.error('ERROR: Email invalido:', to);
      return { success: false, error: 'Invalid email' };
    }

    // Validar username
    if (!username || typeof username !== 'string') {
      console.error('ERROR: Username invalido:', username);
      return { success: false, error: 'Invalid username' };
    }

    const htmlContent = buildWelcomeHTML(username);

    const payload = {
      from: 'Q-Message <verificacion@qmessage.info>',
      to: to,
      subject: 'Cuenta verificada - Q-Message',
      html: htmlContent,
    };

    const response = await axios.post(RESEND_URL, payload, {
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      maxRedirects: 3,
    });

    if (!response.data || !response.data.id) {
      throw new Error('Invalid response from Resend API');
    }

    console.log(`OK: Email de bienvenida enviado a ${to} - ID: ${response.data.id}`);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`ERROR: Enviando email a ${to}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

module.exports = {
  sendVerificationCode,
  sendWelcomeEmail,
};
