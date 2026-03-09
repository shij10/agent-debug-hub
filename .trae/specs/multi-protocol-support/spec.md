# 多协议支持 - 产品需求文档

## 概述
- **摘要**: 为 API 网关添加多协议支持，采用扁平式配置方案，将不同协议的端点作为独立的供应商配置项。
- **目的**: 同一个 targetHost（如 open.bigmodel.cn）的不同协议端点配置为独立的供应商（如 bigmodel_openai 和 bigmodel_anthropic），实现配置的清晰分离与独立管理。
- **目标用户**: 需要同时支持多种 AI 协议的开发者。

## 目标
- 采用扁平式配置方案，每个协议端点作为独立供应商配置
- 在供应商配置中添加 `protocol` 字段标识协议类型
- 实现协议自动识别机制
- 扩展 Debug UI 支持多种响应格式的解析和显示
- 保持与现有配置的向后兼容

## 非目标（范围外）
- 不修改请求转发逻辑（保持现有的 HTTP 代理机制）
- 不修改现有的监控和记录功能结构
- 不实现复杂的供应商分组管理

## 背景与上下文
- 当前配置以供应商为单位，每个供应商只有一个 basePath
- 实际需求：同一供应商的不同端点可能使用不同协议
- 扁平式配置方案可以实现配置的清晰分离与独立管理

## 功能需求
- **FR-1**: 供应商配置支持 `protocol` 字段（`'openai' | 'anthropic'`）
- **FR-2**: 系统能够根据供应商配置自动识别协议类型
- **FR-3**: Debug UI 能够根据记录的协议类型正确解析响应
- **FR-4**: 支持 OpenAI 兼容协议和 Anthropic 协议
- **FR-5**: 请求记录中包含协议类型信息

## 非功能需求
- **NFR-1**: 向后兼容：现有配置应继续工作（默认使用 OpenAI 协议）
- **NFR-2**: 可扩展性：易于添加新的协议支持
- **NFR-3**: 可维护性：配置清晰分离，便于管理和调整

## 约束
- **技术**: 使用现有的配置管理系统进行扩展
- **依赖**: 依赖现有的请求记录系统

## 假设
- 协议可以通过供应商配置的 `protocol` 字段识别
- 同一请求的请求和响应使用相同协议

## 验收标准

### AC-1: 供应商级别协议配置
- **给定**: 配置文件中的供应商设置了 `protocol` 字段
- **当**: 系统加载配置
- **然后**: 应正确识别该供应商使用的协议类型
- **验证**: `programmatic`

### AC-2: 协议自动识别
- **给定**: 一个请求到达网关
- **当**: 系统处理该请求
- **然后**: 应根据供应商配置的 `protocol` 字段识别协议类型
- **验证**: `programmatic`

### AC-3: 请求记录包含协议类型
- **给定**: 一个请求被处理并记录
- **当**: 查看请求记录
- **然后**: 记录中应包含协议类型字段
- **验证**: `programmatic`

### AC-4: Debug UI 多协议解析
- **给定**: Debug UI 接收到不同协议的请求记录
- **当**: 渲染 Chat View 和 Raw View
- **然后**: 应根据协议类型使用对应的解析逻辑
- **验证**: `human-judgment`

### AC-5: 向后兼容
- **给定**: 使用旧版配置文件（无 protocol 字段）
- **当**: 系统启动并处理请求
- **然后**: 应默认使用 OpenAI 协议并正常工作
- **验证**: `programmatic`

## 配置文件设计方案

### 扁平式配置方案（推荐）

将不同协议的端点配置为独立的供应商：

```json
{
  "providers": {
    "bigmodel_openai": {
      "name": "智谱AI (OpenAI兼容)",
      "targetHost": "open.bigmodel.cn",
      "targetProtocol": "https",
      "apiToken": "22e4f5a5e51640bba88c96d16e6c274d.N2zYqp2vSvRf68D4",
      "basePath": "/api/coding/paas/v4",
      "description": "智谱AI OpenAI兼容接口",
      "protocol": "openai"
    },
    "bigmodel_anthropic": {
      "name": "智谱AI (Anthropic协议)",
      "targetHost": "open.bigmodel.cn",
      "targetProtocol": "https",
      "apiToken": "22e4f5a5e51640bba88c96d16e6c274d.N2zYqp2vSvRf68D4",
      "basePath": "/api/anthropic",
      "description": "智谱AI Anthropic协议接口",
      "protocol": "anthropic"
    },
    "openai": {
      "name": "OpenAI",
      "targetHost": "api.openai.com",
      "targetProtocol": "https",
      "apiToken": "sk-your-openai-token-here",
      "basePath": "/v1",
      "description": "OpenAI API",
      "protocol": "openai"
    },
    "anthropic": {
      "name": "Anthropic (Claude)",
      "targetHost": "api.anthropic.com",
      "targetProtocol": "https",
      "apiToken": "sk-ant-your-anthropic-token-here",
      "basePath": "/v1",
      "description": "Anthropic Claude API",
      "protocol": "anthropic"
    }
  },
  "gateway": {
    "port": 27980,
    "host": "localhost",
    "maxRecords": 50
  }
}
```

### 方案优势

1. **清晰分离**：不同协议的端点配置完全独立，互不干扰
2. **独立管理**：可以为不同协议配置不同的 API Token、描述等
3. **易于扩展**：添加新协议只需添加新的供应商配置项
4. **简单直观**：配置结构扁平，易于理解和维护
5. **向后兼容**：旧配置无 `protocol` 字段时默认使用 OpenAI 协议

### 向后兼容处理
- 如果配置中没有 `protocol` 字段，默认使用 `'openai'`
- 现有的供应商配置无需修改即可继续工作

## 数据结构变更

### ProviderConfig 扩展
```typescript
export interface ProviderConfig {
  name: string;
  targetHost: string;
  targetProtocol: string;
  apiToken: string;
  basePath: string;
  description: string;
  protocol?: 'openai' | 'anthropic'; // 新增字段，可选，默认 'openai'
}
```

### RequestRecord 扩展
```typescript
export interface RequestRecord {
  id: string;
  timestamp: string;
  duration: number;
  provider: string;
  protocol: 'openai' | 'anthropic'; // 新增字段
  threadId: string;
  request: RequestData;
  response?: ResponseData;
  error?: string;
  transformedUrl?: string;
  transformedHeaders?: IncomingHttpHeaders;
}
```

## 未解决的问题
- [ ] 是否需要支持协议版本（如 Anthropic 2023-06-01 vs 2024-01-01）？
- [ ] 是否需要支持供应商分组或标签功能（用于将 bigmodel_openai 和 bigmodel_anthropic 关联）？
