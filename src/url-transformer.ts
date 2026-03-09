import { URL } from 'url';
import { IncomingHttpHeaders } from 'http';
import { ConfigManager, ProviderConfig } from './config';
import { TransformedRequest, ParsedUserUrl } from './types';

export interface ParsedPath {
  provider: string | null;
  targetPath: string;
}

export class UrlTransformer {
  private configManager: ConfigManager;
  private gatewayHost: string;
  private gatewayPort: number;
  private availableProviders: string[];

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
    const gatewayConfig = configManager.getGatewayConfig();
    this.gatewayHost = gatewayConfig.host;
    this.gatewayPort = gatewayConfig.port;
    this.availableProviders = configManager.getAvailableProviders();
  }

  /**
   * 从路径中解析供应商名称
   * 格式: /{provider}/api/... 或 /{provider}/v1/...
   * 返回: { provider: 'bigmodel_openai', targetPath: '/api/...' }
   */
  public parseProviderFromPath(path: string): ParsedPath {
    // 确保路径以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // 分割路径
    const pathParts = normalizedPath.split('/').filter(p => p.length > 0);
    
    if (pathParts.length === 0) {
      return { provider: null, targetPath: normalizedPath };
    }
    
    // 检查第一个路径段是否是有效的供应商名称
    const potentialProvider = pathParts[0];
    
    if (potentialProvider && this.availableProviders.includes(potentialProvider)) {
      // 是有效的供应商，从路径中移除供应商前缀
      const targetPath = '/' + pathParts.slice(1).join('/');
      return { provider: potentialProvider, targetPath };
    }
    
    // 不是供应商前缀，返回原始路径
    return { provider: null, targetPath: normalizedPath };
  }

  /**
   * 解析用户请求的URL，判断是否为网关请求
   */
  public parseUserUrl(urlStr: string): ParsedUserUrl {
    try {
      const url = new URL(urlStr);
      const isGatewayRequest = 
        url.hostname === this.gatewayHost && 
        parseInt(url.port || '80') === this.gatewayPort;
      
      // 从URL路径中提取用户token（如果存在）
      // 格式: http://localhost:8888/api/coding/paas/v4?token=dummy
      const userToken = url.searchParams.get('token');
      
      return {
        isGatewayRequest,
        path: url.pathname + url.search,
        userToken
      };
    } catch (error) {
      // 如果不是完整URL，可能是路径格式
      return {
        isGatewayRequest: false,
        path: urlStr,
        userToken: null
      };
    }
  }

  /**
   * 转换请求URL和Token
   * 支持动态供应商路由: /{provider}/api/... -> https://target-host/api/...
   * 将用户token替换为配置中的真实token
   */
  public transformRequest(
    urlStr: string, 
    headers: IncomingHttpHeaders,
    explicitProvider?: string
  ): TransformedRequest & { provider: string } {
    const parsedUrl = this.parseUserUrl(urlStr);
    
    let targetPath: string;
    let dynamicProvider: string | null = null;
    let originalToken: string | null = null;
    
    if (parsedUrl.isGatewayRequest) {
      // 从路径中解析供应商
      const parsedPath = this.parseProviderFromPath(parsedUrl.path);
      dynamicProvider = parsedPath.provider;
      targetPath = parsedPath.targetPath;
      
      // 从URL参数或Authorization头中提取用户token
      originalToken = this.extractUserToken(parsedUrl.userToken, headers);
    } else if (urlStr.startsWith('/')) {
      // 处理路径格式的请求
      // 从 /{provider}/api/... 解析供应商
      const parsedPath = this.parseProviderFromPath(urlStr);
      dynamicProvider = parsedPath.provider;
      targetPath = parsedPath.targetPath;
      originalToken = this.extractUserToken(null, headers);
    } else {
      // 如果不是网关请求，可能是直接代理请求
      // 尝试从完整URL中解析
      try {
        const url = new URL(urlStr);
        const parsedPath = this.parseProviderFromPath(url.pathname);
        dynamicProvider = parsedPath.provider;
        // 重建URL，移除供应商前缀
        if (dynamicProvider) {
          targetPath = parsedPath.targetPath + url.search;
        } else {
          targetPath = url.pathname + url.search;
        }
      } catch {
        targetPath = urlStr;
      }
      originalToken = this.extractUserToken(null, headers);
    }
    
    // 确定最终使用的供应商
    const finalProvider = explicitProvider || dynamicProvider || this.configManager.getCurrentProvider();
    
    // 获取供应商配置
    const providerConfig = this.configManager.getProviderConfig(finalProvider);
    
    // 构建目标URL
    const targetUrl = this.buildTargetUrl(targetPath, providerConfig);

    // 创建新的headers，替换Authorization
    const transformedHeaders: IncomingHttpHeaders = { ...headers };
    
    // 删除旧的host头
    delete transformedHeaders['host'];
    
    // 移除 accept-encoding 头，避免响应被压缩
    delete transformedHeaders['accept-encoding'];
    
    // 始终使用配置中的真实token替换/添加Authorization头
    transformedHeaders['authorization'] = `Bearer ${providerConfig.apiToken}`;

    return {
      targetUrl,
      headers: transformedHeaders,
      transformedToken: providerConfig.apiToken,
      originalToken: originalToken || 'not-provided',
      provider: finalProvider
    };
  }

  /**
   * 构建目标URL
   */
  private buildTargetUrl(path: string, providerConfig: ProviderConfig): string {
    // 确保路径以 / 开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // 构建完整的目标URL
    const targetUrl = `${providerConfig.targetProtocol}://${providerConfig.targetHost}${normalizedPath}`;
    
    return targetUrl;
  }

  /**
   * 从URL参数或Authorization头中提取用户token
   */
  private extractUserToken(
    urlToken: string | null, 
    headers: IncomingHttpHeaders
  ): string | null {
    // 优先从URL参数获取
    if (urlToken) {
      return urlToken;
    }
    
    // 从Authorization头中提取
    const authHeader = headers['authorization'];
    if (authHeader) {
      const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
      const match = authStr.match(/^Bearer\s+(.+)$/i);
      if (match) {
        return match[1];
      }
      return authStr;
    }
    
    return null;
  }

  /**
   * 获取当前供应商信息
   */
  public getCurrentProviderInfo(): { id: string; name: string; description: string; targetHost: string } {
    const providerId = this.configManager.getCurrentProvider();
    const config = this.configManager.getProviderConfig();
    
    return {
      id: providerId,
      name: config.name,
      description: config.description,
      targetHost: config.targetHost
    };
  }
}
