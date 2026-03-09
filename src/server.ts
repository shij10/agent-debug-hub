import express, { Express, Request, Response } from 'express';
import http, { IncomingMessage, Server, IncomingHttpHeaders, OutgoingHttpHeaders, ServerResponse } from 'http';
import https from 'https';
import { URL } from 'url';
import path from 'path';
import { RequestRecord, SseClient, ApiErrorResponse } from './types';
import { initializeConfig, ConfigManager, ProviderConfig } from './config';
import { UrlTransformer } from './url-transformer';

// 解析命令行参数
function parseCommandLineArgs(): { configPath: string } {
  const args = process.argv.slice(2);
  let configPath: string = 'config.json';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--config' || args[i] === '-c') {
      configPath = args[i + 1] ?? 'config.json';
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      showHelp();
      process.exit(0);
    }
  }

  return { configPath };
}

function showHelp(): void {
  console.log(`
Agent Debug Hub - 智能体调试中心

用法: node dist/server.js [选项]

选项:
  -c, --config <path>      指定配置文件路径 (默认: config.json)
  -h, --help              显示帮助信息

动态路由:
  供应商通过 URL 路径动态指定，格式: /{provider}/api/...
  例如:
    http://localhost:27980/bigmodel_openai/api/coding/paas/v4/chat/completions
    http://localhost:27980/bigmodel_anthropic/api/anthropic/v1/messages

可用的供应商:
  - bigmodel_openai     智谱AI (OpenAI兼容接口)
  - bigmodel_anthropic  智谱AI (Anthropic兼容接口)

示例:
  node dist/server.js
  node dist/server.js -c ./my-config.json
`);
}

// 初始化配置
const { configPath } = parseCommandLineArgs();
const configManager: ConfigManager = initializeConfig(configPath);

const providerConfig = configManager.getProviderConfig();
const gatewayConfig = configManager.getGatewayConfig();

console.log(`[配置] 默认供应商: ${providerConfig.name} (${configManager.getCurrentProvider()})`);
console.log(`[配置] 目标域名: ${providerConfig.targetHost}`);
console.log(`[配置] 配置文件: ${path.resolve(configPath)}`);
console.log(`[配置] 可用供应商: ${configManager.getAvailableProviders().join(', ')}`);

const app: Express = express();
const PORT: number = gatewayConfig.port;
const MAX_RECORDS: number = gatewayConfig.maxRecords;

const records: RequestRecord[] = [];
const sseClients: SseClient[] = [];

const urlTransformer = new UrlTransformer(configManager);

// 提取消息内容文本（支持多模态消息）
function extractMessageContent(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((item: unknown) => {
        const obj = item as { type?: string; text?: string };
        return obj.type === 'text' && obj.text;
      })
      .map((item: unknown) => (item as { text: string }).text)
      .join('');
  }
  return '';
}

// 生成 Thread ID
function generateThreadId(requestBody: string | null, provider?: string): string {
  try {
    if (requestBody) {
      const body = JSON.parse(requestBody);
      // 使用第一个消息的 content 作为 thread 标识
      if (body.messages && body.messages.length > 0) {
        const firstMsg = body.messages[0].content;
        const text = extractMessageContent(firstMsg);
        if (text) {
          // 将 provider 也纳入 thread ID 生成，确保不同 provider 的请求在不同 thread
          const providerPrefix = provider ? `${provider}:` : '';
          return 'thread_' + hashString(providerPrefix + text.substring(0, 50));
        }
      }
    }
  } catch (e) {
    // 解析失败，使用时间戳
  }
  return 'thread_' + Date.now().toString(36);
}

// 简单的字符串哈希函数
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).substring(0, 8);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// 聊天端点 - 接收聊天消息和相关参数
app.get('/chat', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../public/chat.html'));
});

app.post('/chat', (req: Request, res: Response): void => {
  const startTime: number = Date.now();
  const requestId: string = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  let requestBody = req.body;
  
  // 从请求头或查询参数中获取供应商（支持动态路由）
  const providerFromHeader = req.headers['x-provider'] as string;
  const providerFromQuery = req.query['provider'] as string;
  const explicitProvider = providerFromHeader || providerFromQuery;
  
  // 如果没有指定供应商，使用默认供应商
  const currentProvider = explicitProvider && configManager.validateProvider(explicitProvider)
    ? explicitProvider 
    : configManager.getCurrentProvider();
  const protocol = configManager.getProtocol(currentProvider);
  const providerConfig = configManager.getProviderConfig(currentProvider);
  
  console.log(`[Chat] Received POST request to /chat, provider: ${currentProvider}`);
  
  // 根据协议类型转换请求体
  let targetPath: string;
  let transformedBody: unknown;
  
  if (protocol === 'anthropic') {
    targetPath = providerConfig.basePath + '/v1/messages';
    // 将 OpenAI 格式转换为 Anthropic 格式
    const messages = requestBody.messages || [];
    const systemMessage = messages.find((m: { role: string }) => m.role === 'system');
    const otherMessages = messages.filter((m: { role: string }) => m.role !== 'system');
    
    transformedBody = {
      model: requestBody.model,
      max_tokens: 4096,
      messages: otherMessages.map((m: { role: string; content: string }) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }))
    };
    
    if (systemMessage) {
      (transformedBody as { system?: string }).system = systemMessage.content;
    }
  } else {
    targetPath = providerConfig.basePath + '/chat/completions';
    transformedBody = requestBody;
  }
  
  const targetUrl = `${providerConfig.targetProtocol}://${providerConfig.targetHost}${targetPath}`;
  console.log(`[Chat] Target URL: ${targetUrl}`);
  
  // 直接构建目标URL，不使用urlTransformer转换
  let targetUrlObj: URL;
  try {
    targetUrlObj = new URL(targetUrl);
  } catch (e: unknown) {
    const error = e as Error;
    console.error('[Chat] Invalid URL:', error.message);
    res.status(400).json({
      success: false,
      error: `Invalid URL: ${error.message}`,
      data: null
    });
    return;
  }
  
  const isHttps: boolean = targetUrlObj.protocol === 'https:';
  
  // 构建请求头
  const bodyString = JSON.stringify(transformedBody);
  const headers: IncomingHttpHeaders = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyString).toString(),
    'Authorization': `Bearer ${providerConfig.apiToken}`,
    'host': targetUrlObj.host
  };
  
  const options = {
    hostname: targetUrlObj.hostname,
    port: targetUrlObj.port || (isHttps ? 443 : 80),
    path: targetUrlObj.pathname + targetUrlObj.search,
    method: 'POST',
    headers: headers
  };
  
  const lib = isHttps ? https : http;
  
  let responseBody: string = '';
  
  // 生成Thread ID
  const threadId = generateThreadId(JSON.stringify(requestBody), currentProvider);
  
  const proxyReq = lib.request(options, (proxyRes: IncomingMessage) => {
    // 设置响应头，支持流式响应
    res.status(proxyRes.statusCode || 500).set({
      'Content-Type': proxyRes.headers['content-type'] || 'application/json',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // 处理流式响应
    proxyRes.on('data', (chunk: Buffer | string) => {
      const chunkStr = chunk.toString();
      responseBody += chunkStr;
      // 立即发送数据给客户端
      res.write(chunkStr);
    });
    
    proxyRes.on('end', () => {
      console.log(`[Chat] Response: ${proxyRes.statusCode}`);
      
      const record: RequestRecord = {
        id: requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        provider: currentProvider,
        protocol: protocol,
        threadId: threadId,
        request: {
          method: 'POST',
          url: '/chat',
          headers: req.headers,
          body: JSON.stringify(requestBody)
        },
        response: {
          statusCode: proxyRes.statusCode,
          statusMessage: proxyRes.statusMessage,
          headers: proxyRes.headers,
          body: responseBody
        },
        transformedUrl: targetUrl,
        transformedHeaders: headers
      };
      
      addRecord(record);
      
      res.end();
    });
  });
  
  proxyReq.on('error', (err: Error) => {
    console.error(`[Chat] Error: ${err.message}`);
    
    const record: RequestRecord = {
      id: requestId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      provider: currentProvider,
      protocol: protocol,
      threadId: threadId,
      error: err.message,
      request: {
        method: 'POST',
        url: '/chat',
        headers: req.headers,
        body: JSON.stringify(requestBody)
      },
      transformedUrl: targetUrl
    };
    
    addRecord(record);
    
    res.status(502).json({
      success: false,
      error: `Proxy Error: ${err.message}`,
      data: null
    });
  });
  
  proxyReq.write(bodyString);
  proxyReq.end();
});

// Debug UI 端点
app.get('/debug', (_req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API 信息端点
app.get('/api/info', (_req: Request, res: Response): void => {
  try {
    const providerInfo = urlTransformer.getCurrentProviderInfo();
    const currentProvider = configManager.getCurrentProvider();
    const protocol = configManager.getProtocol(currentProvider);
    const allProviders = configManager.getAvailableProviders().map(name => {
      const config = configManager.getProviderConfig(name);
      return {
        id: name,
        name: config.name,
        description: config.description,
        targetHost: config.targetHost,
        protocol: config.protocol || 'openai'
      };
    });
    
    res.json({
      success: true,
      data: {
        gateway: {
          host: gatewayConfig.host,
          port: gatewayConfig.port,
          version: '2.0.0'
        },
        provider: {
          ...providerInfo,
          protocol: protocol
        },
        providers: allProviders,
        usage: {
          description: '使用方式（支持动态供应商路由）',
          examples: [
            `curl http://localhost:${PORT}/bigmodel_openai/api/coding/paas/v4/chat/completions`,
            `curl http://localhost:${PORT}/bigmodel_anthropic/api/anthropic/messages`,
            `curl -H "X-Provider: bigmodel_openai" http://localhost:${PORT}/chat`,
            `curl http://localhost:${PORT}/chat?provider=bigmodel_anthropic`
          ]
        }
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Info] Error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to load configuration',
      data: null
    });
  }
});

app.get('/models', async (req: Request, res: Response): Promise<void> => {
  const providerId = req.query['provider'] as string;
  
  if (!providerId) {
    res.json({
      success: true,
      data: {
        providers: configManager.getAvailableProviders().map(name => ({
          id: name,
          name: configManager.getProviderConfig(name).name
        }))
      }
    });
    return;
  }

  if (!configManager.validateProvider(providerId)) {
    res.status(400).json({
      success: false,
      error: `Invalid provider: '${providerId}' not found`,
      data: null
    });
    return;
  }

  const providerConfig = configManager.getProviderConfig(providerId);
  const protocol = providerConfig.protocol || 'openai';

  try {
    let modelsPath: string;
    if (protocol === 'anthropic') {
      modelsPath = `${providerConfig.basePath}/v1/models`;
    } else {
      modelsPath = `${providerConfig.basePath}/models`;
    }
    const modelsUrl = `${providerConfig.targetProtocol}://${providerConfig.targetHost}${modelsPath}`;
    console.log(`[Models] Fetching models from: ${modelsUrl}`);
    const targetUrl = new URL(modelsUrl);
    const isHttps = targetUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${providerConfig.apiToken}`,
        'host': targetUrl.host
      }
    };

    const proxyReq = lib.request(options, (proxyRes: IncomingMessage) => {
      let responseBody = '';
      console.log(`[Models] Response status: ${proxyRes.statusCode}`);
      proxyRes.on('data', (chunk: Buffer | string) => {
        responseBody += chunk.toString();
      });

      proxyRes.on('end', () => {
        console.log(`[Models] Response body: ${responseBody.substring(0, 200)}`);
        if (proxyRes.statusCode !== 200) {
          console.error(`[Models] Failed to fetch models: ${proxyRes.statusCode}, falling back to config`);
          const fallbackModels = providerConfig.models || [];
          res.json({
            success: true,
            data: {
              provider: providerId,
              models: fallbackModels,
              fallback: true
            }
          });
          return;
        }

        try {
          const data = JSON.parse(responseBody);
          
          if (data.code && data.code !== 200) {
            console.log(`[Models] API returned error code ${data.code}, falling back to config`);
            const fallbackModels = providerConfig.models || [];
            res.json({
              success: true,
              data: {
                provider: providerId,
                models: fallbackModels,
                fallback: true
              }
            });
            return;
          }
          
          if (protocol === 'openai' && data.data && Array.isArray(data.data)) {
            const models = data.data.map((model: { id: string; owned_by?: string }) => ({
              id: model.id,
              name: model.id,
              owner: model.owned_by
            }));
            res.json({
              success: true,
              data: { provider: providerId, models }
            });
          } else if (protocol === 'anthropic') {
            const modelList = data.models || data.data || (Array.isArray(data) ? data : []);
            const models = modelList.map((model: { id: string; display_name?: string; name?: string }) => ({
              id: model.id,
              name: model.display_name || model.name || model.id
            }));
            res.json({
              success: true,
              data: { provider: providerId, models }
            });
          } else {
            res.json({
              success: true,
              data: { provider: providerId, models: data.data || data.models || [] }
            });
          }
        } catch (parseError) {
          console.error('[Models] Failed to parse response:', parseError);
          const fallbackModels = providerConfig.models || [];
          res.json({
            success: true,
            data: {
              provider: providerId,
              models: fallbackModels,
              fallback: true
            }
          });
        }
      });
    });

    proxyReq.on('error', (err: Error) => {
      console.error(`[Models] Error: ${err.message}, falling back to config`);
      const fallbackModels = providerConfig.models || [];
      res.json({
        success: true,
        data: {
          provider: providerId,
          models: fallbackModels,
          fallback: true
        }
      });
    });

    proxyReq.end();
  } catch (err) {
    const error = err as Error;
    console.error('[Models] Error:', error.message);
    const fallbackModels = providerConfig.models || [];
    res.json({
      success: true,
      data: {
        provider: providerId,
        models: fallbackModels,
        fallback: true
      }
    });
  }
});

// Admin API endpoints
// GET /admin/config - Return current configuration
app.get('/admin/config', (_req: Request, res: Response): void => {
  console.log('[Admin API] GET /admin/config requested');
  try {
    const config = configManager.getConfig();
    const providers: Record<string, Omit<ProviderConfig, 'apiToken'> & { apiToken: string }> = {};
    
    for (const [id, providerConfig] of Object.entries(config.providers)) {
      providers[id] = {
        ...providerConfig,
        apiToken: providerConfig.apiToken ? '***' : ''
      };
    }
    
    const responseData = {
      success: true,
      data: {
        providers,
        gateway: config.gateway,
        currentProvider: configManager.getCurrentProvider()
      }
    };
    console.log('[Admin API] Sending /admin/config response, provider count:', Object.keys(providers).length);
    res.json(responseData);
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error getting config:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// POST /admin/providers - Create new provider
app.post('/admin/providers', (req: Request, res: Response): void => {
  try {
    const { id, config } = req.body;
    
    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    if (!config || typeof config !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Provider config is required',
        data: null
      });
      return;
    }
    
    configManager.addProvider(id, config);
    
    res.json({
      success: true,
      data: {
        message: `Provider '${id}' created successfully`,
        id
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error creating provider:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// DELETE /admin/providers/:id - Delete provider
app.delete('/admin/providers/:id', (req: Request, res: Response): void => {
  try {
    const id = req.params['id'];
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    configManager.removeProvider(id);
    
    res.json({
      success: true,
      data: {
        message: `Provider '${id}' deleted successfully`,
        id
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error deleting provider:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// PUT /admin/providers/:id - Update provider configuration
app.put('/admin/providers/:id', (req: Request, res: Response): void => {
  try {
    const id = req.params['id'];
    const { config } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    if (!config) {
      res.status(400).json({
        success: false,
        error: 'Provider config is required',
        data: null
      });
      return;
    }
    
    configManager.updateProvider(id, config);
    
    res.json({
      success: true,
      data: {
        message: `Provider '${id}' updated successfully`,
        id
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error updating provider:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// PUT /admin/providers/:id/token - Update provider token
app.put('/admin/providers/:id/token', (req: Request, res: Response): void => {
  try {
    const id = req.params['id'];
    const { token } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    if (!token || typeof token !== 'string') {
      res.status(400).json({
        success: false,
        error: 'Token is required',
        data: null
      });
      return;
    }
    
    configManager.updateProviderToken(id, token);
    
    res.json({
      success: true,
      data: {
        message: `Token updated successfully for provider '${id}'`,
        id
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error updating token:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// PUT /admin/providers/:id/models - Update provider models list
app.put('/admin/providers/:id/models', (req: Request, res: Response): void => {
  try {
    const id = req.params['id'];
    const { models } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    if (!models || !Array.isArray(models)) {
      res.status(400).json({
        success: false,
        error: 'Models array is required',
        data: null
      });
      return;
    }
    
    configManager.updateProviderModels(id, models);
    
    res.json({
      success: true,
      data: {
        message: `Models updated successfully for provider '${id}'`,
        id,
        models
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error updating models:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// PUT /admin/providers/:id/default-model - Set default model
app.put('/admin/providers/:id/default-model', (req: Request, res: Response): void => {
  try {
    const id = req.params['id'];
    const { modelId } = req.body;
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    if (!modelId || typeof modelId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'modelId is required',
        data: null
      });
      return;
    }
    
    configManager.setDefaultModel(id, modelId);
    
    res.json({
      success: true,
      data: {
        message: `Default model set successfully for provider '${id}'`,
        id,
        modelId
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error setting default model:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// Helper function to make HTTPS request with timeout
function makeHttpsRequest(url: string, headers: Record<string, string>, timeoutMs: number = 15000): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: headers,
      timeout: timeoutMs
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, body: data });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

// GET /admin/providers/:id/fetch-models - Fetch models from provider API
app.get('/admin/providers/:id/fetch-models', async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params['id'];
    
    if (!id) {
      res.status(400).json({
        success: false,
        error: 'Provider id is required',
        data: null
      });
      return;
    }
    
    if (!configManager.validateProvider(id)) {
      res.status(404).json({
        success: false,
        error: `Provider '${id}' not found`,
        data: null
      });
      return;
    }
    
    const providerConfig = configManager.getProviderConfig(id);
    const protocol = providerConfig.protocol || 'openai';
    
    console.log(`[Admin] Fetching models for provider: ${id}, protocol: ${protocol}`);
    console.log(`[Admin] Provider config:`, {
      targetHost: providerConfig.targetHost,
      targetProtocol: providerConfig.targetProtocol,
      basePath: providerConfig.basePath,
      hasToken: !!providerConfig.apiToken
    });
    
    let targetUrl: string;
    if (protocol === 'anthropic') {
      targetUrl = `${providerConfig.targetProtocol}://${providerConfig.targetHost}${providerConfig.basePath}/v1/models`;
    } else {
      targetUrl = `${providerConfig.targetProtocol}://${providerConfig.targetHost}${providerConfig.basePath}/models`;
    }
    
    console.log(`[Admin] Target URL: ${targetUrl}`);
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${providerConfig.apiToken}`,
      'Content-Type': 'application/json'
    };
    
    console.log('[Admin] Starting HTTPS request...');
    
    const { statusCode, body } = await makeHttpsRequest(targetUrl, headers, 15000);
    
    console.log(`[Admin] HTTPS response received: ${statusCode}`);
    
    if (statusCode !== 200) {
      let errorMessage = `Failed to fetch models: ${statusCode}`;
      try {
        const errorData = JSON.parse(body) as { error?: { message?: string }; msg?: string; message?: string };
        errorMessage = errorData?.error?.message || errorData?.msg || errorData?.message || errorMessage;
      } catch {
        if (body && body.length < 200) {
          errorMessage = body;
        }
      }
      throw new Error(errorMessage);
    }
    
    let data: { data?: unknown[]; models?: unknown[] };
    try {
      data = JSON.parse(body) as { data?: unknown[]; models?: unknown[] };
    } catch {
      throw new Error('Invalid JSON response from provider API');
    }
    
    res.json({
      success: true,
      data: {
        provider: id,
        models: data.data || data.models || data
      }
    });
  } catch (err) {
    const error = err as Error;
    console.error('[Admin] Error fetching models:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

// GET /admin - Serve the admin.html page
app.get('/admin', (_req: Request, res: Response): void => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

function addRecord(record: RequestRecord): void {
  if (records.length >= MAX_RECORDS) {
    records.shift();
  }
  records.push(record);
  notifyClients(record);
}

function notifyClients(record: RequestRecord): void {
  const data: string = `data: ${JSON.stringify(record)}\n\n`;
  sseClients.forEach((client: SseClient) => {
    try {
      client.write(data);
    } catch (e: unknown) {
      const error = e as Error;
      console.error('Failed to send SSE:', error.message);
    }
  });
}

app.get('/api/records', (_req: Request, res: Response): void => {
  res.json(records);
});

const clearRecordsHandler = (_req: Request, res: Response): void => {
  console.log('[API] Clear records called, method:', _req.method);
  const clearedCount = records.length;
  records.length = 0;
  console.log(`[API] Cleared ${clearedCount} records`);
  res.json({
    success: true,
    data: {
      message: '所有记录已清空',
      clearedCount
    }
  });
};

app.delete('/api/records', clearRecordsHandler);
app.post('/api/records/clear', clearRecordsHandler);

app.get('/api/events', (req: Request, res: Response): void => {
  // 设置响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'X-Accel-Buffering': 'no'
  });

  // 发送初始连接成功消息
  try {
    res.write('data: {"type":"connected","message":"SSE connection established"}\n\n');
  } catch (e) {
    console.error('[SSE] Failed to send initial message:', e);
    return;
  }
  
  sseClients.push(res as unknown as SseClient);
  console.log('[SSE] Client connected, total clients:', sseClients.length);

  // 设置心跳机制，每30秒发送一次心跳
  const heartbeat = setInterval(() => {
    try {
      if (!res.writableEnded) {
        res.write('data: {"type":"heartbeat"}\n\n');
      }
    } catch (e) {
      console.log('[SSE] Heartbeat failed, clearing interval');
      clearInterval(heartbeat);
    }
  }, 30000);

  // 响应完成时的清理
  res.on('finish', () => {
    console.log('[SSE] Response finished');
    clearInterval(heartbeat);
    const index = sseClients.indexOf(res as unknown as SseClient);
    if (index > -1) {
      sseClients.splice(index, 1);
    }
  });

  res.on('error', (err) => {
    console.error('[SSE] Response error:', err.message);
    clearInterval(heartbeat);
    const index = sseClients.indexOf(res as unknown as SseClient);
    if (index > -1) {
      sseClients.splice(index, 1);
    }
  });

  req.on('close', () => {
    console.log('[SSE] Client disconnected');
    clearInterval(heartbeat);
    const index = sseClients.indexOf(res as unknown as SseClient);
    if (index > -1) {
      sseClients.splice(index, 1);
    }
  });

  req.on('error', (err) => {
    console.error('[SSE] Request error:', err.message);
    clearInterval(heartbeat);
  });
});

function handleProxyRequest(req: IncomingMessage, res: ServerResponse, urlStr: string): void {
  const startTime: number = Date.now();
  const requestId: string = `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  console.log(`[Proxy] ${req.method} ${urlStr}`);

  let requestBody: string = '';
  req.on('data', (chunk: Buffer | string) => {
    requestBody += chunk.toString();
  });

  req.on('end', () => {
    // 转换URL和Token（支持动态供应商路由）
    const transformed = urlTransformer.transformRequest(urlStr, req.headers);
    const dynamicProvider = transformed.provider;
    const protocol = configManager.getProtocol(dynamicProvider);

    console.log(`[Transform] ${urlStr} -> ${transformed.targetUrl}`);
    console.log(`[Transform] Provider: ${dynamicProvider}`);
    console.log(`[Transform] Token: ${transformed.originalToken.substring(0, 10)}... -> ${transformed.transformedToken.substring(0, 10)}...`);

    let targetUrl: URL;
    try {
      targetUrl = new URL(transformed.targetUrl);
    } catch (e: unknown) {
      const error = e as Error;
      console.error('[Proxy] Invalid URL:', error.message);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: `Invalid URL: ${error.message}`,
        data: null
      } as ApiErrorResponse));
      return;
    }

    const isHttps: boolean = targetUrl.protocol === 'https:';

    const options = {
      hostname: targetUrl.hostname,
      port: targetUrl.port || (isHttps ? 443 : 80),
      path: targetUrl.pathname + targetUrl.search,
      method: req.method,
      headers: transformed.headers as OutgoingHttpHeaders
    };

    // 设置正确的host头
    options.headers = options.headers || {};
    options.headers['host'] = targetUrl.host;

    const lib = isHttps ? https : http;

    const proxyReq = lib.request(options, (proxyRes: IncomingMessage) => {
      let responseBody: string = '';
      proxyRes.on('data', (chunk: Buffer | string) => {
        responseBody += chunk.toString();
      });

      proxyRes.on('end', () => {
        console.log(`[Proxy] Response: ${proxyRes.statusCode}`);

        const threadId = generateThreadId(requestBody, dynamicProvider);

        const record: RequestRecord = {
          id: requestId,
          timestamp: new Date().toISOString(),
          duration: Date.now() - startTime,
          provider: dynamicProvider,
          protocol: protocol,
          threadId: threadId,
          request: {
            method: req.method,
            url: urlStr,
            headers: req.headers as IncomingHttpHeaders,
            body: requestBody || null
          },
          response: {
            statusCode: proxyRes.statusCode,
            statusMessage: proxyRes.statusMessage,
            headers: proxyRes.headers as IncomingHttpHeaders,
            body: responseBody
          },
          transformedUrl: transformed.targetUrl,
          transformedHeaders: transformed.headers
        };

        addRecord(record);

        const responseHeaders: OutgoingHttpHeaders = proxyRes.headers as OutgoingHttpHeaders;
        res.writeHead(
          proxyRes.statusCode ?? 500,
          proxyRes.statusMessage ?? 'Unknown',
          responseHeaders
        );
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (err: Error) => {
      console.error(`[Proxy] Error: ${err.message}`);

      const threadId = generateThreadId(requestBody, dynamicProvider);

      const record: RequestRecord = {
        id: requestId,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        provider: dynamicProvider,
        protocol: protocol,
        threadId: threadId,
        error: err.message,
        request: {
          method: req.method,
          url: urlStr,
          headers: req.headers as IncomingHttpHeaders,
          body: requestBody || null
        },
        transformedUrl: transformed.targetUrl
      };

      addRecord(record);

      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: `Proxy Error: ${err.message}`,
        data: null
      } as ApiErrorResponse));
    });

    if (requestBody) {
      proxyReq.write(requestBody);
    }
    proxyReq.end();
  });
}

const server: Server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
  const urlStr: string | undefined = req.url;

  if (!urlStr) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }

  // 检查是否为代理请求
  // 支持三种格式:
  // 1. http://localhost:8888/api/... (完整URL)
  // 2. /api/... (路径格式)
  // 3. /{provider}/api/... (带供应商前缀的路径格式)
  
  // 检查是否是带供应商前缀的API请求
  const pathParts = urlStr.split('/').filter(p => p.length > 0);
  const firstPathPart = pathParts[0] || '';
  const hasProviderPrefix = firstPathPart.length > 0 && configManager.getAvailableProviders().includes(firstPathPart);
  const isApiRequest = urlStr.includes('/api/') || urlStr.includes('/v1/');
  
  const isProxyRequest = 
    ((urlStr.startsWith('http://') || 
      urlStr.startsWith('https://')) &&
     !urlStr.includes('localhost:8888') &&
     !urlStr.includes('localhost:27980')) ||
    (hasProviderPrefix && isApiRequest) ||
    (!urlStr.startsWith('/api/records') && 
     !urlStr.startsWith('/api/events') && 
     !urlStr.startsWith('/api/info') &&
     !urlStr.startsWith('/models') &&
     !urlStr.startsWith('/index.html') &&
     !urlStr.startsWith('/debug') &&
     !urlStr.startsWith('/static/') &&
     !urlStr.startsWith('/@vite/') &&
     !urlStr.startsWith('/chat') &&
     !urlStr.startsWith('/admin') &&
     urlStr !== '/' &&
     !urlStr.startsWith('/?'));

  if (isProxyRequest) {
    handleProxyRequest(req, res, urlStr);
  } else {
    app(req as unknown as Request, res as unknown as Response, () => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    });
  }
});

server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`Agent Debug Hub v2.0 已启动`);
  console.log(`========================================`);
  console.log(`网关地址: http://localhost:${PORT}`);
  console.log(`监控界面: http://localhost:${PORT}/debug`);
  console.log(`API信息:  http://localhost:${PORT}/api/info`);
  console.log(`----------------------------------------`);
  console.log(`使用示例:`);
  console.log(`  curl -H "Authorization: Bearer dummy" http://localhost:${PORT}/api/coding/paas/v4/chat/completions`);
  console.log(`  curl http://localhost:${PORT}/api/coding/paas/v4/chat/completions?token=dummy`);
  console.log(`========================================\n`);
});
