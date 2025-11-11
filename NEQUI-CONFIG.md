# Configuración de Nequi para Rockola Ciudad Gótica

## Variables de entorno necesarias (.env):

```env
# YouTube API
YOUTUBE_API_KEY=tu_api_key_de_youtube

# Nequi Configuration
NEQUI_CLIENT_ID=tu_client_id
NEQUI_CLIENT_SECRET=tu_client_secret
NEQUI_API_KEY=tu_api_key
NEQUI_BUSINESS_PHONE=3001234567
NEQUI_ENV=sandbox
```

## Cómo obtener las credenciales de Nequi:

1. Ve a https://conecta.nequi.com.co
2. Regístrate como negocio
3. Crea una aplicación
4. Obtén las credenciales (Client ID, Client Secret, API Key)
5. Configura el número de teléfono de Nequi del negocio

## Cómo funciona el pago de prioridad:

1. Cliente ve una canción en la cola (posición 2 o más)
2. Cliente hace clic en el botón "⚡ $1,000"
3. Se genera una referencia de pago única
4. Cliente abre Nequi y envía $1,000 con la referencia
5. El backend recibe la notificación de pago (webhook)
6. La canción se mueve automáticamente a la primera posición
7. La canción se marca con badge "⚡ PRIORITARIA"

## Modo de prueba (Simulación):

Para probar sin integración real de Nequi:
- El botón "⚡ $1,000" genera un pago
- Al confirmar, se simula el pago automáticamente
- La canción se mueve a primera posición

## Activar Nequi en producción:

1. Cambia `NEQUI_ENV=production` en .env
2. Configura webhook en el panel de Nequi
3. URL del webhook: `https://tu-servidor.com/api/payment/webhook`
4. El sistema recibirá notificaciones automáticas de pagos
