import axios from 'axios';
import crypto from 'crypto';

// Configuración de Nequi (debes obtener estas credenciales de Nequi Business)
const NEQUI_CONFIG = {
  clientId: process.env.NEQUI_CLIENT_ID || '',
  clientSecret: process.env.NEQUI_CLIENT_SECRET || '',
  apiKey: process.env.NEQUI_API_KEY || '',
  // URL de Nequi (producción o sandbox)
  baseURL: process.env.NEQUI_ENV === 'production' 
    ? 'https://api.nequi.com.co' 
    : 'https://sandbox.nequi.com.co/v1',
  // Teléfono de Nequi del negocio
  businessPhone: process.env.NEQUI_BUSINESS_PHONE || ''
};

/**
 * Genera un código QR de Nequi para pago
 */
export async function generateNequiPayment(amount, reference, description) {
  try {
    // Obtener token de acceso
    const token = await getAccessToken();
    
    // Crear solicitud de pago push (notificación al cliente)
    const paymentData = {
      phoneNumber: NEQUI_CONFIG.businessPhone,
      code: reference,
      value: amount,
      reference1: reference,
      reference2: description,
      reference3: 'Rockola Ciudad Gotica'
    };

    const response = await axios.post(
      `${NEQUI_CONFIG.baseURL}/payments/v2/-services-paymentservice-generatecodeqr`,
      paymentData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-key': NEQUI_CONFIG.apiKey
        }
      }
    );

    return {
      success: true,
      qrCode: response.data.qrCode,
      reference: reference,
      amount: amount
    };
  } catch (error) {
    console.error('Error generando pago Nequi:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Obtener token de acceso de Nequi
 */
async function getAccessToken() {
  try {
    const auth = Buffer.from(`${NEQUI_CONFIG.clientId}:${NEQUI_CONFIG.clientSecret}`).toString('base64');
    
    const response = await axios.post(
      `${NEQUI_CONFIG.baseURL}/oauth/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return response.data.access_token;
  } catch (error) {
    console.error('Error obteniendo token Nequi:', error);
    throw error;
  }
}

/**
 * Consultar estado de un pago
 */
export async function checkPaymentStatus(reference) {
  // Si no hay credenciales configuradas, retornar pago no confirmado
  if (!NEQUI_CONFIG.clientId || !NEQUI_CONFIG.clientSecret || !NEQUI_CONFIG.apiKey) {
    console.warn('⚠️  Credenciales de Nequi no configuradas. Modo desarrollo.');
    return {
      success: false,
      paid: false,
      error: 'Credenciales de Nequi no configuradas'
    };
  }

  try {
    const token = await getAccessToken();
    
    const response = await axios.post(
      `${NEQUI_CONFIG.baseURL}/payments/v2/-services-paymentservice-getstatuspayment`,
      {
        reference1: reference
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'x-api-key': NEQUI_CONFIG.apiKey
        }
      }
    );

    return {
      success: true,
      status: response.data.status,
      paid: response.data.status === 'APPROVED',
      reference: reference
    };
  } catch (error) {
    console.error('Error consultando estado de pago:', error.response?.data || error.message);
    return {
      success: false,
      paid: false,
      error: error.message
    };
  }
}

/**
 * Webhook para notificaciones de Nequi
 */
export function validateNequiWebhook(signature, payload, secret) {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return hash === signature;
}
