import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${colors.blue}${prompt}${colors.reset}`, resolve);
  });
}

// Generar ID único desde el nombre
function generateClientId(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remover acentos
    .replace(/[^a-z0-9]/g, '-')       // Reemplazar caracteres especiales con guiones
    .replace(/-+/g, '-')              // Remover guiones duplicados
    .replace(/^-|-$/g, '');           // Remover guiones al inicio/final
}

// Generar contraseña segura
function generatePassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Validar API Key de YouTube
function isValidYouTubeApiKey(key) {
  return key && key.length === 39 && key.startsWith('AIza');
}

// Crear estructura de directorios
function createDirectories(clientId) {
  const dataDir = path.join(__dirname, 'data', clientId);
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    
    // Crear archivos JSON vacíos
    fs.writeFileSync(path.join(dataDir, 'queue.json'), '[]');
    fs.writeFileSync(path.join(dataDir, 'chat.json'), '[]');
    fs.writeFileSync(path.join(dataDir, 'menu.json'), '[]');
    
    log(`✓ Estructura de datos creada en: ${dataDir}`, 'green');
  } else {
    log(`⚠ La carpeta de datos ya existe`, 'yellow');
  }
}

// Crear archivo de configuración
function createConfigFile(clientId, config) {
  const configPath = path.join(__dirname, 'config', `${clientId}.json`);
  
  if (fs.existsSync(configPath)) {
    log(`⚠ Ya existe una configuración para este cliente`, 'yellow');
    return false;
  }
  
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  log(`✓ Configuración creada: ${configPath}`, 'green');
  return true;
}

// Actualizar clients.json
function updateClientsList(clientEntry) {
  const clientsPath = path.join(__dirname, 'config', 'clients.json');
  const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
  
  // Verificar si ya existe
  const exists = clients.find(c => c.clientId === clientEntry.clientId);
  if (exists) {
    log(`⚠ El cliente ya está en la lista`, 'yellow');
    return false;
  }
  
  clients.push(clientEntry);
  fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
  log(`✓ Cliente agregado a clients.json`, 'green');
  return true;
}

// Función principal
async function createNewClient() {
  log('\n╔═══════════════════════════════════════════════════════════╗', 'bright');
  log('║          🎵 CREAR NUEVO CLIENTE - ROCKOLA 🎵              ║', 'bright');
  log('╚═══════════════════════════════════════════════════════════╝\n', 'bright');

  try {
    // 1. Información básica
    log('📋 INFORMACIÓN BÁSICA\n', 'yellow');
    
    const clientName = await question('Nombre del bar: ');
    if (!clientName) {
      throw new Error('El nombre del bar es obligatorio');
    }
    
    const clientId = generateClientId(clientName);
    log(`   ID generado: ${clientId}\n`, 'blue');
    
    const domain = await question(`Dominio (Enter para: ${clientId}.rockola.com): `);
    const finalDomain = domain || `${clientId}.rockola.com`;
    
    // 2. Configuración de YouTube
    log('\n🎬 CONFIGURACIÓN DE YOUTUBE\n', 'yellow');
    log('El cliente debe crear su propia API Key en:', 'blue');
    log('https://console.cloud.google.com/\n', 'blue');
    
    let youtubeApiKey = await question('API Key de YouTube: ');
    while (!isValidYouTubeApiKey(youtubeApiKey)) {
      log('⚠ API Key inválida. Debe tener 39 caracteres y empezar con "AIza"', 'red');
      youtubeApiKey = await question('API Key de YouTube: ');
    }
    
    // 3. Configuración de pagos
    log('\n💳 CONFIGURACIÓN DE PAGOS (WOMPI)\n', 'yellow');
    
    const paymentsEnabled = await question('¿Habilitar pagos? (s/n): ');
    const enablePayments = paymentsEnabled.toLowerCase() === 's';
    
    let wompiConfig = {
      publicKey: '',
      privateKey: '',
      integritySecret: '',
      currency: 'COP',
      priorityPrice: 1000,
      environment: 'production'
    };
    
    if (enablePayments) {
      log('El cliente debe registrarse en: https://comercios.wompi.co/', 'blue');
      wompiConfig.publicKey = await question('Public Key (pub_prod_...): ');
      wompiConfig.privateKey = await question('Private Key (prv_prod_...): ');
      wompiConfig.integritySecret = await question('Integrity Secret (prod_integrity_...): ');
      
      const price = await question('Precio de prioridad (Enter para $1,000): ');
      wompiConfig.priorityPrice = parseInt(price) || 1000;
    }
    
    // 4. Información de contacto
    log('\n📞 INFORMACIÓN DE CONTACTO\n', 'yellow');
    
    const phone = await question('Teléfono: ');
    const email = await question('Email: ');
    const whatsapp = await question('WhatsApp (ej: 573208504177): ');
    const address = await question('Dirección: ');
    
    // 5. Configuración administrativa
    log('\n🔐 CONFIGURACIÓN ADMINISTRATIVA\n', 'yellow');
    
    const adminPassword = generatePassword();
    log(`   Contraseña generada: ${adminPassword}`, 'green');
    const customPassword = await question('¿Usar otra contraseña? (Enter para usar la generada): ');
    const finalPassword = customPassword || adminPassword;
    
    const adminEmail = await question(`Email admin (Enter para: admin@${clientId}.com): `);
    const finalAdminEmail = adminEmail || `admin@${clientId}.com`;
    
    // 6. Plan y facturación
    log('\n💰 PLAN Y FACTURACIÓN\n', 'yellow');
    log('Planes disponibles: basico, premium, enterprise', 'blue');
    
    const plan = await question('Plan (Enter para "premium"): ') || 'premium';
    const setupFee = await question('Setup fee (Enter para $800,000): ');
    const monthlyFee = await question('Mensualidad (Enter para $100,000): ');
    
    // 7. Colores personalizados (opcional)
    log('\n🎨 PERSONALIZACIÓN (Opcional - Enter para usar defaults)\n', 'yellow');
    
    const primaryColor = await question('Color primario (Enter para #ff914d): ') || '#ff914d';
    const secondaryColor = await question('Color secundario (Enter para #0a1628): ') || '#0a1628';
    
    // 8. Crear configuración completa
    log('\n⚙️ CREANDO CONFIGURACIÓN...\n', 'yellow');
    
    const config = {
      clientId: clientId,
      clientName: clientName,
      domain: finalDomain,
      active: true,
      
      branding: {
        logo: `/logos/${clientId}.png`,
        backgroundImage: `/backgrounds/${clientId}.png`,
        primaryColor: primaryColor,
        secondaryColor: secondaryColor,
        accentColor: '#ff7a2f',
        darkColor: '#152238'
      },
      
      youtube: {
        apiKey: youtubeApiKey,
        quotaLimit: 10000,
        maxResults: 50,
        cacheEnabled: true,
        cacheDuration: 1800000
      },
      
      payments: {
        enabled: enablePayments,
        provider: 'wompi',
        wompi: wompiConfig
      },
      
      features: {
        chat: true,
        menu: true,
        voting: true,
        payments: enablePayments,
        randomPlay: true,
        userNameRequired: true,
        videoScreen: true
      },
      
      limits: {
        maxQueueSize: 100,
        maxChatMessages: 500,
        maxMenuItems: 50,
        searchResultsPerQuery: 50
      },
      
      contact: {
        phone: phone,
        email: email,
        address: address,
        whatsapp: whatsapp
      },
      
      admin: {
        password: finalPassword,
        email: finalAdminEmail
      },
      
      metadata: {
        createdAt: new Date().toISOString().split('T')[0],
        plan: plan,
        monthlyFee: parseInt(monthlyFee) || 100000,
        setupFee: parseInt(setupFee) || 800000,
        expiresAt: null,
        notes: ''
      }
    };
    
    const clientEntry = {
      clientId: clientId,
      clientName: clientName,
      domain: finalDomain,
      altDomains: ['localhost'],
      active: true,
      createdAt: config.metadata.createdAt,
      plan: plan
    };
    
    // 9. Crear archivos y directorios
    createDirectories(clientId);
    createConfigFile(clientId, config);
    updateClientsList(clientEntry);
    
    // 10. Resumen final
    log('\n╔═══════════════════════════════════════════════════════════╗', 'green');
    log('║                  ✅ CLIENTE CREADO ✅                      ║', 'green');
    log('╚═══════════════════════════════════════════════════════════╝\n', 'green');
    
    log('📋 RESUMEN DEL CLIENTE\n', 'bright');
    log(`   Cliente ID:      ${clientId}`, 'blue');
    log(`   Nombre:          ${clientName}`, 'blue');
    log(`   Dominio:         ${finalDomain}`, 'blue');
    log(`   Plan:            ${plan}`, 'blue');
    log(`   Pagos:           ${enablePayments ? 'Habilitados' : 'Deshabilitados'}`, 'blue');
    log(`   Contraseña Admin: ${finalPassword}`, 'bright');
    
    log('\n📝 PRÓXIMOS PASOS:\n', 'yellow');
    log('1. Subir logo del cliente a: frontend/public/logos/' + clientId + '.png');
    log('2. Subir fondo (opcional) a: frontend/public/backgrounds/' + clientId + '.png');
    log('3. Configurar DNS/subdominio en Netlify');
    log('4. Reiniciar servidor para cargar nueva configuración');
    log('5. Probar acceso en: http://localhost:3001');
    log('6. Capacitar al cliente y entregar credenciales\n');
    
    log('💾 ARCHIVOS CREADOS:\n', 'green');
    log(`   - backend/config/${clientId}.json`);
    log(`   - backend/data/${clientId}/queue.json`);
    log(`   - backend/data/${clientId}/chat.json`);
    log(`   - backend/data/${clientId}/menu.json\n`);
    
    // Guardar resumen en archivo
    const summaryPath = path.join(__dirname, 'data', clientId, 'RESUMEN.txt');
    const summary = `
ROCKOLA - CLIENTE NUEVO
=======================

Cliente ID: ${clientId}
Nombre: ${clientName}
Dominio: ${finalDomain}
Fecha de creación: ${config.metadata.createdAt}

CREDENCIALES
============
Admin Email: ${finalAdminEmail}
Admin Password: ${finalPassword}

CONFIGURACIÓN
=============
YouTube API Key: ${youtubeApiKey}
Pagos habilitados: ${enablePayments ? 'Sí' : 'No'}
${enablePayments ? `Wompi Public Key: ${wompiConfig.publicKey}` : ''}
${enablePayments ? `Precio prioridad: $${wompiConfig.priorityPrice}` : ''}

CONTACTO
========
Teléfono: ${phone}
Email: ${email}
WhatsApp: ${whatsapp}
Dirección: ${address}

FACTURACIÓN
===========
Plan: ${plan}
Setup Fee: $${config.metadata.setupFee.toLocaleString()}
Mensualidad: $${config.metadata.monthlyFee.toLocaleString()}

PRÓXIMOS PASOS
==============
1. Subir logo: frontend/public/logos/${clientId}.png
2. Subir fondo: frontend/public/backgrounds/${clientId}.png
3. Configurar DNS/subdominio
4. Reiniciar servidor
5. Capacitar cliente
6. Entregar credenciales

Generado automáticamente el ${new Date().toLocaleString()}
`;
    
    fs.writeFileSync(summaryPath, summary);
    log(`📄 Resumen guardado en: ${summaryPath}\n`, 'green');
    
  } catch (error) {
    log(`\n❌ ERROR: ${error.message}\n`, 'red');
  } finally {
    rl.close();
  }
}

// Ejecutar
log('\n🚀 Iniciando asistente de creación de cliente...\n', 'bright');
createNewClient();
