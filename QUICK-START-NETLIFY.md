# 🎯 RESUMEN RÁPIDO: Deploy con Netlify

## 📦 ¿Qué tienes ahora?

```
rocola-gotica/
├── backend/          → Servidor Node.js + Socket.io
├── frontend/         → React App
├── netlify.toml      → Configuración Netlify ✓
└── archivos guía     → NETLIFY-DEPLOY.md ✓
```

---

## ⚡ 3 PASOS SIMPLES

### 1️⃣ GITHUB (2 min)
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/TU_USUARIO/rocola-gotica.git
git push -u origin main
```

### 2️⃣ RENDER - Backend (5 min)
1. Ir a **render.com** → Crear cuenta
2. New Web Service → Tu repo
3. Configurar:
   - Root: `backend`
   - Build: `npm install`
   - Start: `node server.js`
4. Variable de entorno: `YOUTUBE_API_KEY`
5. **COPIAR URL** → Ej: `https://rocola-backend.onrender.com`

### 3️⃣ NETLIFY - Frontend (3 min)
1. Ir a **netlify.com** → Crear cuenta
2. New site → Tu repo
3. Configurar:
   - Base: `frontend`
   - Build: `npm run build`
   - Publish: `frontend/dist`
4. Variable de entorno:
   ```
   VITE_BACKEND_URL = [URL_DE_RENDER]
   ```
5. Deploy!

---

## 🎉 ¡Ya está online!

Tu app estará en: `https://TU-APP.netlify.app`

**URLs para compartir:**
- Clientes: `https://tu-app.netlify.app`
- Admin: `https://tu-app.netlify.app/admin-access`
- TV Bar: `https://tu-app.netlify.app/video`

---

## 🔧 Antes de empezar

**Ejecuta esto para verificar que todo esté listo:**
```bash
verificar-deploy.bat
```

---

## 📖 Guía completa

Lee **NETLIFY-DEPLOY.md** para instrucciones detalladas paso a paso con capturas.

---

## 💰 Costo

**$0 USD/mes** (100% gratis)

---

## ⏱️ Tiempo total

**10 minutos** de la primera línea de código a app en producción.

---

## 🆘 ¿Ayuda?

- Guía completa: `NETLIFY-DEPLOY.md`
- Problemas comunes: Ver sección "Problemas" en la guía
- Deploy general: `DEPLOYMENT.md`
