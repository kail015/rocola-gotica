# 🚀 Guía de Despliegue en Render - Rockola Ciudad Gótica

## 📋 Pasos para desplegar en Render

### 1. Crear cuenta en Render
- ✅ Ya tienes tu cuenta creada
- Ve a: https://dashboard.render.com

### 2. Conectar tu repositorio de GitHub

1. En el dashboard de Render, haz clic en **"New +"**
2. Selecciona **"Web Service"**
3. Conecta tu repositorio: `kail015/rocola-gotica`
4. Render detectará automáticamente tu proyecto

### 3. Configurar el servicio

#### Configuración básica:
```
Name: rocola-gotica-backend
Region: Oregon (US West)
Branch: main
Root Directory: backend
Runtime: Node
Build Command: npm install
Start Command: npm start
Plan: Free
```

#### Variables de entorno requeridas:

Ve a la pestaña **"Environment"** y agrega:

```env
# Puerto (Render lo configura automáticamente, pero por si acaso)
PORT=3001

# Node Environment
NODE_ENV=production

# YouTube API (ya configurada)
YOUTUBE_API_KEY=AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac

# Nequi (configurar cuando obtengas credenciales)
NEQUI_CLIENT_ID=tu_client_id_aqui
NEQUI_CLIENT_SECRET=tu_client_secret_aqui
NEQUI_API_KEY=tu_api_key_aqui
NEQUI_BUSINESS_PHONE=3208504177
NEQUI_WEBHOOK_SECRET=crear_un_secret_unico_aqui
NEQUI_ENV=production
```

**⚠️ IMPORTANTE:** 
- Las variables de Nequi son opcionales para empezar
- Sin ellas, el sistema funciona pero los pagos no se confirman automáticamente
- Puedes agregarlas después cuando obtengas las credenciales de Nequi Business

### 4. Configurar disco persistente (para guardar datos)

1. En tu servicio, ve a **"Disks"** en el menú lateral
2. Haz clic en **"Add Disk"**
3. Configuración:
   ```
   Name: rocola-data
   Mount Path: /opt/render/project/src/backend/data
   Size: 1 GB (suficiente para el plan gratuito)
   ```
4. Haz clic en **"Create Disk"**

Esto asegura que la cola de canciones, chat y menú NO se pierdan cuando el servidor se reinicie.

### 5. Deploy automático

1. Haz clic en **"Create Web Service"**
2. Render comenzará a:
   - ✅ Clonar tu repositorio
   - ✅ Instalar dependencias (`npm install`)
   - ✅ Iniciar el servidor (`npm start`)
3. ⏱️ Espera 2-3 minutos
4. ✅ Tu backend estará en vivo en: `https://rocola-gotica-backend.onrender.com`

### 6. Verificar que funciona

Abre en tu navegador:
```
https://tu-servicio.onrender.com/health
```

Deberías ver:
```json
{
  "status": "ok",
  "uptime": 123,
  "queue": 0,
  "currentSong": "ninguna",
  "connectedUsers": 0,
  "timestamp": "2025-11-12T..."
}
```

### 7. Actualizar el frontend para usar el nuevo backend

Una vez que tu backend esté desplegado, necesitas actualizar Netlify con la URL correcta:

1. Ve a: https://app.netlify.com
2. Selecciona tu sitio: `rockola-ciudad-gotica-licores`
3. Ve a **Site settings > Environment variables**
4. Actualiza o crea:
   ```
   VITE_BACKEND_URL=https://tu-servicio.onrender.com
   ```
5. Haz clic en **"Trigger deploy"** para redesplegar

## 🔄 Auto-Deploy (Deploy automático)

Render ya está configurado para auto-deploy:
- ✅ Cada vez que hagas `git push` a `main`
- ✅ Render detecta el cambio automáticamente
- ✅ Despliega la nueva versión en 2-3 minutos

## 📊 Monitoreo

### Ver logs en tiempo real:
1. Ve a tu servicio en Render
2. Pestaña **"Logs"**
3. Verás:
   ```
   🚀 Servidor iniciando...
   📦 Cola cargada desde archivo: X canciones
   ✅ Usuario conectado. Total: X usuarios
   🏓 Keep-alive ping enviado
   ```

### Verificar estado:
```bash
curl https://tu-servicio.onrender.com/health
```

## ⚠️ Limitaciones del plan gratuito

1. **Sleep después de 15 minutos de inactividad**
   - ✅ Ya solucionado con sistema keep-alive
   - El frontend hace ping cada 5 minutos

2. **750 horas gratis por mes**
   - Con keep-alive: ~30 días de uso continuo
   - Suficiente para un bar

3. **Reinicio después de cambios**
   - Los datos persisten gracias al disco configurado

## 🔧 Troubleshooting

### El servicio no inicia:
1. Verifica logs en Render
2. Asegúrate de que `Root Directory` sea `backend`
3. Verifica que `Start Command` sea `npm start`

### No se conecta desde el frontend:
1. Verifica que `VITE_BACKEND_URL` en Netlify apunte a tu servicio Render
2. Asegúrate de usar `https://` (no `http://`)
3. Revisa CORS está habilitado en `backend/server.js`

### Los datos se pierden:
1. Verifica que el disco esté montado en `/opt/render/project/src/backend/data`
2. Revisa que el path en `server.js` coincida

### Nequi no funciona:
1. Verifica que las variables `NEQUI_*` estén configuradas en Render
2. Revisa logs: busca `⚠️ Credenciales de Nequi no configuradas`
3. Mientras no tengas credenciales, puedes usar el endpoint de simulación

## 📱 Webhook de Nequi

Una vez que tu servicio esté en vivo y tengas credenciales:

1. Ve al panel de Nequi Business
2. Configura webhook:
   ```
   URL: https://tu-servicio.onrender.com/api/payment/webhook
   Método: POST
   Eventos: Payment Approved
   ```

## 🎯 URLs finales

Después del despliegue completo:

- **Frontend (Netlify):** https://rockola-ciudad-gotica-licores.netlify.app
- **Backend (Render):** https://tu-servicio.onrender.com
- **Health Check:** https://tu-servicio.onrender.com/health
- **Webhook Nequi:** https://tu-servicio.onrender.com/api/payment/webhook

## 💡 Tips

1. **Nombre del servicio:** Usa un nombre corto y memorable
2. **Region:** Oregon es buena para Latinoamérica
3. **Logs:** Revísalos frecuentemente los primeros días
4. **Health check:** Configúralo en `/health` para que Render verifique que esté vivo
5. **Disco persistente:** Esencial para no perder la cola de canciones

## 🆘 Soporte

Si tienes problemas:
1. Haz clic en **"Contact Support"** en el dashboard de Render
2. Envía email a: soporte@render.com
3. O revisa la documentación: https://render.com/docs

---

¡Tu rockola estará en vivo 24/7 con Render! 🎵🚀
