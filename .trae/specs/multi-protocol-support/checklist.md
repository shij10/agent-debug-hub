# 多协议支持 - 验收检查清单

## 配置扩展
- [x] ProviderConfig 接口包含 `protocol?: 'openai' | 'anthropic'` 字段
- [x] config.json 中所有供应商都设置了 protocol 字段
- [x] config.json 包含 bigmodel_openai 和 bigmodel_anthropic 配置示例
- [x] 向后兼容逻辑正确实现（无 protocol 字段时默认使用 'openai'）

## 协议识别
- [x] 根据供应商配置的 protocol 字段正确识别协议
- [x] 基于响应内容的自动识别作为备用方案
- [x] 识别的协议类型正确记录到 RequestRecord

## 请求记录
- [x] RequestRecord 接口包含 protocol 字段
- [x] 所有创建记录的地方都包含协议类型
- [x] /api/info 端点返回包含 protocol 的供应商信息

## Debug UI 多协议支持
- [x] parseResponseBody 根据 protocol 字段选择解析逻辑
- [x] OpenAI 非流式响应解析正常工作
- [x] OpenAI 流式响应解析正常工作
- [x] Anthropic 非流式响应解析正常工作（content 数组）
- [x] Anthropic 流式响应解析正常工作（content_block_delta）
- [x] OpenAI usage 字段正确提取（prompt_tokens/completion_tokens）
- [x] Anthropic usage 字段正确提取（input_tokens/output_tokens）
- [x] Chat View 正确显示 OpenAI 响应
- [x] Chat View 正确显示 Anthropic 响应
- [x] Token 使用量条正确显示两种协议的统计

## 向后兼容
- [x] 旧版配置文件（无 protocol 字段）继续工作
- [x] 未设置 protocol 的请求默认使用 OpenAI 格式
- [x] OpenAI 供应商显示正常
- [x] BigModel 供应商显示正常
- [x] Anthropic 供应商显示正常

## 文档和示例
- [x] 配置示例清晰展示扁平式配置方案
- [x] protocol 字段的用途和默认值已说明
