import fs from 'fs';
import { ConfigManager, initializeConfig, AppConfig } from './config';

jest.mock('fs');

describe('ConfigManager', () => {
  const mockConfig: AppConfig = {
    providers: {
      bigmodel: {
        name: '智谱AI (BigModel)',
        targetHost: 'open.bigmodel.cn',
        targetProtocol: 'https',
        apiToken: 'test-token-123',
        basePath: '/api/coding/paas/v4',
        description: '智谱AI大模型平台'
      },
      openai: {
        name: 'OpenAI',
        targetHost: 'api.openai.com',
        targetProtocol: 'https',
        apiToken: 'sk-test-openai',
        basePath: '/v1',
        description: 'OpenAI API'
      }
    },
    gateway: {
      port: 8888,
      host: 'localhost',
      maxRecords: 50
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));
  });

  describe('constructor', () => {
    it('should load config from file', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      expect(fs.readFileSync).toHaveBeenCalled();
      expect(manager.getCurrentProvider()).toBe('bigmodel');
    });

    it('should use default config when file not found', () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });
      
      const manager = new ConfigManager('nonexistent.json', 'bigmodel');
      const config = manager.getConfig();
      
      expect(config.gateway.port).toBe(8888);
      expect(config.providers['bigmodel']).toBeDefined();
    });
  });

  describe('getProviderConfig', () => {
    it('should return current provider config when no provider name given', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      const config = manager.getProviderConfig();
      
      expect(config.name).toBe('智谱AI (BigModel)');
      expect(config.targetHost).toBe('open.bigmodel.cn');
    });

    it('should return specified provider config', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      const config = manager.getProviderConfig('openai');
      
      expect(config.name).toBe('OpenAI');
      expect(config.targetHost).toBe('api.openai.com');
    });

    it('should throw error for non-existent provider', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      expect(() => manager.getProviderConfig('nonexistent')).toThrow(
        "Provider 'nonexistent' not found in configuration"
      );
    });
  });

  describe('setCurrentProvider', () => {
    it('should change current provider', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      manager.setCurrentProvider('openai');
      
      expect(manager.getCurrentProvider()).toBe('openai');
    });

    it('should throw error for non-existent provider', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      expect(() => manager.setCurrentProvider('nonexistent')).toThrow(
        "Provider 'nonexistent' not found in configuration"
      );
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of provider names', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      const providers = manager.getAvailableProviders();
      
      expect(providers).toContain('bigmodel');
      expect(providers).toContain('openai');
      expect(providers.length).toBe(2);
    });
  });

  describe('getGatewayConfig', () => {
    it('should return gateway configuration', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      const gateway = manager.getGatewayConfig();
      
      expect(gateway.port).toBe(8888);
      expect(gateway.host).toBe('localhost');
      expect(gateway.maxRecords).toBe(50);
    });
  });

  describe('validateProvider', () => {
    it('should return true for valid provider', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      expect(manager.validateProvider('bigmodel')).toBe(true);
      expect(manager.validateProvider('openai')).toBe(true);
    });

    it('should return false for invalid provider', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      expect(manager.validateProvider('nonexistent')).toBe(false);
    });
  });

  describe('reloadConfig', () => {
    it('should reload config from file', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      
      const newConfig: AppConfig = {
        providers: {
          anthropic: {
            name: 'Anthropic',
            targetHost: 'api.anthropic.com',
            targetProtocol: 'https',
            apiToken: 'sk-ant-test',
            basePath: '/v1',
            description: 'Anthropic API'
          }
        },
        gateway: {
          port: 9999,
          host: '127.0.0.1',
          maxRecords: 100
        }
      };
      
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(newConfig));
      
      manager.reloadConfig();
      
      expect(manager.getAvailableProviders()).toContain('anthropic');
      expect(manager.getGatewayConfig().port).toBe(9999);
    });
  });

  describe('getConfig', () => {
    it('should return full config object', () => {
      const manager = new ConfigManager('test-config.json', 'bigmodel');
      const config = manager.getConfig();
      
      expect(config.providers).toBeDefined();
      expect(config.gateway).toBeDefined();
    });
  });
});

describe('initializeConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mockConfig: AppConfig = {
      providers: {
        bigmodel: {
          name: '智谱AI (BigModel)',
          targetHost: 'open.bigmodel.cn',
          targetProtocol: 'https',
          apiToken: 'test-token',
          basePath: '/api/coding/paas/v4',
          description: '智谱AI大模型平台'
        }
      },
      gateway: {
        port: 8888,
        host: 'localhost',
        maxRecords: 50
      }
    };
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockConfig));
  });

  it('should create and return ConfigManager instance', () => {
    const manager = initializeConfig('test-config.json', 'bigmodel');
    
    expect(manager).toBeInstanceOf(ConfigManager);
    expect(manager.getCurrentProvider()).toBe('bigmodel');
  });
});
