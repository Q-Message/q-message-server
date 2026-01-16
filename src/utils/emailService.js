const axios = require('axios');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_URL = 'https://api.resend.com/emails';

/**
 * Enviar código de verificación por email
 * @param {string} to - Email del destinatario
 * @param {string} username - Username del usuario
 * @param {string} verificationCode - Código de 6 dígitos
 * @returns {Promise<object>} Respuesta de Resend
 */
async function sendVerificationCode(to, username, verificationCode) {
  try {
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const response = await axios.post(
      RESEND_URL,
      {
        from: 'Q-Message <onboarding@resend.dev>',
        to: to,
        subject: `${verificationCode} - Tu código de verificación de Q-Message`,
        html: `
          <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Verifica tu cuenta - Q-Message</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0014 0%, #1a0a2e 100%);">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0a0014 0%, #1a0a2e 100%); padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.03); border-radius: 24px; backdrop-filter: blur(10px); border: 1px solid rgba(168, 85, 247, 0.2); overflow: hidden; box-shadow: 0 20px 60px rgba(168, 85, 247, 0.15);">
                                
                                <!-- Header -->
                                <tr>
                                    <td align="center" style="padding: 50px 40px 30px;">
                                        <img src="https://i.imgur.com/your-logo.png" alt="Q-Message" width="80" height="80" style="display: block; margin: 0 auto 20px;">
                                        <h1 style="margin: 0; color: #a855f7; font-size: 32px; font-weight: 600; letter-spacing: -0.5px;">Q-MESSAGE</h1>
                                        <p style="margin: 8px 0 0; color: #9ca3af; font-size: 14px; letter-spacing: 0.5px;">CIFRADO CUÁNTICO</p>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 20px 40px;">
                                        <h2 style="margin: 0 0 16px; color: #e9d5ff; font-size: 24px; font-weight: 500; text-align: center;">Verifica tu cuenta</h2>
                                        <p style="margin: 0 0 30px; color: #d1d5db; font-size: 16px; line-height: 1.6; text-align: center;">
                                            Para completar tu registro, introduce el siguiente código de verificación en la aplicación:
                                        </p>
                                        
                                        <!-- Verification Code Box -->
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="padding: 30px 0;">
                                                    <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%); border: 2px solid #a855f7; border-radius: 16px; padding: 24px 48px; display: inline-block; box-shadow: 0 0 30px rgba(168, 85, 247, 0.3);">
                                                        <span style="font-size: 48px; font-weight: 700; letter-spacing: 12px; color: #c084fc; font-family: 'Courier New', monospace; text-shadow: 0 0 20px rgba(168, 85, 247, 0.5);">
                                                          ${verificationCode}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin: 30px 0 0; color: #9ca3af; font-size: 14px; line-height: 1.5; text-align: center;">
                                            Este código expirará en <strong style="color: #c084fc;">5 minutos</strong>
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Security Info -->
                                <tr>
                                    <td style="padding: 30px 40px; border-top: 1px solid rgba(168, 85, 247, 0.15);">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td align="center" style="padding-bottom: 15px;">
                                                    <div style="display: inline-block; background: rgba(168, 85, 247, 0.1); border-radius: 50%; padding: 12px; width: 40px; height: 40px;">
                                                        <span style="font-size: 24px;">🔐</span>
                                                    </div>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>
                                                    <p style="margin: 0; color: #d1d5db; font-size: 13px; line-height: 1.6; text-align: center;">
                                                        <strong style="color: #e9d5ff;">Seguridad cuántica</strong><br>
                                                        Tus mensajes están protegidos con cifrado resistente a ordenadores cuánticos.
                                                    </p>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(168, 85, 247, 0.1);">
                                        <p style="margin: 0 0 10px; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5;">
                                            Si no has solicitado este código, puedes ignorar este mensaje.
                                        </p>
                                        <p style="margin: 0; color: #6b7280; font-size: 11px; text-align: center;">
                                            © 2026 Q-Message. Comunicación segura para el futuro.
                                        </p>
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Email de verificación enviado a ${to}`);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('❌ Error enviando email:', error.message);
    return { success: false, error: error.message };
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
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY not configured');
      return { success: false, error: 'Email service not configured' };
    }

    const response = await axios.post(
      RESEND_URL,
      {
        from: 'Q-Message <onboarding@resend.dev>',
        to: to,
        subject: 'Cuenta verificada - Q-Message',
        html: `
          <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bienvenido a Q-Message</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: linear-gradient(135deg, #0a0014 0%, #1a0a2e 100%);">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #0a0014 0%, #1a0a2e 100%); padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table width="600" cellpadding="0" cellspacing="0" style="background: rgba(255, 255, 255, 0.03); border-radius: 24px; backdrop-filter: blur(10px); border: 1px solid rgba(168, 85, 247, 0.2); overflow: hidden; box-shadow: 0 20px 60px rgba(168, 85, 247, 0.15);">
                                
                                <!-- Header -->
                                <tr>
                                    <td align="center" style="padding: 50px 40px 30px;">
                                        <img src="https://i.imgur.com/your-logo.png" alt="Q-Message" width="80" height="80" style="display: block; margin: 0 auto 20px;">
                                        <h1 style="margin: 0; color: #a855f7; font-size: 32px; font-weight: 600; letter-spacing: -0.5px;">Q-MESSAGE</h1>
                                        <p style="margin: 8px 0 0; color: #9ca3af; font-size: 14px; letter-spacing: 0.5px;">CIFRADO CUÁNTICO</p>
                                    </td>
                                </tr>
                                
                                <!-- Success Icon -->
                                <tr>
                                    <td align="center" style="padding: 20px 40px 30px;">
                                        <div style="display: inline-block; background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%); border-radius: 50%; padding: 20px; box-shadow: 0 0 40px rgba(168, 85, 247, 0.4);">
                                            <span style="font-size: 64px;">✓</span>
                                        </div>
                                    </td>
                                </tr>
                                
                                <!-- Content -->
                                <tr>
                                    <td style="padding: 0 40px 30px;">
                                        <h2 style="margin: 0 0 16px; color: #e9d5ff; font-size: 28px; font-weight: 500; text-align: center;">¡Cuenta verificada!</h2>
                                        <p style="margin: 0 0 24px; color: #d1d5db; font-size: 16px; line-height: 1.6; text-align: center;">
                                            ${username}, tu cuenta ha sido verificada exitosamente. Bienvenido a la próxima generación de mensajería segura.
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Features -->
                                <tr>
                                    <td style="padding: 0 40px 40px;">
                                        <table width="100%" cellpadding="0" cellspacing="0">
                                            <tr>
                                                <td style="padding: 20px; background: rgba(168, 85, 247, 0.05); border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.1); margin-bottom: 15px;">
                                                    <table width="100%">
                                                        <tr>
                                                            <td width="40" valign="top">
                                                                <span style="font-size: 28px;">🔐</span>
                                                            </td>
                                                            <td style="padding-left: 15px;">
                                                                <h3 style="margin: 0 0 6px; color: #c084fc; font-size: 16px; font-weight: 600;">Cifrado post-cuántico</h3>
                                                                <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
                                                                    Protección contra amenazas de computación cuántica
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr><td height="15"></td></tr>
                                            <tr>
                                                <td style="padding: 20px; background: rgba(168, 85, 247, 0.05); border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.1); margin-bottom: 15px;">
                                                    <table width="100%">
                                                        <tr>
                                                            <td width="40" valign="top">
                                                                <span style="font-size: 28px;">⚡</span>
                                                            </td>
                                                            <td style="padding-left: 15px;">
                                                                <h3 style="margin: 0 0 6px; color: #c084fc; font-size: 16px; font-weight: 600;">Mensajería instantánea</h3>
                                                                <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
                                                                    Comunicación rápida sin comprometer la seguridad
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr><td height="15"></td></tr>
                                            <tr>
                                                <td style="padding: 20px; background: rgba(168, 85, 247, 0.05); border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.1);">
                                                    <table width="100%">
                                                        <tr>
                                                            <td width="40" valign="top">
                                                                <span style="font-size: 28px;">🛡️</span>
                                                            </td>
                                                            <td style="padding-left: 15px;">
                                                                <h3 style="margin: 0 0 6px; color: #c084fc; font-size: 16px; font-weight: 600;">Privacidad total</h3>
                                                                <p style="margin: 0; color: #9ca3af; font-size: 14px; line-height: 1.5;">
                                                                    Tus conversaciones son solo tuyas, siempre
                                                                </p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                
                                <!-- Footer Info -->
                                <tr>
                                    <td style="padding: 30px 40px; border-top: 1px solid rgba(168, 85, 247, 0.15);">
                                        <p style="margin: 0 0 15px; color: #d1d5db; font-size: 13px; line-height: 1.6; text-align: center;">
                                            <strong style="color: #e9d5ff;">Empieza a chatear de forma segura</strong><br>
                                            Invita a tus contactos y disfruta de conversaciones protegidas con tecnología del futuro.
                                        </p>
                                    </td>
                                </tr>
                                
                                <!-- Footer -->
                                <tr>
                                    <td style="padding: 30px 40px; background: rgba(0, 0, 0, 0.2); border-top: 1px solid rgba(168, 85, 247, 0.1);">
                                        <p style="margin: 0 0 10px; color: #9ca3af; font-size: 12px; text-align: center; line-height: 1.5;">
                                            ¿Necesitas ayuda? Visita nuestro centro de soporte
                                        </p>
                                        <p style="margin: 0; color: #6b7280; font-size: 11px; text-align: center;">
                                            © 2026 Q-Message. Comunicación segura para el futuro.
                                        </p>
                                    </td>
                                </tr>
                                
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `,
      },
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`✅ Email de bienvenida enviado a ${to}`);
    return { success: true, messageId: response.data.id };
  } catch (error) {
    console.error('❌ Error enviando email de bienvenida:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendVerificationCode,
  sendWelcomeEmail,
};
