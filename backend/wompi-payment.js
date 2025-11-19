import axios from 'axios';
import crypto from 'crypto';

/**
 * Integración con Wompi para pagos en línea
 * Documentación: https://docs.wompi.co/
 */
class WompiPayment {
  constructor(clientConfig) {
    if (!clientConfig.payments || !clientConfig.payments.wompi) {
      throw new Error('Configuración de Wompi no encontrada');
    }

    const wompiConfig = clientConfig.payments.wompi;
    
    this.publicKey = wompiConfig.publicKey;
    this.privateKey = wompiConfig.privateKey;
    this.integritySecret = wompiConfig.integritySecret;
    this.currency = wompiConfig.currency || 'COP';
    this.environment = wompiConfig.environment || 'production';
    this.clientId = clientConfig.clientId;
    
    // URLs según ambiente
    this.baseURL = this.environment === 'production' 
      ? 'https://production.wompi.co/v1'
      : 'https://sandbox.wompi.co/v1';

    console.log(`💳 Wompi inicializado para ${this.clientId} en modo ${this.environment}`);
  }

  /**
   * Genera firma de integridad requerida por Wompi
   */
  generateIntegrity(reference, amountInCents) {
    const data = `${reference}${amountInCents}${this.currency}${this.integritySecret}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Crea un enlace de pago para prioridad de canción
   */
  async createPriorityPayment(songId, songTitle, amount, userInfo = {}) {
    const reference = `PRIORITY_${this.clientId.toUpperCase()}_${songId}_${Date.now()}`;
    const amountInCents = amount * 100; // Wompi usa centavos

    const integrity = this.generateIntegrity(reference, amountInCents);

    const payload = {
      public_key: this.publicKey,
      currency: this.currency,
      amount_in_cents: amountInCents,
      reference: reference,
      redirect_url: `https://${this.domain}/payment-success?ref=${reference}`,
      
      // Información adicional
      customer_data: {
        phone_number: userInfo.phone || '',
        full_name: userInfo.name || 'Cliente Rockola'
      },
      
      // Métodos de pago disponibles
      payment_methods: {
        installments: [1]
      },
      
      // Metadata personalizada
      metadata: {
        songId: songId,
        songTitle: songTitle,
        clientId: this.clientId,
        type: 'priority'
      }
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/payment_links`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.privateKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentUrl: response.data.data.permalink,
        paymentId: response.data.data.id,
        reference: reference,
        amount: amount,
        integrity: integrity
      };
    } catch (error) {
      console.error('❌ Error creando pago Wompi:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.error?.reason || error.message
      };
    }
  }

  /**
   * Verifica el estado de una transacción
   */
  async verifyTransaction(transactionId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`
          }
        }
      );

      const data = response.data.data;

      return {
        paid: data.status === 'APPROVED',
        status: data.status,
        reference: data.reference,
        amount: data.amount_in_cents / 100,
        currency: data.currency,
        paymentMethod: data.payment_method_type,
        createdAt: data.created_at,
        finalizedAt: data.finalized_at,
        metadata: data.metadata
      };
    } catch (error) {
      console.error('❌ Error verificando transacción:', error.response?.data || error.message);
      return {
        paid: false,
        error: error.message
      };
    }
  }

  /**
   * Verifica el estado de un pago por referencia
   */
  async verifyPaymentByReference(reference) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transactions?reference=${reference}`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`
          }
        }
      );

      if (response.data.data && response.data.data.length > 0) {
        const transaction = response.data.data[0];
        return this.verifyTransaction(transaction.id);
      }

      return {
        paid: false,
        status: 'NOT_FOUND',
        error: 'Transacción no encontrada'
      };
    } catch (error) {
      console.error('❌ Error verificando por referencia:', error.message);
      return {
        paid: false,
        error: error.message
      };
    }
  }

  /**
   * Valida webhook de Wompi (para confirmaciones en tiempo real)
   */
  validateWebhook(signature, payload) {
    const calculatedSignature = crypto
      .createHmac('sha256', this.integritySecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === calculatedSignature;
  }

  /**
   * Procesa evento de webhook
   */
  async processWebhookEvent(event) {
    const { event: eventType, data } = event;

    console.log(`📨 Webhook recibido: ${eventType} para transacción ${data.transaction.id}`);

    switch (eventType) {
      case 'transaction.updated':
        if (data.transaction.status === 'APPROVED') {
          return {
            type: 'payment_approved',
            transactionId: data.transaction.id,
            reference: data.transaction.reference,
            amount: data.transaction.amount_in_cents / 100,
            metadata: data.transaction.metadata
          };
        }
        break;

      case 'transaction.created':
        return {
          type: 'payment_created',
          transactionId: data.transaction.id,
          reference: data.transaction.reference
        };

      default:
        console.log(`ℹ️ Evento no manejado: ${eventType}`);
    }

    return null;
  }

  /**
   * Obtiene métodos de pago disponibles
   */
  async getPaymentMethods() {
    try {
      const response = await axios.get(
        `${this.baseURL}/payment_methods`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`
          }
        }
      );

      return {
        success: true,
        methods: response.data.data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export { WompiPayment };
