# 🚀 Guía Rápida - Crear Cliente Nuevo

## Método 1: Script Automatizado (Recomendado)

### Paso 1: Ejecutar el asistente
```bash
cd backend
node crear-cliente.js
```

### Paso 2: Responder las preguntas
El script te preguntará:
- ✅ Nombre del bar
- ✅ Dominio
- ✅ API Key de YouTube del cliente
- ✅ Configuración de Wompi (si habilitan pagos)
- ✅ Información de contacto
- ✅ Contraseña de administrador
- ✅ Plan y precios

### Paso 3: Subir assets
```bash
# Copiar logo del cliente (500x500px PNG)
cp logo-cliente.png frontend/public/logos/nombre-cliente.png

# Copiar fondo del cliente (1920x1080px PNG, opcional)
cp fondo-cliente.png frontend/public/backgrounds/nombre-cliente.png
```

### Paso 4: Reiniciar servidor
```bash
# Detener servidor actual
Ctrl + C

# Reiniciar
npm run dev
```

### Paso 5: Probar
Abrir navegador en: `http://localhost:3001`

---

## Método 2: Manual (Avanzado)

### 1. Copiar plantilla
```bash
cp backend/config/TEMPLATE.json backend/config/nuevo-cliente.json
```

### 2. Editar configuración
Abrir `backend/config/nuevo-cliente.json` y completar:
- `clientId`: ID único (sin espacios, minúsculas)
- `clientName`: Nombre del bar
- `youtube.apiKey`: API Key del cliente
- `payments.wompi.*`: Credenciales Wompi
- Todos los demás campos

### 3. Agregar a lista
Editar `backend/config/clients.json` y agregar:
```json
{
  "clientId": "nuevo-cliente",
  "clientName": "Nombre del Bar",
  "domain": "nuevo-cliente.rockola.com",
  "active": true,
  "createdAt": "2025-11-18",
  "plan": "premium"
}
```

### 4. Crear estructura de datos
```bash
mkdir -p backend/data/nuevo-cliente
echo "[]" > backend/data/nuevo-cliente/queue.json
echo "[]" > backend/data/nuevo-cliente/chat.json
echo "[]" > backend/data/nuevo-cliente/menu.json
```

### 5. Subir assets y reiniciar

---

## 📋 Checklist Antes de Entregar

Antes de entregar al cliente, verificar:

- [ ] Logo subido y se ve correctamente
- [ ] Colores personalizados aplicados
- [ ] Búsqueda de YouTube funciona
- [ ] Sistema de votos funciona
- [ ] Chat funciona con nombre obligatorio
- [ ] Menú de precios cargado
- [ ] Pantalla de video funciona
- [ ] Panel admin funciona con contraseña
- [ ] Si pagos habilitados: prueba de pago real
- [ ] Dominio configurado (si aplica)
- [ ] SSL configurado (si aplica)
- [ ] Backup inicial creado
- [ ] Documentación entregada
- [ ] Capacitación realizada
- [ ] Credenciales enviadas de forma segura

---

## 🎓 Información para el Cliente

### Para obtener YouTube API Key:
1. Ir a: https://console.cloud.google.com/
2. Crear proyecto nuevo
3. Habilitar "YouTube Data API v3"
4. Crear credenciales → API Key
5. Copiar y enviar la API Key

### Para configurar Wompi:
1. Registrarse en: https://comercios.wompi.co/
2. Completar verificación de negocio
3. En producción, copiar:
   - Public Key
   - Private Key
   - Integrity Secret
4. Enviar las credenciales

---

## 💡 Consejos

### Nombres de Cliente ID
- ✅ Buenos: `ciudad-gotica`, `bar-central`, `la-terraza`
- ❌ Malos: `Ciudad Gótica`, `Bar #1`, `mi_bar`

### Seguridad
- Generar contraseñas fuertes (mínimo 12 caracteres)
- No compartir credenciales por WhatsApp sin cifrar
- Usar gestores de contraseñas
- Cambiar contraseña después de capacitación

### Precios Sugeridos
- **Setup Básico**: $500,000 COP
- **Setup Premium**: $800,000 COP
- **Mensualidad**: $100,000 - $150,000 COP
- **Precio prioridad**: $1,000 - $5,000 COP por canción

---

## 🆘 Problemas Comunes

### "API Key inválida"
- Verificar que tenga 39 caracteres
- Verificar que empiece con "AIza"
- Verificar que YouTube API esté habilitada en Google Cloud

### "Cliente no encontrado"
- Reiniciar servidor después de crear cliente
- Verificar que `clients.json` tenga el nuevo cliente
- Verificar que `active: true`

### "Logo no se ve"
- Verificar que archivo esté en `frontend/public/logos/`
- Verificar nombre del archivo coincida con `clientId`
- Limpiar cache del navegador
- Re-desplegar frontend

---

## 📞 Soporte

Si tienes dudas durante el proceso:
1. Revisar logs del servidor
2. Verificar archivos de configuración
3. Consultar documentación completa en `CONFIG-MULTI-TENANT.md`
4. Contactar al desarrollador

---

**Tiempo estimado por cliente**: 15-30 minutos
