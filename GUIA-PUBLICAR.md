# 🌐 Guía Rápida: Publicar Rocola Gótica en Internet

## ✅ Lo que ya está listo:

1. ✅ Backend configurado para aceptar conexiones externas
2. ✅ Frontend usa variables de entorno para conectarse
3. ✅ Archivos de configuración creados

---

## 🚀 OPCIÓN MÁS FÁCIL: Render + Vercel (GRATIS)

### Paso 1: Subir código a GitHub

1. Crea un repositorio en https://github.com
2. En tu terminal:
```bash
cd "d:\rocola gotica"
git init
git add .
git commit -m "Primera versión Rocola Gótica"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/rocola-gotica.git
git push -u origin main
```

### Paso 2: Backend en Render

1. Ve a **https://render.com** → Crea cuenta (gratis con GitHub)
2. Click **"New +"** → **"Web Service"**
3. Conecta tu repositorio GitHub
4. Configuración:
   - **Name**: `rocola-gotica-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free

5. **Environment Variables** (agregar):
   ```
   YOUTUBE_API_KEY = AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac
   ```

6. Click **"Create Web Service"**
7. Espera 5 minutos a que termine el deploy
8. **COPIA LA URL** que te dan (ejemplo: `https://rocola-gotica-backend.onrender.com`)

### Paso 3: Frontend en Vercel

1. Ve a **https://vercel.com** → Crea cuenta (gratis con GitHub)
2. Click **"Add New..."** → **"Project"**
3. Importa tu repositorio GitHub
4. Configuración:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (ya viene por defecto)
   - **Output Directory**: `dist` (ya viene por defecto)

5. **Environment Variables** (MUY IMPORTANTE):
   ```
   VITE_BACKEND_URL = [PEGA AQUÍ LA URL DE RENDER DEL PASO 2]
   ```
   Ejemplo: `https://rocola-gotica-backend.onrender.com`

6. Click **"Deploy"**
7. Espera 2-3 minutos
8. **¡LISTO!** Tu app estará en una URL como: `https://rocola-gotica.vercel.app`

---

## 📱 URLs para compartir con clientes:

Una vez desplegado, comparte estas URLs:

- **Clientes**: `https://tu-app.vercel.app`
- **Administrador**: `https://tu-app.vercel.app/admin-access` (password: admin123)
- **TV del Bar**: `https://tu-app.vercel.app/video`

---

## ⚠️ Notas Importantes:

1. **El servicio gratuito de Render "duerme"** después de 15 minutos sin uso
   - La primera carga puede tardar 30-60 segundos
   - Después de eso funciona normal

2. **Cambiar password de admin**:
   - Ve a `frontend/src/AdminAccess.jsx`
   - Cambia la línea: `if (password === 'admin123')`

3. **Dominio personalizado** (opcional):
   - En Vercel puedes agregar tu propio dominio gratis
   - Ejemplo: `rocola.tubar.com`

---

## 🆘 ¿Problemas?

### Backend no conecta:
- Revisa que `VITE_BACKEND_URL` en Vercel tenga la URL correcta de Render
- Asegúrate que la URL de Render termine sin `/` al final

### Videos no reproducen:
- Verifica que `YOUTUBE_API_KEY` esté configurada en Render
- Prueba la API key en: https://console.cloud.google.com

### Página en blanco:
- Ve a la consola del navegador (F12)
- Revisa que no haya errores de conexión

---

## 💰 ¿Costos?

- **Render (Backend)**: GRATIS (con límites)
- **Vercel (Frontend)**: GRATIS (sin límites relevantes)
- **Total**: $0 USD/mes

Para un bar pequeño/mediano, esto es más que suficiente.

---

## 📈 Actualizar la aplicación:

Cada vez que hagas cambios al código:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Render y Vercel detectarán automáticamente los cambios y re-deployarán la aplicación.
