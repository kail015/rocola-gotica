# 🎵 Guía para Configurar un Nuevo Cliente - Rockola para Bares

## 📋 Lista de Verificación para Nuevo Cliente

### 1️⃣ Información Básica del Cliente
- [ ] Nombre del bar
- [ ] Logo del bar (formato PNG, 500x500px recomendado)
- [ ] Imagen de fondo (opcional, 1920x1080px recomendado)
- [ ] Colores corporativos (primario, secundario, acento)
- [ ] Dominio deseado (ejemplo: `mi-bar.rockola.com`)

### 2️⃣ Configuración de YouTube
- [ ] Cliente debe crear cuenta de Google Cloud
- [ ] Cliente debe habilitar YouTube Data API v3
- [ ] Cliente debe generar API Key
- [ ] Solicitar incremento de cuota a 1,000,000 unidades/día (opcional)

**Guía rápida para el cliente:**
```
1. Ir a: https://console.cloud.google.com/
2. Crear nuevo proyecto (nombre: "Rockola [Nombre del Bar]")
3. Habilitar YouTube Data API v3
4. Crear credenciales → API Key
5. Copiar la API Key y enviarla
```

### 3️⃣ Configuración de Wompi (Pagos)
- [ ] Cliente debe registrarse en Wompi: https://comercios.wompi.co/
- [ ] Completar proceso de verificación
- [ ] Obtener llaves de producción:
  - Public Key (empieza con `pub_prod_`)
  - Private Key (empieza con `prv_prod_`)
  - Integrity Secret (empieza con `prod_integrity_`)

**Notas sobre Wompi:**
- Gratuito configurar cuenta
- Comisión por transacción: 3.5% + $900 COP
- Pagos instantáneos
- Soporta: Nequi, PSE, Tarjetas de crédito/débito, Bancolombia

### 4️⃣ Información de Contacto
- [ ] Teléfono del bar
- [ ] Email del bar
- [ ] WhatsApp (para soporte)
- [ ] Dirección física

### 5️⃣ Configuración del Sistema
- [ ] Contraseña de administrador (generada segura)
- [ ] Precio de prioridad de canciones (sugerido: $1,000 - $5,000 COP)
- [ ] Plan contratado (Básico/Premium/Enterprise)

---

## 🛠️ Pasos de Instalación

### Paso 1: Crear Archivo de Configuración

```bash
# Copiar plantilla
cp backend/config/TEMPLATE.json backend/config/nuevo-cliente.json

# Editar con datos del cliente
nano backend/config/nuevo-cliente.json
```

Completar todos los campos:
- `clientId`: ID único (sin espacios, lowercase, guiones permitidos)
- `clientName`: Nombre completo del bar
- `domain`: Dominio asignado
- `youtube.apiKey`: API Key del cliente
- `payments.wompi.*`: Credenciales de Wompi del cliente
- `contact.*`: Información de contacto
- `admin.password`: Contraseña segura generada

### Paso 2: Agregar a Lista de Clientes

```bash
# Editar clients.json
nano backend/config/clients.json
```

Agregar entrada:
```json
{
  "clientId": "nuevo-cliente",
  "clientName": "Nuevo Bar",
  "domain": "nuevo-bar.rockola.com",
  "altDomains": [],
  "active": true,
  "createdAt": "2025-11-18",
  "plan": "premium"
}
```

### Paso 3: Inicializar Estructura de Datos

```bash
# Crear carpeta de datos
mkdir -p backend/data/nuevo-cliente

# Crear archivos vacíos
echo "[]" > backend/data/nuevo-cliente/queue.json
echo "[]" > backend/data/nuevo-cliente/chat.json
echo "[]" > backend/data/nuevo-cliente/menu.json
```

### Paso 4: Subir Assets del Cliente

```bash
# Crear carpeta de assets
mkdir -p frontend/public/logos
mkdir -p frontend/public/backgrounds

# Copiar logo y fondo del cliente
cp logo-cliente.png frontend/public/logos/nuevo-cliente.png
cp fondo-cliente.png frontend/public/backgrounds/nuevo-cliente.png
```

### Paso 5: Configurar Subdominio

**En Netlify:**
1. Ir a Domain Settings
2. Agregar custom domain: `nuevo-bar.rockola.com`
3. Configurar DNS (A/CNAME records)
4. Esperar verificación SSL

**DNS Records:**
```
Type: CNAME
Name: nuevo-bar
Value: rockola-ciudad-gotica-licores.netlify.app
TTL: 3600
```

### Paso 6: Probar Configuración

```bash
# Ejecutar validación
node backend/validate-config.js nuevo-cliente

# Iniciar servidor de prueba
npm run dev

# Verificar en navegador
# http://localhost:3001?client=nuevo-cliente
```

### Paso 7: Desplegar a Producción

```bash
# Commit cambios
git add .
git commit -m "feat: Agregar cliente nuevo-bar"
git push origin main

# Netlify y Render desplegarán automáticamente
```

---

## 🧪 Pruebas Requeridas

Antes de entregar al cliente:

### Funcionalidad Básica
- [ ] Página carga correctamente con logo del cliente
- [ ] Colores personalizados se aplican
- [ ] Búsqueda de YouTube funciona
- [ ] Agregar canciones a la cola funciona
- [ ] Sistema de votos funciona
- [ ] Chat funciona
- [ ] Menú se muestra correctamente
- [ ] Pantalla de video funciona

### Sistema de Pagos (si está habilitado)
- [ ] Botón de prioridad se muestra
- [ ] Redirección a Wompi funciona
- [ ] Pago en modo sandbox completa exitosamente
- [ ] Webhook de confirmación funciona
- [ ] Canción sube en la cola al confirmar pago
- [ ] **IMPORTANTE**: Probar en producción con pago real pequeño

### Panel de Administración
- [ ] Login con contraseña del cliente funciona
- [ ] Ver cola de canciones
- [ ] Eliminar canciones
- [ ] Gestionar menú
- [ ] Ver estadísticas

---

## 📄 Documentación para Entregar al Cliente

Crear carpeta con:
1. **Manual de Usuario** (PDF)
   - Cómo usar la rockola
   - Cómo agregar canciones
   - Cómo votar
   - Cómo priorizar con pago

2. **Manual de Administrador** (PDF)
   - Login al panel admin
   - Gestión de cola
   - Gestión de menú
   - Moderación de chat

3. **Credenciales** (archivo encriptado)
   - URL de acceso
   - Contraseña admin
   - API Keys (guardar copia)
   - Credenciales Wompi

4. **Información de Soporte**
   - WhatsApp de soporte
   - Email de soporte
   - Horario de atención
   - Cómo reportar problemas

---

## 💰 Facturación

### Setup Fee (Una vez)
- Plan Básico: $500,000 COP
- Plan Premium: $800,000 COP
- Plan Enterprise: Cotización

### Mensualidad
- Hosting + Soporte: $100,000 - $150,000 COP/mes
- Se cobra el primer día de cada mes
- Incluye:
  - Hosting Netlify + Render
  - Actualizaciones del sistema
  - Soporte técnico
  - Backup de datos
  - Monitoreo 24/7

### Términos de Pago
- Setup fee: 50% al inicio, 50% al entregar
- Mensualidad: Prepago (antes del día 1)
- Mora: 2% diario después de 5 días
- Suspensión: Después de 15 días sin pago

---

## 🎓 Capacitación al Cliente

### Sesión 1: Para el Personal del Bar (1 hora)
- Introducción al sistema
- Cómo funciona para los clientes
- Qué hacer si hay problemas técnicos
- Promocionar uso de la rockola

### Sesión 2: Para el Administrador (1 hora)
- Acceso al panel admin
- Gestión diaria
- Moderación de contenido
- Ver estadísticas
- Actualizar menú/precios

### Material de Apoyo
- Video tutorial grabado
- Infografías de uso
- FAQ impreso para mostrar a clientes del bar

---

## 📞 Soporte Post-Venta

### Primer Mes (Incluido)
- ✅ Soporte ilimitado por WhatsApp
- ✅ Ajustes menores sin costo
- ✅ Capacitaciones adicionales si se requieren
- ✅ Monitoreo activo del sistema

### Después del Primer Mes
- Soporte por tickets (email/WhatsApp)
- Tiempo de respuesta: 24 horas hábiles
- Visitas presenciales: Costo adicional
- Actualizaciones incluidas en mensualidad

---

## 🚨 Troubleshooting Común

### "No encuentra canciones en YouTube"
1. Verificar API Key en configuración
2. Revisar cuota de YouTube (Google Cloud Console)
3. Verificar que API esté habilitada
4. Ver logs del servidor

### "Los pagos no funcionan"
1. Verificar credenciales de Wompi
2. Confirmar que está en modo producción (no sandbox)
3. Revisar logs de Wompi en su dashboard
4. Verificar webhook configurado correctamente

### "El logo no se ve"
1. Verificar que archivo existe en `/public/logos/`
2. Confirmar ruta en config JSON
3. Limpiar cache de Netlify
4. Verificar permisos del archivo

### "Colores no cambian"
1. Verificar HEX codes en config JSON
2. Limpiar cache del navegador
3. Re-desplegar frontend
4. Verificar que clientId coincida

---

## 📊 Checklist de Entrega Final

- [ ] Sistema funcionando 100%
- [ ] Todas las pruebas pasadas
- [ ] Documentación entregada
- [ ] Capacitación completada
- [ ] Cliente puede usar panel admin
- [ ] Backup inicial realizado
- [ ] Monitoreo activado
- [ ] Factura enviada
- [ ] Contrato firmado
- [ ] Información guardada en CRM

---

## 🎉 Post-Entrega

1. Seguimiento a los 7 días
2. Seguimiento al mes
3. Solicitar testimonio/referencia
4. Ofrecer funcionalidades adicionales
5. Recordar pago mensualidad

---

¿Dudas? Contactar al desarrollador principal.
