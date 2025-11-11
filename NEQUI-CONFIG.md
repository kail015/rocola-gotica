# Configuración de Nequi para Rockola Ciudad Gótica

## ⚠️ IMPORTANTE: Número de Nequi actual

**Número configurado: 3208504177**

## Variables de entorno necesarias

### Backend (.env en Render):

```env
# YouTube API
YOUTUBE_API_KEY=AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac

# Puerto
PORT=3001

# Nequi Configuration (PRODUCCIÓN)
NEQUI_CLIENT_ID=tu_client_id_de_nequi
NEQUI_CLIENT_SECRET=tu_client_secret_de_nequi
NEQUI_API_KEY=tu_api_key_de_nequi
NEQUI_BUSINESS_PHONE=3208504177
NEQUI_WEBHOOK_SECRET=tu_secret_para_webhook
NEQUI_ENV=production
```

## Cómo obtener las credenciales de Nequi:

1. **Regístrate en Nequi Business:**
   - Ve a https://conecta.nequi.com.co
   - Crea una cuenta con tu número de Nequi (3208504177)
   - Verifica tu identidad y cuenta

2. **Crea una aplicación:**
   - Ve al panel de desarrollador
   - Crea una nueva aplicación
   - Nombre: "Rockola Ciudad Gótica"

3. **Obtén las credenciales:**
   - `NEQUI_CLIENT_ID`: ID de cliente OAuth
   - `NEQUI_CLIENT_SECRET`: Secret de cliente OAuth
   - `NEQUI_API_KEY`: API Key de la aplicación
   - `NEQUI_WEBHOOK_SECRET`: Secret para validar webhooks (lo creas tú)

4. **Configura permisos:**
   - Activa API de pagos (Payment API)
   - Activa notificaciones webhook

## Cómo funciona el pago de prioridad:

### Flujo completo (MODO PRODUCCIÓN):

1. **Cliente solicita prioridad:**
   - Cliente ve canción en posición 2+ de la cola
   - Hace clic en botón "⚡ $1,000"
   - Sistema genera referencia única (ej: `PRIORITY-A1B2C3D4`)

2. **Cliente recibe instrucciones:**
   - Alert muestra: número Nequi (3208504177), monto ($1,000), referencia
   - Pasos: Abrir Nequi → Enviar dinero → Ingresar número → Monto → Referencia

3. **Cliente hace el pago:**
   - Abre app Nequi
   - Envía $1,000 a 3208504177
   - **IMPORTANTE:** Debe incluir la referencia en el mensaje

4. **Sistema verifica pago:**
   - Frontend hace polling cada 5 segundos a: `GET /api/payment/status/:reference`
   - Backend llama API de Nequi para verificar estado
   - Timeout de 10 minutos

5. **Pago confirmado:**
   - Backend mueve canción a posición prioritaria
   - Las canciones con prioridad pagada se ordenan por timestamp (primera en pagar = primera en cola)
   - Canción recibe badge "⚡ PRIORITARIA"
   - Cliente ve alerta de confirmación

### Ordenamiento de canciones:

- **Canciones prioritarias (paidPriority=true):** Se ordenan por `paymentTimestamp` (FIFO)
- **Canciones normales:** Van después de todas las prioritarias
- **Actualmente sonando:** Siempre posición 0 (no se mueve)

## Configuración del Webhook

### 1. Configurar URL en panel de Nequi:

```
URL: https://rocola-gotica.onrender.com/api/payment/webhook
Método: POST
Headers: 
  - Content-Type: application/json
  - x-nequi-signature: [firma generada por Nequi]
```

### 2. El webhook recibe:

```json
{
  "status": "APPROVED",
  "reference1": "PRIORITY-A1B2C3D4",
  "value": 1000,
  "transactionId": "abc123",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### 3. Validación de seguridad:

- Backend valida firma `x-nequi-signature` usando `NEQUI_WEBHOOK_SECRET`
- Previene solicitudes fraudulentas

## Modo de desarrollo (SIN credenciales Nequi):

Si las variables `NEQUI_CLIENT_ID`, `NEQUI_CLIENT_SECRET` o `NEQUI_API_KEY` NO están configuradas:

1. El sistema funciona en **modo desarrollo**
2. El endpoint `/api/payment/status/:reference` siempre retorna `paid: false`
3. **NO se pueden confirmar pagos automáticamente**
4. Se debe usar `/api/payment/simulate` para testing manual

## Endpoint de simulación (SOLO DESARROLLO):

```bash
POST /api/payment/simulate
{
  "reference": "PRIORITY-A1B2C3D4"
}
```

**⚠️ Este endpoint debe eliminarse en producción o protegerse con password**

## Activar Nequi en producción:

### Paso 1: Configurar variables en Render

1. Ve a tu servicio en Render: https://dashboard.render.com
2. Ve a "Environment"
3. Agrega todas las variables `NEQUI_*` mencionadas arriba
4. Asegúrate de que `NEQUI_ENV=production`

### Paso 2: Configurar webhook en Nequi

1. Ve al panel de Nequi Business
2. Sección "Webhooks" o "Notificaciones"
3. Agrega URL: `https://rocola-gotica.onrender.com/api/payment/webhook`
4. Selecciona evento: "Payment Approved"
5. Guarda y activa

### Paso 3: Probar con pago real pequeño

1. Haz un pago de prueba de $1,000
2. Verifica que la canción se mueva
3. Revisa logs en Render: "✅ Pago confirmado"

## Troubleshooting:

### El pago no se confirma:

1. **Verifica credenciales:** Revisa que todas las variables `NEQUI_*` estén en Render
2. **Revisa logs:** `console.log` en Render muestra errores de API
3. **Verifica referencia:** El cliente debe incluir la referencia EXACTA en el mensaje
4. **Revisa webhook:** El webhook debe estar activo en panel de Nequi

### El webhook no llega:

1. Verifica que la URL sea correcta (HTTPS)
2. Revisa que el servicio de Render esté activo (no "sleeping")
3. Prueba el webhook manualmente con Postman o cURL
4. Revisa logs de Nequi en su panel

### Errores de autenticación:

1. `401 Unauthorized`: Credenciales incorrectas, verifica Client ID y Secret
2. `403 Forbidden`: API Key incorrecta o permisos no configurados
3. `404 Not Found`: URL base incorrecta (sandbox vs production)

## Seguridad:

1. **NUNCA** expongas las credenciales en el código
2. Usa variables de entorno en Render
3. Valida todas las firmas de webhook
4. Elimina endpoint `/api/payment/simulate` en producción
5. Implementa rate limiting en endpoints de pago

## Soporte:

- Documentación Nequi: https://docs.nequi.com.co
- Panel de desarrollador: https://conecta.nequi.com.co
- Soporte: soporte@nequi.com.co
