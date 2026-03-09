import { IncomingHttpHeaders } from 'http';
import { UrlTransformer } from './url-transformer';
import { ConfigManager, AppConfig } from './config';

jest.mock('fs');

describe('UrlTransformer', () => {
  let mockConfigManager: jest.Mocked<ConfigManager>;
  
  const mockConfig: AppConfig = {
    providers: {
      bigmodel: {
        name: '智谱AI (BigModel)',
        targetHost: 'open.bigmodel.cn',
        targetProtocol: 'https',
        apiToken: 'real-api-token-123',
        basePath: '/api/coding/paas/v4',
        description: '智谱AI大模型平台'
      },
      openai: {
        name: 'OpenAI',
        targetHost: 'api.openai.com',
        targetProtocol: 'https',
        apiToken: 'sk-real-openai-token',
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
    
    mockConfigManager = {
      getProviderConfig: jest.fn().mockReturnValue(mockConfig.providers['bigmodel']),
      getGatewayConfig: jest.fn().mockReturnValue(mockConfig.gateway),
      getCurrentProvider: jest.fn().mockReturnValue('bigmodel'),
      getAvailableProviders: jest.fn().mockReturnValue(['bigmodel', 'openai']),
    } as unknown as jest.Mocked<ConfigManager>;
  });

  describe('parseUserUrl', () => {
    it('should identify gateway request correctly', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('http://localhost:8888/api/coding/paas/v4/chat/completions');
      
      expect(result.isGatewayRequest).toBe(true);
      expect(result.path).toBe('/api/coding/paas/v4/chat/completions');
    });

    it('should extract token from URL query parameter', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('http://localhost:8888/api/coding/paas/v4?token=dummy-token');
      
      expect(result.userToken).toBe('dummy-token');
    });

    it('should return false for non-gateway request', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('http://api.openai.com/v1/chat/completions');
      
      expect(result.isGatewayRequest).toBe(false);
    });

    it('should handle path-only format', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('/api/coding/paas/v4/chat/completions');
      
      expect(result.isGatewayRequest).toBe(false);
      expect(result.path).toBe('/api/coding/paas/v4/chat/completions');
    });

    it('should handle different port', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('http://localhost:3000/api/test');
      
      expect(result.isGatewayRequest).toBe(false);
    });
  });

  describe('transformRequest', () => {
    it('should transform gateway URL to target URL', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {
        'authorization': 'Bearer dummy-token',
        'content-type': 'application/json'
      };
      
      const result = transformer.transformRequest(
        'http://localhost:8888/api/coding/paas/v4/chat/completions',
        headers
      );
      
      expect(result.targetUrl).toBe('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions');
      expect(result.transformedToken).toBe('real-api-token-123');
      expect(result.originalToken).toBe('dummy-token');
    });

    it('should transform path-only URL', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {
        'authorization': 'Bearer user-token',
        'content-type': 'application/json'
      };
      
      const result = transformer.transformRequest(
        '/api/coding/paas/v4/chat/completions',
        headers
      );
      
      expect(result.targetUrl).toBe('https://open.bigmodel.cn/api/coding/paas/v4/chat/completions');
    });

    it('should replace authorization header with real token', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {
        'authorization': 'Bearer fake-token',
        'content-type': 'application/json'
      };
      
      const result = transformer.transformRequest(
        'http://localhost:8888/api/test',
        headers
      );
      
      expect(result.headers['authorization']).toBe('Bearer real-api-token-123');
    });

    it('should remove host header', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {
        'host': 'localhost:8888',
        'authorization': 'Bearer token'
      };
      
      const result = transformer.transformRequest(
        'http://localhost:8888/api/test',
        headers
      );
      
      expect(result.headers['host']).toBeUndefined();
    });

    it('should remove accept-encoding header', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {
        'accept-encoding': 'gzip, deflate',
        'authorization': 'Bearer token'
      };
      
      const result = transformer.transformRequest(
        'http://localhost:8888/api/test',
        headers
      );
      
      expect(result.headers['accept-encoding']).toBeUndefined();
    });

    it('should extract token from URL parameter', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {};
      
      const result = transformer.transformRequest(
        'http://localhost:8888/api/test?token=url-token',
        headers
      );
      
      expect(result.originalToken).toBe('url-token');
    });

    it('should return not-provided when no token exists', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {};
      
      const result = transformer.transformRequest(
        'http://localhost:8888/api/test',
        headers
      );
      
      expect(result.originalToken).toBe('not-provided');
    });

    it('should proxy non-gateway URLs to configured provider', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const headers: IncomingHttpHeaders = {};
      
      const result = transformer.transformRequest(
        'http://external-api.com/endpoint',
        headers
      );
      
      expect(result.targetUrl).toBe('https://open.bigmodel.cn/endpoint');
    });
  });

  describe('getCurrentProviderInfo', () => {
    it('should return provider information', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const info = transformer.getCurrentProviderInfo();
      
      expect(info.id).toBe('bigmodel');
      expect(info.name).toBe('智谱AI (BigModel)');
      expect(info.targetHost).toBe('open.bigmodel.cn');
      expect(info.description).toBe('智谱AI大模型平台');
    });
  });

  describe('URL edge cases', () => {
    it('should handle URL with trailing slash', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('http://localhost:8888/api/test/');
      
      expect(result.path).toBe('/api/test/');
    });

    it('should handle URL with multiple query parameters', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('http://localhost:8888/api/test?token=abc&other=123');
      
      expect(result.userToken).toBe('abc');
      expect(result.path).toContain('token=abc');
      expect(result.path).toContain('other=123');
    });

    it('should handle empty URL', () => {
      const transformer = new UrlTransformer(mockConfigManager);
      const result = transformer.parseUserUrl('');
      
      expect(result.isGatewayRequest).toBe(false);
      expect(result.path).toBe('');
    });
  });
});
