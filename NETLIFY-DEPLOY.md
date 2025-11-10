# 🚀 Desplegar Rocola Gótica con Netlify + Render

## Por qué esta combinación:
- ✅ **Netlify**: Frontend ultra-rápido, CDN global, SSL gratis
- ✅ **Render**: Backend con Socket.io, siempre activo
- ✅ **Ambos GRATIS**

---

## 📋 PASO 1: Preparar GitHub

1. Crea un repositorio en https://github.com
2. Sube tu código:

```bash
cd "d:\rocola gotica"
git init
git add .
git commit -m "Rocola Gótica lista para deploy"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/rocola-gotica.git
git push -u origin main
```

---

## 🔧 PASO 2: Backend en Render (5 min)

1. Ve a **https://render.com**
2. Regístrate con GitHub (gratis)
3. Click **"New +"** → **"Web Service"**
4. Selecciona tu repositorio `rocola-gotica`

### Configuración:
```
Name: rocola-gotica-backend
Region: Oregon (US West) o el más cercano
Branch: main
Root Directory: backend
Environment: Node
Build Command: npm install
Start Command: node server.js
Instance Type: Free
```

### Variables de Entorno (Important!):
```
YOUTUBE_API_KEY = AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac
```

5. Click **"Create Web Service"**
6. Espera 3-5 minutos al deploy
7. **COPIA TU URL**: Ejemplo: `https://rocola-gotica-backend.onrender.com`

---

## 🌐 PASO 3: Frontend en Netlify (3 min)

1. Ve a **https://www.netlify.com**
2. Regístrate con GitHub (gratis)
3. Click **"Add new site"** → **"Import an existing project"**
4. Selecciona **"Deploy with GitHub"**
5. Autoriza Netlify y selecciona tu repositorio `rocola-gotica`

### Configuración:
```
Branch to deploy: main
Base directory: frontend
Build command: npm run build
Publish directory: frontend/dist
```

### Variables de Entorno (CRÍTICO):
Click en **"Show advanced"** → **"New variable"**

```
Key: VITE_BACKEND_URL
Value: [PEGA AQUÍ LA URL DE RENDER]
```

Ejemplo: `https://rocola-gotica-backend.onrender.com`

⚠️ **SIN la barra `/` al final!**

6. Click **"Deploy site"**
7. Espera 2-3 minutos

---

## 🎉 ¡LISTO! Tu app está en línea

Netlify te dará una URL como: `https://random-name-123456.netlify.app`

### Cambiar el nombre de dominio (opcional):
1. En Netlify → **Site settings** → **Domain management**
2. Click **"Options"** → **"Edit site name"**
3. Cambia a: `rocola-gotica` → quedará: `https://rocola-gotica.netlify.app`

---

## 📱 URLs para compartir:

Comparte estas con tus clientes:

- **Página principal**: `https://tu-app.netlify.app`
- **Admin**: `https://tu-app.netlify.app/admin-access` (password: admin123)
- **TV del Bar**: `https://tu-app.netlify.app/video`

---

## 🔄 Actualizar la aplicación

Cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

- Netlify redeploya automáticamente en ~1 minuto
- Render redeploya automáticamente en ~3 minutos

---

## ⚠️ Problemas comunes

### 1. "Cannot connect to backend"
- Verifica `VITE_BACKEND_URL` en Netlify
- Debe ser: `https://tu-backend.onrender.com` (sin `/` al final)
- Redeploya después de cambiar variables: **Deploys** → **Trigger deploy** → **Clear cache and deploy**

### 2. "Videos no cargan"
- Verifica `YOUTUBE_API_KEY` en Render
- Revisa los logs en Render: **Logs** (botón arriba a la derecha)

### 3. "Backend tarda en responder"
- Normal en plan gratuito de Render
- El servicio "duerme" después de 15 min sin uso
- Primera carga puede tardar 30-60 segundos

### 4. "Página en blanco"
- Abre consola del navegador (F12)
- Verifica errores de CORS o conexión

---

## 🎯 Ventajas de Netlify

- ✅ **CDN Global**: Tu app carga rápido en todo el mundo
- ✅ **SSL Gratis**: HTTPS automático
- ✅ **Deploy automático**: Sube código → deploy en 1 minuto
- ✅ **Sin límites**: Netlify gratis es generoso
- ✅ **Dominio custom gratis**: Conecta tu propio dominio

---

## 💡 Tips adicionales

### Dominio personalizado:
Si tienes un dominio (ej: `tubar.com`):
1. En Netlify → **Domain settings** → **Add custom domain**
2. Sigue las instrucciones para configurar DNS
3. Quedará: `https://rocola.tubar.com`

### Cambiar password de admin:
Edita `frontend/src/AdminAccess.jsx`, línea ~20:
```javascript
if (password === 'TU_NUEVO_PASSWORD') {
```

Luego haz commit y push para que se actualice.

---

## 📊 Monitoreo

- **Render**: Ve logs en tiempo real en la sección **Logs**
- **Netlify**: Ve analytics en **Analytics** (plan gratis tiene básicos)

---

## 💰 Costos

- **Render (Backend)**: $0/mes (plan Free)
  - 750 horas/mes gratis
  - Suficiente para un bar pequeño/mediano
  
- **Netlify (Frontend)**: $0/mes (plan Starter)
  - 100 GB bandwidth/mes
  - 300 build minutes/mes
  - Más que suficiente

**Total: $0 USD/mes**

---

## 🚀 Siguiente nivel (cuando crezcas):

Si necesitas más:
- **Render Pro**: $7/mes (backend sin dormir)
- **Netlify Pro**: $19/mes (más funciones)
- **Base de datos**: MongoDB Atlas (gratis hasta 512MB)

¡Pero para empezar, el plan gratuito es perfecto! 🎉
