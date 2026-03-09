# Anthropic 协议支持 - 实现计划

## [ ] 任务 1: 扩展配置文件接口
- **优先级**: P0
- **依赖**: 无
- **描述**: 
  - 在 `src/config.ts` 中扩展 `ProviderConfig` 接口，添加 `protocolType?: 'openai' | 'anthropic'` 字段
  - 更新默认配置，为 anthropic 供应商添加 `protocolType: "anthropic"`
- **验收标准**: AC-1
- **测试要求**:
  - `programmatic` TR-1.1: 配置管理器应能正确读取 `protocolType` 字段
  - `programmatic` TR-1.2: 未设置 `protocolType` 时默认为 OpenAI 格式

## [ ] 任务 2: 更新配置文件
- **优先级**: P0
- **依赖**: 任务 1
- **描述**: 
  - 更新 `config.json`，为 anthropic 供应商添加 `protocolType: "anthropic"`
  - 确保现有供应商配置不受影响
- **验收标准**: AC-1
- **测试要求**:
  - `programmatic` TR-2.1: 配置文件应正确加载并包含 protocolType

## [ ] 任务 3: 扩展 API Info 端点
- **优先级**: P0
- **依赖**: 任务 1
- **描述**: 
  - 修改 `src/server.ts` 中的 `/api/info` 端点，返回当前供应商的 `protocolType`
  - 确保前端能够获取协议类型信息
- **验收标准**: AC-1
- **测试要求**:
  - `programmatic` TR-3.1: `/api/info` 应返回包含 protocolType 的供应商信息

## [ ] 任务 4: 实现 Anthropic 响应解析
- **优先级**: P0
- **依赖**: 任务 3
- **描述**: 
  - 在 `public/index.html` 中扩展 `parseResponseBody` 函数，支持 Anthropic 格式
  - 处理 Anthropic 的非流式响应：`content: [{type: "text", text: "..."}]`
  - 处理 Anthropic 的流式响应：`content_block_delta` 事件
  - 处理 Anthropic 的 usage 字段：`input_tokens` / `output_tokens`
- **验收标准**: AC-2, AC-3, AC-4
- **测试要求**:
  - `human-judgment` TR-4.1: Anthropic 非流式响应应正确显示
  - `human-judgment` TR-4.2: Anthropic 流式响应应正确合并显示
  - `human-judgment` TR-4.3: Token 使用量应正确显示

## [ ] 任务 5: 更新 Chat View 渲染逻辑
- **优先级**: P1
- **依赖**: 任务 4
- **描述**: 
  - 修改 `renderChatView` 函数，根据协议类型正确提取消息内容
  - 确保 Anthropic 的 `content` 数组格式被正确处理
- **验收标准**: AC-2
- **测试要求**:
  - `human-judgment` TR-5.1: Chat View 应正确显示 Anthropic 响应

## [ ] 任务 6: 向后兼容性测试
- **优先级**: P1
- **依赖**: 任务 4
- **描述**: 
  - 验证未设置 `protocolType` 的供应商仍使用 OpenAI 格式解析
  - 验证现有的 OpenAI 和 BigModel 供应商不受影响
- **验收标准**: AC-5
- **测试要求**:
  - `programmatic` TR-6.1: 未设置 protocolType 的供应商默认使用 OpenAI 格式
  - `human-judgment` TR-6.2: 现有的 OpenAI/BigModel 供应商显示正常

# 任务依赖关系
```
任务 1 (扩展配置接口)
    ↓
任务 2 (更新配置文件)
    ↓
任务 3 (扩展 API Info)
    ↓
任务 4 (实现 Anthropic 解析) ← 并行 → 任务 5 (更新 Chat View)
    ↓
任务 6 (兼容性测试)
```
