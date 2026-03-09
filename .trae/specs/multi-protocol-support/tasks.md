# 多协议支持 - 实现计划

## [x] 任务 1: 扩展配置文件接口
- **优先级**: P0
- **依赖**: 无
- **描述**: 
  - 在 `src/config.ts` 中扩展 `ProviderConfig` 接口，添加 `protocol?: 'openai' | 'anthropic'` 字段
  - 更新默认配置，为 anthropic 供应商添加 `protocol: "anthropic"`
  - 实现向后兼容逻辑：如果配置没有 `protocol` 字段，默认使用 `'openai'`
- **验收标准**: AC-1, AC-5
- **测试要求**:
  - `programmatic` TR-1.1: 配置管理器应能正确读取 `protocol` 字段
  - `programmatic` TR-1.2: 未设置 `protocol` 时默认为 `'openai'`
  - `programmatic` TR-1.3: 新配置格式应正确加载

## [x] 任务 2: 更新配置文件
- **优先级**: P0
- **依赖**: 任务 1
- **描述**: 
  - 更新 `config.json`，为所有供应商添加 `protocol` 字段
  - 添加 `bigmodel_openai` 和 `bigmodel_anthropic` 配置示例
  - 确保配置示例清晰展示扁平式配置方案
- **验收标准**: AC-1
- **测试要求**:
  - `programmatic` TR-2.1: 配置文件应正确加载并包含 protocol 字段
  - `programmatic` TR-2.2: bigmodel_openai 和 bigmodel_anthropic 配置应正确加载

## [x] 任务 3: 实现协议识别逻辑
- **优先级**: P0
- **依赖**: 任务 1
- **描述**: 
  - 在 `src/server.ts` 中实现 `getProtocol` 函数，从供应商配置获取协议类型
  - 将协议类型添加到请求记录中
  - 实现备用自动识别逻辑（基于响应内容特征，用于无配置的情况）
- **验收标准**: AC-2
- **测试要求**:
  - `programmatic` TR-3.1: 应根据供应商配置的 protocol 字段正确识别协议
  - `programmatic` TR-3.2: 自动识别逻辑应正确识别 OpenAI 格式
  - `programmatic` TR-3.3: 自动识别逻辑应正确识别 Anthropic 格式

## [x] 任务 4: 扩展请求记录类型
- **优先级**: P0
- **依赖**: 任务 3
- **描述**: 
  - 在 `src/types.ts` 中扩展 `RequestRecord` 接口，添加 `protocol: 'openai' | 'anthropic'` 字段
  - 更新所有创建 RequestRecord 的地方，包含协议类型
- **验收标准**: AC-3
- **测试要求**:
  - `programmatic` TR-4.1: 请求记录应包含 protocol 字段

## [x] 任务 5: 扩展 API Info 端点
- **优先级**: P1
- **依赖**: 任务 1
- **描述**: 
  - 修改 `src/server.ts` 中的 `/api/info` 端点
  - 返回当前供应商的 `protocol` 字段
- **验收标准**: AC-1
- **测试要求**:
  - `programmatic` TR-5.1: `/api/info` 应返回包含 protocol 的供应商信息

## [x] 任务 6: 实现 Debug UI 多协议解析
- **优先级**: P0
- **依赖**: 任务 4
- **描述**: 
  - 在 `public/index.html` 中重构 `parseResponseBody` 函数
  - 根据 `record.protocol` 字段选择解析逻辑
  - 实现 Anthropic 非流式响应解析（`content: [{type: "text", text: "..."}]`）
  - 实现 Anthropic 流式响应解析（`content_block_delta` 事件）
  - 处理 Anthropic usage 字段（`input_tokens` / `output_tokens`）
- **验收标准**: AC-4
- **测试要求**:
  - `human-judgment` TR-6.1: OpenAI 响应应正确显示
  - `human-judgment` TR-6.2: Anthropic 非流式响应应正确显示
  - `human-judgment` TR-6.3: Anthropic 流式响应应正确合并显示
  - `human-judgment` TR-6.4: Token 使用量应正确显示（两种协议）

## [x] 任务 7: 更新 Chat View 渲染逻辑
- **优先级**: P1
- **依赖**: 任务 6
- **描述**: 
  - 修改 `renderChatView` 函数，根据协议类型正确提取消息内容
  - 确保 Anthropic 的 `content` 数组格式被正确处理
  - 确保 OpenAI 的 `choices` 格式继续正常工作
- **验收标准**: AC-4
- **测试要求**:
  - `human-judgment` TR-7.1: Chat View 应正确显示 OpenAI 响应
  - `human-judgment` TR-7.2: Chat View 应正确显示 Anthropic 响应

## [x] 任务 8: 向后兼容性测试
- **优先级**: P1
- **依赖**: 任务 6, 7
- **描述**: 
  - 验证使用旧版配置文件（无 protocol 字段）的系统仍能正常工作
  - 验证现有的 OpenAI、BigModel、Anthropic 供应商显示正常
  - 验证未设置 protocol 的请求默认使用 OpenAI 格式解析
- **验收标准**: AC-5
- **测试要求**:
  - `programmatic` TR-8.1: 旧配置应继续工作
  - `human-judgment` TR-8.2: 所有现有供应商应显示正常

# 任务依赖关系
```
任务 1 (扩展配置接口)
    ↓
任务 2 (更新配置文件)
    ↓
任务 3 (协议识别逻辑)
    ↓
任务 4 (扩展记录类型) ← 并行 → 任务 5 (扩展 API Info)
    ↓
任务 6 (多协议解析) ← 并行 → 任务 7 (更新 Chat View)
    ↓
任务 8 (兼容性测试)
```
