import fs from 'fs';
import path from 'path';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export interface ProviderConfig {
  name: string;
  targetHost: string;
  targetProtocol: string;
  apiToken: string;
  basePath: string;
  description: string;
  protocol?: 'openai' | 'anthropic';
  models?: ModelInfo[];
  defaultModel?: string;
}

export type ProtocolType = 'openai' | 'anthropic';

export interface GatewayConfig {
  port: number;
  host: string;
  maxRecords: number;
}

export interface AppConfig {
  providers: Record<string, ProviderConfig>;
  gateway: GatewayConfig;
}

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private currentProvider: string;

  constructor(configPath: string = 'config.json', provider?: string) {
    this.configPath = path.resolve(configPath);
    this.config = this.loadConfig();
    this.currentProvider = provider || this.getAvailableProviders()[0] || 'default';
  }

  private loadConfig(): AppConfig {
    try {
      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const parsedConfig: AppConfig = JSON.parse(configData);
      
      // Validate config structure
      if (!parsedConfig.providers || typeof parsedConfig.providers !== 'object') {
        throw new Error('Invalid config: providers section missing');
      }
      
      if (!parsedConfig.gateway) {
        throw new Error('Invalid config: gateway section missing');
      }

      return parsedConfig;
    } catch (error) {
      console.error('Failed to load config:', (error as Error).message);
      console.log('Using default configuration...');
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): AppConfig {
    return {
      providers: {
        bigmodel: {
          name: '智谱AI (BigModel)',
          targetHost: 'open.bigmodel.cn',
          targetProtocol: 'https',
          apiToken: '22e4f5a5e51640bba88c96d16e6c274d.N2zYqp2vSvRf68D4',
          basePath: '/api/coding/paas/v4',
          description: '智谱AI大模型平台',
          protocol: 'openai'
        }
      },
      gateway: {
        port: 8888,
        host: 'localhost',
        maxRecords: 50
      }
    };
  }

  public getProtocol(providerName?: string): ProtocolType {
    const provider = providerName || this.currentProvider;
    const providerConfig = this.getProviderConfig(provider);
    return providerConfig.protocol || 'openai';
  }

  public getConfig(): AppConfig {
    return this.config;
  }

  public getProviderConfig(providerName?: string): ProviderConfig {
    const provider = providerName || this.currentProvider;
    const providerConfig = this.config.providers[provider];
    
    if (!providerConfig) {
      throw new Error(`Provider '${provider}' not found in configuration. Available providers: ${this.getAvailableProviders().join(', ')}`);
    }
    
    return providerConfig;
  }

  public getCurrentProvider(): string {
    return this.currentProvider;
  }

  public setCurrentProvider(provider: string): void {
    if (!this.config.providers[provider]) {
      throw new Error(`Provider '${provider}' not found in configuration`);
    }
    this.currentProvider = provider;
  }

  public getAvailableProviders(): string[] {
    return Object.keys(this.config.providers);
  }

  public getGatewayConfig(): GatewayConfig {
    return this.config.gateway;
  }

  public reloadConfig(): void {
    this.config = this.loadConfig();
  }

  public validateProvider(providerName: string): boolean {
    return providerName in this.config.providers;
  }

  // Validation methods
  private validateProviderConfig(config: ProviderConfig): void {
    if (!config.name || typeof config.name !== 'string') {
      throw new Error('Provider config must have a valid name');
    }
    if (!config.targetHost || typeof config.targetHost !== 'string') {
      throw new Error('Provider config must have a valid targetHost');
    }
    if (!config.targetProtocol || typeof config.targetProtocol !== 'string') {
      throw new Error('Provider config must have a valid targetProtocol');
    }
    if (!config.apiToken || typeof config.apiToken !== 'string') {
      throw new Error('Provider config must have a valid apiToken');
    }
    if (!config.basePath || typeof config.basePath !== 'string') {
      throw new Error('Provider config must have a valid basePath');
    }
    if (!config.description || typeof config.description !== 'string') {
      throw new Error('Provider config must have a valid description');
    }
    if (config.protocol && !['openai', 'anthropic'].includes(config.protocol)) {
      throw new Error('Provider protocol must be either "openai" or "anthropic"');
    }
    if (config.models && !Array.isArray(config.models)) {
      throw new Error('Provider models must be an array');
    }
    if (config.models) {
      for (const model of config.models) {
        if (!model.id || typeof model.id !== 'string') {
          throw new Error('Model must have a valid id');
        }
        if (!model.name || typeof model.name !== 'string') {
          throw new Error('Model must have a valid name');
        }
      }
    }
    if (config.defaultModel && typeof config.defaultModel !== 'string') {
      throw new Error('Default model must be a string');
    }
  }

  private validateConfig(): void {
    if (!this.config.providers || typeof this.config.providers !== 'object') {
      throw new Error('Config must have a valid providers section');
    }
    if (Object.keys(this.config.providers).length === 0) {
      throw new Error('Config must have at least one provider');
    }
    if (!this.config.gateway || typeof this.config.gateway !== 'object') {
      throw new Error('Config must have a valid gateway section');
    }
    if (typeof this.config.gateway.port !== 'number') {
      throw new Error('Gateway port must be a number');
    }
    if (typeof this.config.gateway.host !== 'string') {
      throw new Error('Gateway host must be a string');
    }
    if (typeof this.config.gateway.maxRecords !== 'number') {
      throw new Error('Gateway maxRecords must be a number');
    }
    for (const [id, providerConfig] of Object.entries(this.config.providers)) {
      try {
        this.validateProviderConfig(providerConfig);
      } catch (error) {
        throw new Error(`Invalid config for provider '${id}': ${(error as Error).message}`);
      }
    }
  }

  // Save config to file
  public saveConfig(): void {
    try {
      this.validateConfig();
      const configData = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, configData, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to save config: ${(error as Error).message}`);
    }
  }

  // Dynamic provider management
  public addProvider(id: string, config: ProviderConfig): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a valid string');
    }
    if (this.config.providers[id]) {
      throw new Error(`Provider '${id}' already exists`);
    }
    this.validateProviderConfig(config);
    this.config.providers[id] = config;
    this.saveConfig();
  }

  public removeProvider(id: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a valid string');
    }
    if (!this.config.providers[id]) {
      throw new Error(`Provider '${id}' not found`);
    }
    const providerCount = Object.keys(this.config.providers).length;
    if (providerCount <= 1) {
      throw new Error('Cannot remove the last provider');
    }
    delete this.config.providers[id];
    if (this.currentProvider === id) {
      const availableProviders = Object.keys(this.config.providers);
      this.currentProvider = availableProviders[0] || 'default';
    }
    this.saveConfig();
  }

  public updateProvider(id: string, config: Partial<Omit<ProviderConfig, 'apiToken'>>): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a valid string');
    }
    if (!this.config.providers[id]) {
      throw new Error(`Provider '${id}' not found`);
    }
    const existingProvider = this.config.providers[id];
    this.config.providers[id] = {
      ...existingProvider,
      ...config
    };
    this.saveConfig();
  }

  public updateProviderToken(id: string, token: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a valid string');
    }
    if (!token || typeof token !== 'string') {
      throw new Error('Token must be a valid string');
    }
    if (!this.config.providers[id]) {
      throw new Error(`Provider '${id}' not found`);
    }
    this.config.providers[id].apiToken = token;
    this.saveConfig();
  }

  public updateProviderModels(id: string, models: ModelInfo[]): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a valid string');
    }
    if (!Array.isArray(models)) {
      throw new Error('Models must be an array');
    }
    for (const model of models) {
      if (!model.id || typeof model.id !== 'string') {
        throw new Error('Model must have a valid id');
      }
      if (!model.name || typeof model.name !== 'string') {
        throw new Error('Model must have a valid name');
      }
    }
    if (!this.config.providers[id]) {
      throw new Error(`Provider '${id}' not found`);
    }
    this.config.providers[id].models = models;
    this.saveConfig();
  }

  public setDefaultModel(id: string, modelId: string): void {
    if (!id || typeof id !== 'string') {
      throw new Error('Provider id must be a valid string');
    }
    if (!modelId || typeof modelId !== 'string') {
      throw new Error('Model id must be a valid string');
    }
    if (!this.config.providers[id]) {
      throw new Error(`Provider '${id}' not found`);
    }
    const provider = this.config.providers[id];
    if (provider.models && provider.models.length > 0) {
      const modelExists = provider.models.some(m => m.id === modelId);
      if (!modelExists) {
        throw new Error(`Model '${modelId}' not found in provider '${id}' models list`);
      }
    }
    this.config.providers[id].defaultModel = modelId;
    this.saveConfig();
  }
}

// Singleton instance
let configManagerInstance: ConfigManager | null = null;

export function initializeConfig(configPath?: string, provider?: string): ConfigManager {
  configManagerInstance = new ConfigManager(configPath, provider);
  return configManagerInstance;
}
