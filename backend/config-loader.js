import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Sistema de carga de configuración multi-tenant
 * Permite que cada cliente (bar) tenga su propia configuración independiente
 */
class ConfigLoader {
  constructor() {
    this.configsPath = join(__dirname, 'config');
    this.clientsCache = new Map();
    this.loadAllClients();
  }

  /**
   * Carga todos los clientes desde clients.json
   */
  loadAllClients() {
    try {
      const clientsFile = join(this.configsPath, 'clients.json');
      const clientsList = JSON.parse(readFileSync(clientsFile, 'utf8'));
      
      clientsList.forEach(client => {
        if (client.active) {
          const config = this.loadClientConfig(client.clientId);
          this.clientsCache.set(client.clientId, config);
          
          // También cachear por dominio
          this.clientsCache.set(client.domain, config);
          
          // Cachear dominios alternativos
          if (client.altDomains) {
            client.altDomains.forEach(domain => {
              this.clientsCache.set(domain, config);
            });
          }
        }
      });

      console.log(`✅ Cargadas ${this.clientsCache.size / 2} configuraciones de clientes`);
    } catch (error) {
      console.error('❌ Error cargando clientes:', error);
      throw error;
    }
  }

  /**
   * Carga la configuración de un cliente específico
   */
  loadClientConfig(clientId) {
    const configFile = join(this.configsPath, `${clientId}.json`);
    
    if (!existsSync(configFile)) {
      throw new Error(`Configuración no encontrada para cliente: ${clientId}`);
    }

    return JSON.parse(readFileSync(configFile, 'utf8'));
  }

  /**
   * Obtiene configuración por dominio
   */
  getClientByDomain(domain) {
    // Normalizar dominio (remover www, puerto, etc)
    const normalizedDomain = domain.replace(/^www\./, '').split(':')[0];
    
    const config = this.clientsCache.get(normalizedDomain);
    
    if (!config) {
      // Buscar en localhost para desarrollo
      if (normalizedDomain === 'localhost' || normalizedDomain === '127.0.0.1') {
        return this.clientsCache.get('localhost') || this.getDefaultClient();
      }
      
      console.warn(`⚠️ Cliente no encontrado para dominio: ${normalizedDomain}`);
      return this.getDefaultClient();
    }

    return config;
  }

  /**
   * Obtiene configuración por ID de cliente
   */
  getClientById(clientId) {
    return this.clientsCache.get(clientId);
  }

  /**
   * Obtiene cliente por defecto (para desarrollo)
   */
  getDefaultClient() {
    return this.clientsCache.get('ciudad-gotica');
  }

  /**
   * Lista todos los clientes activos
   */
  getAllClients() {
    const clientsFile = join(this.configsPath, 'clients.json');
    const clientsList = JSON.parse(readFileSync(clientsFile, 'utf8'));
    return clientsList.filter(c => c.active);
  }

  /**
   * Recarga la configuración de un cliente (útil para actualizaciones sin reiniciar)
   */
  reloadClient(clientId) {
    try {
      const config = this.loadClientConfig(clientId);
      this.clientsCache.set(clientId, config);
      this.clientsCache.set(config.domain, config);
      console.log(`✅ Configuración recargada para: ${clientId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error recargando cliente ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Valida que un cliente tenga toda la configuración necesaria
   */
  validateClientConfig(clientId) {
    const config = this.getClientById(clientId);
    
    if (!config) {
      return { valid: false, errors: ['Cliente no encontrado'] };
    }

    const errors = [];
    
    // Validar campos requeridos
    if (!config.clientName) errors.push('Falta clientName');
    if (!config.domain) errors.push('Falta domain');
    if (!config.youtube?.apiKey) errors.push('Falta YouTube API Key');
    if (!config.branding?.logo) errors.push('Falta logo');
    if (!config.branding?.primaryColor) errors.push('Falta color primario');
    
    // Validar pagos si están habilitados
    if (config.payments?.enabled) {
      if (!config.payments.wompi?.publicKey) errors.push('Falta Wompi publicKey');
      if (!config.payments.wompi?.privateKey) errors.push('Falta Wompi privateKey');
      if (!config.payments.wompi?.integritySecret) errors.push('Falta Wompi integritySecret');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  /**
   * Crea estructura de datos para un nuevo cliente
   */
  initializeClientData(clientId) {
    const dataDir = join(__dirname, 'data', clientId);
    
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
      
      // Crear archivos iniciales
      writeFileSync(join(dataDir, 'queue.json'), '[]');
      writeFileSync(join(dataDir, 'chat.json'), '[]');
      writeFileSync(join(dataDir, 'menu.json'), '[]');
      
      console.log(`✅ Estructura de datos creada para: ${clientId}`);
      return true;
    }
    
    return false;
  }

  /**
   * Singleton instance
   */
  static getInstance() {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }
}

// Exportar clase
export { ConfigLoader };
