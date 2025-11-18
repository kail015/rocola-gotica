# Guía de Configuración Multi-Tenant - Rockola para Bares

## 📋 Descripción del Sistema

Este sistema permite vender la Rockola a múltiples bares, donde cada uno tiene:
- ✅ Su propia cuota de YouTube (API Key independiente)
- ✅ Su propia pasarela de pagos Wompi
- ✅ Personalización visual (logo, colores, nombre)
- ✅ Base de datos separada por cliente

---

## 🏗️ Arquitectura Multi-Tenant

### Opción 1: Un servidor con múltiples configuraciones (Recomendada para empezar)
Cada bar tiene su propio subdominio y configuración:
- `ciudad-gotica.rockola.com` → Cliente 1
- `bar-ejemplo.rockola.com` → Cliente 2
- `otro-bar.rockola.com` → Cliente 3

### Opción 2: Instancia separada por cliente (Más costoso pero más aislado)
Cada bar tiene su propio servidor completamente independiente.

---

## 📁 Estructura de Archivos

```
rocola-gotica/
├── backend/
│   ├── server.js
│   ├── config/
│   │   ├── clients.json          # Lista de clientes y sus configuraciones
│   │   └── ciudad-gotica.json    # Ejemplo de configuración de cliente
│   ├── data/
│   │   ├── ciudad-gotica/        # Datos del cliente 1
│   │   │   ├── queue.json
│   │   │   ├── chat.json
│   │   │   └── menu.json
│   │   └── bar-ejemplo/          # Datos del cliente 2
│   │       ├── queue.json
│   │       ├── chat.json
│   │       └── menu.json
│   └── ...
├── frontend/
│   └── ...
└── README.md
```

---

## 🔧 Configuración por Cliente

### Archivo: `backend/config/ciudad-gotica.json`

```json
{
  "clientId": "ciudad-gotica",
  "clientName": "Ciudad Gótica Licores",
  "domain": "ciudad-gotica.rockola.com",
  
  "branding": {
    "logo": "/logos/ciudad-gotica.png",
    "primaryColor": "#ff914d",
    "secondaryColor": "#0a1628",
    "backgroundImage": "/backgrounds/ciudad-gotica.png"
  },
  
  "youtube": {
    "apiKey": "AIzaSyDBzDvHctztTDoOLD4wEE8fOQPY8nmmRac",
    "quotaLimit": 10000
  },
  
  "payments": {
    "enabled": true,
    "provider": "wompi",
    "wompi": {
      "publicKey": "pub_test_XXXXXXXXXX",
      "privateKey": "prv_test_XXXXXXXXXX",
      "integritySecret": "test_integrity_XXXXXXXXXX",
      "currency": "COP",
      "priorityPrice": 1000
    }
  },
  
  "features": {
    "chat": true,
    "menu": true,
    "voting": true,
    "payments": true,
    "randomPlay": true
  },
  
  "contact": {
    "phone": "3208504177",
    "email": "contacto@ciudadgotica.com",
    "address": "Dirección del bar"
  }
}
```

---

## 🚀 Pasos para Implementar

### 1. Crear Sistema de Configuración

Necesitas modificar el backend para cargar la configuración según el dominio:

**backend/config-loader.js**
```javascript
const fs = require('fs');
const path = require('path');

class ConfigLoader {
  constructor() {
    this.configsPath = path.join(__dirname, 'config');
    this.clients = this.loadClients();
  }

  loadClients() {
    const clientsFile = path.join(this.configsPath, 'clients.json');
    return JSON.parse(fs.readFileSync(clientsFile, 'utf8'));
  }

  getClientByDomain(domain) {
    const client = this.clients.find(c => c.domain === domain);
    if (!client) {
      throw new Error(`Cliente no encontrado para dominio: ${domain}`);
    }
    
    const configFile = path.join(this.configsPath, `${client.clientId}.json`);
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }

  getClientById(clientId) {
    const configFile = path.join(this.configsPath, `${clientId}.json`);
    return JSON.parse(fs.readFileSync(configFile, 'utf8'));
  }
}

module.exports = new ConfigLoader();
```

### 2. Modificar el Backend

**backend/server.js** - Agregar al inicio:
```javascript
const configLoader = require('./config-loader');

// Middleware para identificar el cliente
app.use((req, res, next) => {
  const domain = req.hostname;
  try {
    req.clientConfig = configLoader.getClientByDomain(domain);
    req.clientId = req.clientConfig.clientId;
  } catch (error) {
    return res.status(404).json({ error: 'Cliente no encontrado' });
  }
  next();
});

// Usar la API Key del cliente para YouTube
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  const youtubeApiKey = req.clientConfig.youtube.apiKey;
  
  // ... resto del código usando youtubeApiKey
});
```

### 3. Integrar Wompi

**backend/wompi-payment.js**
```javascript
const axios = require('axios');
const crypto = require('crypto');

class WompiPayment {
  constructor(clientConfig) {
    this.publicKey = clientConfig.payments.wompi.publicKey;
    this.privateKey = clientConfig.payments.wompi.privateKey;
    this.integritySecret = clientConfig.payments.wompi.integritySecret;
    this.currency = clientConfig.payments.wompi.currency;
    this.baseURL = 'https://production.wompi.co/v1';
  }

  async createPaymentLink(amount, reference, description) {
    const integrity = this.generateIntegrity(reference, amount);
    
    const payload = {
      public_key: this.publicKey,
      currency: this.currency,
      amount_in_cents: amount * 100, // Wompi usa centavos
      reference: reference,
      redirect_url: `https://${domain}/payment-success`,
      payment_method: {
        type: 'NEQUI'
      }
    };

    try {
      const response = await axios.post(
        `${this.baseURL}/transactions`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.privateKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        paymentUrl: response.data.data.payment_link_url,
        transactionId: response.data.data.id,
        reference: reference
      };
    } catch (error) {
      console.error('Error creando pago Wompi:', error);
      return { success: false, error: error.message };
    }
  }

  generateIntegrity(reference, amount) {
    const data = `${reference}${amount}${this.currency}${this.integritySecret}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  async verifyPayment(transactionId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.publicKey}`
          }
        }
      );

      return {
        paid: response.data.data.status === 'APPROVED',
        status: response.data.data.status,
        data: response.data.data
      };
    } catch (error) {
      console.error('Error verificando pago:', error);
      return { paid: false, error: error.message };
    }
  }
}

module.exports = WompiPayment;
```

### 4. Modificar Rutas de Datos

Cada cliente debe tener su propia carpeta de datos:

```javascript
const getDataPath = (clientId, file) => {
  const dir = path.join(__dirname, 'data', clientId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, file);
};

// Ejemplo de uso:
app.get('/api/queue', (req, res) => {
  const queuePath = getDataPath(req.clientId, 'queue.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  res.json(queue);
});
```

---

## 💰 Modelo de Negocio Sugerido

### Precios de Venta:
- **Setup inicial**: $500,000 - $1,000,000 COP por bar
- **Mensualidad**: $50,000 - $150,000 COP por bar (hosting + soporte)
- **Comisión por transacción**: 5-10% de cada pago de prioridad (opcional)

### Costos por Cliente:
- **Hosting Render**: Gratis (Free tier) o $7 USD/mes (Starter)
- **Hosting Netlify**: Gratis (Free tier)
- **Wompi**: Sin costo de setup, solo comisiones por transacción (3.5% + $900 COP)
- **YouTube API**: Gratis hasta 10,000 unidades/día

---

## 📦 Paquetes para Clientes

### BÁSICO - $500,000 setup
- Cola de canciones
- Sistema de votos
- Chat con usuarios
- Menú de precios
- Pantalla de video
- Tu propia API de YouTube

### PREMIUM - $800,000 setup
- Todo lo de BÁSICO +
- Pagos con Wompi (prioridad de canciones)
- Personalización completa (logo, colores)
- Soporte prioritario
- Estadísticas de uso

### ENTERPRISE - Cotización personalizada
- Todo lo de PREMIUM +
- Instalación en servidor propio
- Integraciones personalizadas
- App móvil branded
- Dashboard de administración avanzado

---

## 🔐 Seguridad

1. **Aislamiento de datos**: Cada cliente tiene su carpeta de datos
2. **API Keys separadas**: Nunca compartir las credenciales entre clientes
3. **Backup automático**: Configurar backups diarios por cliente
4. **SSL/HTTPS**: Obligatorio para todos los dominios
5. **Rate limiting**: Por cliente para evitar abuso

---

## 📝 Checklist para Nuevo Cliente

- [ ] Crear archivo de configuración en `backend/config/{clientId}.json`
- [ ] Agregar entrada en `backend/config/clients.json`
- [ ] Solicitar al cliente su API Key de YouTube
- [ ] Configurar cuenta de Wompi del cliente
- [ ] Crear carpeta de datos en `backend/data/{clientId}/`
- [ ] Subir logo y assets del cliente
- [ ] Configurar dominio/subdominio
- [ ] Configurar SSL
- [ ] Hacer pruebas de pagos en modo sandbox
- [ ] Capacitar al personal del bar
- [ ] Entregar credenciales de administrador

---

## 🆘 Soporte

Para cada cliente nuevo, considera ofrecer:
- ✅ Video tutorial de uso
- ✅ Manual de administración
- ✅ Soporte por WhatsApp (primer mes gratis)
- ✅ Actualizaciones incluidas
- ✅ Backup semanal de datos

---

## 🚀 Próximos Pasos

1. Crear los archivos de configuración base
2. Modificar el backend para soportar multi-tenant
3. Integrar Wompi en lugar de Nequi
4. Crear panel de administración para gestionar clientes
5. Preparar documentación para clientes
6. Definir precios y paquetes finales

¿Quieres que empiece a implementar alguna de estas partes?
