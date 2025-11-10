# Instrucciones para Desplegar la Rocola Gótica en Internet

## Opción 1: Render (Recomendada - Gratis)

### Backend en Render:
1. Ve a https://render.com y crea una cuenta
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub o sube el código
4. Configuración:
   - **Name**: rocola-gotica-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Root Directory**: `backend`
   
5. Variables de entorno:
   - `PORT`: (dejarlo vacío, Render lo asigna automáticamente)
   - `YOUTUBE_API_KEY`: AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac

6. Click en "Create Web Service"
7. Copia la URL que te dan (ej: https://rocola-gotica-backend.onrender.com)

### Frontend en Vercel:
1. Ve a https://vercel.com y crea una cuenta
2. Click en "Add New" → "Project"
3. Importa tu repositorio
4. Configuración:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   
5. Variables de entorno:
   - `VITE_BACKEND_URL`: [La URL de tu backend en Render]
   
6. Click en "Deploy"
7. Tu aplicación estará disponible en una URL como: https://rocola-gotica.vercel.app

---

## Opción 2: Railway (Todo en uno)

1. Ve a https://railway.app y crea una cuenta
2. Click en "New Project" → "Deploy from GitHub repo"
3. Conecta tu repositorio
4. Railway detectará automáticamente ambos servicios (backend y frontend)
5. Configura las variables de entorno en cada servicio
6. Railway te dará URLs públicas para ambos

---

## Opción 3: Heroku (Clásica)

### Backend:
```bash
# Instalar Heroku CLI
# En la carpeta backend:
heroku login
heroku create rocola-gotica-backend
heroku config:set YOUTUBE_API_KEY=AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac
git push heroku main
```

### Frontend:
Similar proceso pero con configuración de Vite

---

## URLs que necesitarás compartir:

- **Para clientes**: https://tu-app.vercel.app (página principal)
- **Para admin**: https://tu-app.vercel.app/admin-access
- **Para TV del bar**: https://tu-app.vercel.app/video

## Notas importantes:

- Los servicios gratuitos pueden "dormir" después de inactividad
- La primera carga puede ser lenta mientras el servidor "despierta"
- Para producción profesional, considera planes de pago
