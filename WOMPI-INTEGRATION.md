# Integración Wompi - Sistema de Pagos Prioritarios

## 📋 Resumen
Sistema de pagos integrado con Wompi para permitir que los clientes paguen $1,000 COP y hagan que su canción suene de forma prioritaria en la cola.

## 🎯 Características Implementadas

### Frontend (`frontend/src/App.jsx`)
- ✅ Banner informativo de Wompi en el header
- ✅ Botón de pago prioritario en cada canción de la cola
- ✅ Función `handlePriorityPayment()` que:
  - Llama al endpoint `/api/payment/wompi/create`
  - Abre ventana de pago de Wompi
  - Muestra alerta con detalles del pago

### Backend (`backend/server.js`)
- ✅ **POST /api/payment/wompi/create**: Crear transacción de pago
- ✅ **POST /api/payment/wompi/webhook**: Recibir confirmaciones de Wompi
- ✅ **GET /api/payment/wompi/status/:reference**: Verificar estado de pago

### Configuración (`backend/config/ciudad-gotica.json`)
- ✅ Credenciales de prueba de Wompi configuradas
- ✅ Feature flags de pagos habilitados
- ✅ Ambiente de prueba (test)

## 🔧 Configuración Actual

### Credenciales de Prueba
```json
{
  "payments": {
    "enabled": true,
    "wompi": {
      "publicKey": "pub_test_G4gqhmXsPcFnml7p2kPJT8L7h23Z2J5c",
      "privateKey": "prv_test_aBc123XyZ456...",
      "environment": "test",
      "webhookSecret": "test_webhook_secret_123"
    }
  }
}
```

### Variables de Entorno Necesarias
```env
# Frontend (.env)
VITE_BACKEND_URL=https://rocola-gotica.onrender.com

# Backend (.env)
FRONTEND_URL=https://rockola-ciudad-gotica-licores.netlify.app
```

## 🚀 Flujo de Pago

### 1. Usuario solicita pago prioritario
```javascript
// Usuario hace clic en "⚡ Pagar $1,000" en su canción
handlePriorityPayment(songId)
```

### 2. Frontend crea la transacción
```javascript
POST /api/payment/wompi/create
Body: {
  songId: "abc123",
  songTitle: "Canción Example",
  customerName: "Juan Pérez",
  amount: 1000
}
```

### 3. Backend genera link de pago Wompi
```javascript
Response: {
  success: true,
  paymentUrl: "https://checkout.wompi.co/l/abc123",
  reference: "priority-abc123-1234567890",
  transactionId: "wompi-trans-123"
}
```

### 4. Usuario completa el pago
- Se abre ventana con checkout de Wompi
- Usuario ingresa datos de tarjeta/Nequi/PSE
- Wompi procesa el pago

### 5. Wompi notifica al backend (webhook)
```javascript
POST /api/payment/wompi/webhook
Body: {
  event: "transaction.updated",
  data: {
    status: "APPROVED",
    reference: "priority-abc123-1234567890",
    ...
  }
}
```

### 6. Backend actualiza la cola
- Encuentra la canción por `songId`
- La marca como `paidPriority: true`
- La reordena en la cola (primeras canciones)
- Emite evento `queue-update` vía Socket.io
- Todos los clientes conectados ven la actualización

## 📱 Interfaz de Usuario

### Banner de Información
```jsx
<div className="wompi-banner">
  💰 Haz que tu canción suene primero por $1,000 • Paga con Wompi ⚡
</div>
```

### Botón de Pago Prioritario
```jsx
{index > 0 && !song.paidPriority && (
  <button 
    className="priority-btn"
    onClick={() => handlePriorityPayment(song.id)}
    title="Haz que tu canción suene antes"
  >
    ⚡ Pagar $1,000
  </button>
)}
```

**Condiciones:**
- Solo aparece si la canción NO está en primera posición (`index > 0`)
- Solo aparece si NO ha sido pagada antes (`!song.paidPriority`)

## 🎨 Estilos CSS

### Banner de Wompi
```css
.wompi-banner {
  background: linear-gradient(135deg, #00d4ff 0%, #0099cc 100%);
  color: #000;
  font-size: 0.95rem;
  font-weight: 600;
  text-align: center;
  border-radius: 25px;
  box-shadow: 0 4px 15px rgba(0, 212, 255, 0.5);
  animation: pulse-glow 2s ease-in-out infinite;
}
```

### Botón de Pago
```css
.priority-btn {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  /* Estilos ya definidos en App.css */
}
```

## 🔐 Seguridad

### Validación de Webhooks
- El backend valida que los webhooks provengan de Wompi
- Se verifica la firma del webhook con el `webhookSecret`
- Solo se procesan eventos con `status: "APPROVED"`

### Prevención de Duplicados
- Cada pago tiene una referencia única: `priority-{songId}-{timestamp}`
- Los pagos pendientes se almacenan en memoria (`pendingPayments`)
- Una vez confirmado, el pago se elimina de pendientes

## 🧪 Pruebas

### Modo Test (Actual)
```javascript
environment: "test"
publicKey: "pub_test_..."
privateKey: "prv_test_..."
```

**Tarjeta de prueba Wompi:**
- Número: `4242 4242 4242 4242`
- Fecha: Cualquier fecha futura
- CVV: `123`
- Resultado: Pago aprobado automáticamente

### Modo Producción (Futuro)
Cuando estés listo para producción:

1. **Obtener credenciales reales:**
   - Ir a [Wompi Dashboard](https://comercios.wompi.co)
   - Crear cuenta / Iniciar sesión
   - Obtener `publicKey` y `privateKey` de producción

2. **Actualizar configuración:**
```json
{
  "payments": {
    "wompi": {
      "publicKey": "pub_prod_REAL_KEY",
      "privateKey": "prv_prod_REAL_KEY",
      "environment": "production",
      "webhookSecret": "SECURE_RANDOM_SECRET"
    }
  }
}
```

3. **Configurar webhook en Wompi:**
   - URL: `https://rocola-gotica.onrender.com/api/payment/wompi/webhook`
   - Eventos: `transaction.updated`

## 📊 Monitoreo

### Logs del Backend
```javascript
console.log('💳 Pago Wompi creado: ${songTitle} - ref: ${reference}');
console.log('📩 Webhook Wompi recibido:', event);
console.log('✅ Webhook Wompi: Pago confirmado para ${song.title}');
```

### Verificar Estado de Pago
```bash
GET /api/payment/wompi/status/{reference}
```

## 🔄 Siguiente Pasos

### Para Desplegar:
1. ✅ Código implementado (frontend + backend)
2. ⏳ Commit y push a GitHub
3. ⏳ Despliegue automático (Netlify + Render)
4. ⏳ Probar en ambiente de test
5. ⏳ Verificar webhooks funcionando

### Para Producción:
1. ⏳ Obtener credenciales reales de Wompi
2. ⏳ Actualizar `ciudad-gotica.json`
3. ⏳ Configurar webhook en panel de Wompi
4. ⏳ Probar con pagos reales pequeños ($100)
5. ⏳ Monitorear logs y transacciones

## 📞 Soporte Wompi
- Dashboard: https://comercios.wompi.co
- Documentación: https://docs.wompi.co
- API Reference: https://docs.wompi.co/docs/en/api

## ⚠️ Notas Importantes

1. **Nequi fue removido completamente** - Ahora solo Wompi
2. **Ambiente de prueba activo** - No se cobran pagos reales
3. **Multi-tenant ready** - Cada cliente puede tener sus propias credenciales Wompi
4. **Webhooks críticos** - Sin webhooks, las canciones no se priorizan automáticamente
5. **HTTPS requerido** - Wompi requiere HTTPS para webhooks (Render lo provee)

## 🎉 Estado Actual
✅ **IMPLEMENTACIÓN COMPLETA EN CÓDIGO**
- Frontend: Banner + Botón + Función de pago
- Backend: 3 endpoints (create, webhook, status)
- Config: Credenciales de test configuradas
- Estilos: Banner y botón con animaciones

⏳ **PENDIENTE DE DESPLIEGUE**
- Hacer commit y push a GitHub
- Verificar despliegue en Netlify y Render
- Probar flujo completo de pago
