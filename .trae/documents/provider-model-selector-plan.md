# Provider 和 Model 选择功能实现计划

## 需求概述
在 `chat.html` 的 header 区域实现：
1. Provider 选择下拉菜单 - 列出所有可用的服务提供商
2. Model 选择下拉菜单 - 根据所选 provider 动态加载对应模型列表
3. 选择操作触发状态更新，确保系统正确识别和应用

## 当前状态分析

### 后端
- `config.json` 定义了两个 provider：`bigmodel_openai` 和 `bigmodel_anthropic`
- 需要将现有 `/api/info` 端点改为 `/info` 端点返回 providers 列表信息
- `/chat` 端点支持 `X-Provider` header 和 `provider` 查询参数

### 前端
- `chat.html` 当前只有静态的模型选择下拉框（GLM-4 系列模型）
- 缺少 provider 选择功能
- 模型列表是硬编码的

## 实现步骤

### 步骤 1：修改后端 API 端点路径

**文件**: `src/server.ts`

将 `/api/info` 端点改为 `/info`：
- 修改路由路径从 `app.get('/api/info', ...)` 改为 `app.get('/info', ...)`

### 步骤 2：扩展后端 API - 添加模型列表端点

**文件**: `src/server.ts`

添加新的 API 端点 `/models`：
- 返回每个 provider 对应的可用模型列表
- 模型数据可以配置在 `config.json` 中或硬编码

**文件**: `src/config.ts`

在 `ProviderConfig` 接口中添加 `models` 字段：
```typescript
export interface ProviderConfig {
  // ... 现有字段
  models?: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}
```

**文件**: `config.json`

为每个 provider 添加 models 配置。

### 步骤 3：更新前端 HTML 结构

**文件**: `public/chat.html`

修改 header 区域：
```html
<header class="header">
    <div class="header-title">...</div>
    <div class="header-controls">
        <div class="provider-selector">
            <label for="provider">Provider:</label>
            <select id="provider"></select>
        </div>
        <div class="model-selector">
            <label for="model">Model:</label>
            <select id="model"></select>
        </div>
    </div>
</header>
```

### 步骤 4：添加 CSS 样式

**文件**: `public/chat.html`

添加 `.header-controls` 和 `.provider-selector` 样式，保持与现有 `.model-selector` 风格一致。

### 步骤 5：实现前端 JavaScript 逻辑

**文件**: `public/chat.html`

1. 页面加载时获取 providers 和 models 数据
2. Provider 选择变更时更新模型列表
3. 发送消息时携带 provider 和 model 参数

```javascript
// 状态管理
let currentProvider = '';
let currentModel = '';
let providersData = {};

// 初始化
async function initSelectors() {
  // 获取 /info 数据
  // 填充 provider 下拉框
  // 设置默认 provider 和 model
}

// Provider 变更处理
function onProviderChange(providerId) {
  // 更新模型列表
  // 重置当前模型选择
}

// 发送消息时更新请求
async function sendMessage() {
  // 添加 provider 参数到请求
}
```

### 步骤 6：更新发送消息逻辑

修改 `sendMessage()` 函数：
- 在请求中添加 `provider` 参数（通过 header 或 query）
- 使用当前选择的 model

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/server.ts` | 将 `/api/info` 改为 `/info`，添加 `/models` 端点 |
| `src/config.ts` | 添加 `ModelInfo` 接口，扩展 `ProviderConfig` |
| `config.json` | 为每个 provider 添加 models 配置 |
| `public/chat.html` | 添加 provider 选择器，更新模型选择器为动态加载，添加相关样式和 JS 逻辑 |

## 测试验证

1. 页面加载后 provider 下拉框显示所有可用 providers
2. 切换 provider 后模型列表正确更新
3. 发送消息时请求携带正确的 provider 和 model 参数
4. 界面风格与现有 header 保持一致
