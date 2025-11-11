# Sistema de Pagos Nequi - Rockola Ciudad Gótica

## 🎵 ¿Qué es el sistema de prioridad?

Los clientes pueden pagar **$1,000 COP** por Nequi para que su canción salte al inicio de la cola.

## 💳 Flujo del cliente:

### 1. Ver canción en la cola
- La canción debe estar en posición 2 o posterior
- Aparece botón amarillo "⚡ $1,000"

### 2. Hacer clic en el botón
- Se genera código de referencia único (ej: `PRIORITY-A1B2C3D4`)
- Aparece alerta con instrucciones detalladas

### 3. Realizar pago en Nequi
```
📱 Abrir app Nequi
💰 Seleccionar "Enviar dinero"
📞 Número: 3208504177
💵 Monto: $1,000
📝 Mensaje: PRIORITY-A1B2C3D4 (copiar la referencia exacta)
✅ Confirmar
```

### 4. Esperar confirmación
- El sistema verifica el pago automáticamente (cada 5 segundos)
- Máximo 10 minutos de espera
- Cuando se confirma: canción sube a prioridad

## 🔧 Cómo funciona técnicamente:

### Frontend (App.jsx):
```javascript
// Al hacer clic en "⚡ $1,000":
1. POST /api/payment/priority { songId }
   → Recibe: { reference, amount, paymentUrl }

2. Muestra alert con instrucciones

3. Inicia polling cada 5 segundos:
   GET /api/payment/status/:reference
   
4. Si paid === true:
   → Muestra alerta "¡Pago confirmado!"
   → Detiene polling
   
5. Si pasan 10 minutos:
   → Muestra alerta "Tiempo agotado"
   → Detiene polling
```

### Backend (server.js):

#### Endpoint: POST /api/payment/priority
```javascript
// Crea solicitud de pago
pendingPayments[reference] = {
  songId,
  amount: 1000,
  timestamp: Date.now(),
  songTitle
}
```

#### Endpoint: GET /api/payment/status/:reference
```javascript
// Verifica pago con API de Nequi
const status = await checkPaymentStatus(reference);

if (status.paid === true) {
  // Remover canción de posición actual
  // Agregar timestamp y marca de prioridad
  // Insertar en orden FIFO con otras canciones prioritarias
  // Emitir socket 'queue-update'
  // Eliminar de pendingPayments
}
```

#### Endpoint: POST /api/payment/webhook
```javascript
// Recibe notificación de Nequi en tiempo real
// Valida firma de seguridad
// Si status === 'APPROVED':
//   → Mismo proceso que status endpoint
```

### Ordenamiento de cola:

```javascript
// Estructura de canción con prioridad:
{
  id: "abc123",
  title: "Canción X",
  priority: true,
  paidPriority: true,
  paymentTimestamp: 1700000000000,
  paymentReference: "PRIORITY-A1B2C3D4"
}

// Orden en la cola:
[
  { ...actualmente sonando (posición 0) },
  { ...prioridad pagada #1 (primera en pagar) },
  { ...prioridad pagada #2 (segunda en pagar) },
  { ...prioridad pagada #3 (tercera en pagar) },
  { ...canción normal #1 },
  { ...canción normal #2 },
  ...
]
```

### Lógica de inserción:
```javascript
// 1. Encontrar índice de primera canción NO prioritaria
const firstNonPriorityIndex = queue.findIndex(s => !s.paidPriority);

// 2. Si no hay canciones prioritarias:
if (firstNonPriorityIndex === -1) {
  queue.unshift(song); // Agregar al inicio
}

// 3. Si hay canciones prioritarias:
else {
  // Encontrar posición correcta por timestamp (FIFO)
  let insertIndex = 0;
  for (let i = 0; i < firstNonPriorityIndex; i++) {
    if (song.paymentTimestamp > queue[i].paymentTimestamp) {
      insertIndex = i + 1; // Insertar después de esta
    }
  }
  queue.splice(insertIndex, 0, song);
}
```

## 🎨 Indicadores visuales:

### Badge en lista de cola:
```css
.priority-badge {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #0a1628;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: bold;
}
```

### Canción prioritaria:
```css
.priority-song {
  border: 2px solid #fbbf24;
  animation: priorityGlow 2s ease-in-out infinite;
}

@keyframes priorityGlow {
  0%, 100% { box-shadow: 0 0 10px rgba(251, 191, 36, 0.5); }
  50% { box-shadow: 0 0 20px rgba(251, 191, 36, 0.8); }
}
```

### Botón de pago:
```css
.priority-btn {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  color: #0a1628;
  animation: pulseGlow 1.5s ease-in-out infinite;
}
```

### Banner en header:
```css
.nequi-info-banner {
  background: linear-gradient(135deg, #fbbf24, #f59e0b);
  animation: pulse 2s ease-in-out infinite;
}
```

## 🔐 Seguridad:

1. **Validación de webhook:**
   - Firma `x-nequi-signature` validada con HMAC-SHA256
   - Secret almacenado en variable de entorno

2. **Referencias únicas:**
   - UUID v4 truncado (8 caracteres)
   - Prefijo `PRIORITY-` para identificación
   - No reutilizables

3. **Timeout de polling:**
   - Máximo 10 minutos (120 intentos)
   - Previene polling infinito

4. **Verificación doble:**
   - Polling (cliente activo)
   - Webhook (notificación en tiempo real)

## 📊 Monitoreo:

### Logs importantes:
```bash
# Solicitud de prioridad:
🎵 Solicitud de prioridad para: Canción X (ref: PRIORITY-A1B2C3D4)

# Verificación de pago:
🔍 Verificando pago: PRIORITY-A1B2C3D4

# Pago confirmado:
✅ Pago confirmado: Canción X (ref: PRIORITY-A1B2C3D4) - Posición en cola de prioridad

# Webhook recibido:
📩 Webhook Nequi recibido: { status: 'APPROVED', reference: 'PRIORITY-A1B2C3D4', value: 1000 }

# Error:
❌ Error verificando pago: [mensaje de error]
```

### Verificar en Render:
1. Ve a tu servicio
2. Pestaña "Logs"
3. Busca los logs anteriores
4. Verifica que no haya errores de autenticación

## 🧪 Testing:

### Modo desarrollo (sin credenciales Nequi):
```bash
# 1. Crear solicitud de pago:
POST http://localhost:3001/api/payment/priority
{ "songId": "abc123" }

# 2. Simular pago:
POST http://localhost:3001/api/payment/simulate
{ "reference": "PRIORITY-A1B2C3D4" }

# ✅ Canción sube a prioridad inmediatamente
```

### Modo producción (con credenciales Nequi):
```bash
# 1. Hacer pago real en Nequi:
- Número: 3208504177
- Monto: $1,000
- Mensaje: PRIORITY-A1B2C3D4

# 2. El sistema verifica automáticamente:
GET http://rocola-gotica.onrender.com/api/payment/status/PRIORITY-A1B2C3D4

# 3. O recibe webhook:
POST http://rocola-gotica.onrender.com/api/payment/webhook
(enviado por Nequi)

# ✅ Canción sube cuando Nequi confirma
```

## 🚀 Despliegue:

### 1. Configurar variables en Render:
```env
NEQUI_CLIENT_ID=xxxxx
NEQUI_CLIENT_SECRET=xxxxx
NEQUI_API_KEY=xxxxx
NEQUI_BUSINESS_PHONE=3208504177
NEQUI_WEBHOOK_SECRET=tu_secret_unico
NEQUI_ENV=production
```

### 2. Configurar webhook en Nequi:
- URL: `https://rocola-gotica.onrender.com/api/payment/webhook`
- Evento: "Payment Approved"
- Activar

### 3. Probar:
1. Agregar canción a la cola
2. Hacer pago de $1,000
3. Verificar que suba a prioridad
4. Revisar logs

## 📱 UX/UI consideraciones:

### Buena experiencia:
✅ Instrucciones claras en el alert
✅ Banner visible con número de Nequi
✅ Botón destacado con animación
✅ Badge "⚡ PRIORITARIA" visible
✅ Feedback inmediato al confirmar
✅ Timeout de 10 minutos (no infinito)

### Casos de error manejados:
- ⏱️ Timeout: "El tiempo de verificación ha expirado"
- ❌ Canción eliminada: "Canción no encontrada"
- 🔄 Pago pendiente: Sigue verificando
- ⚠️ Error de red: "Error verificando estado del pago"

## 🎯 Próximas mejoras:

1. **Notificaciones push:**
   - Avisar al cliente cuando su pago se confirme
   - Usar Web Push API

2. **QR Code:**
   - Generar QR con deep link de Nequi
   - Cliente escanea en lugar de copiar referencia

3. **Panel de admin:**
   - Ver pagos pendientes
   - Ver pagos confirmados
   - Cancelar pagos manualmente

4. **Historial:**
   - Guardar historial de pagos en JSON
   - Mostrar estadísticas en admin

5. **Múltiples niveles:**
   - $1,000: Prioridad normal
   - $2,000: Saltar a primera posición absoluta
   - $5,000: Reproducir inmediatamente después de canción actual
