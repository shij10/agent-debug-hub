# Anthropic 协议支持 - 验收检查清单

## 配置相关
- [ ] ProviderConfig 接口包含 `protocolType?: 'openai' | 'anthropic'` 字段
- [ ] config.json 中 anthropic 供应商设置了 `protocolType: "anthropic"`
- [ ] /api/info 端点返回包含 protocolType 的供应商信息
- [ ] 未设置 protocolType 的供应商默认为 OpenAI 格式

## 响应解析相关
- [ ] parseResponseBody 函数支持 Anthropic 非流式响应格式
- [ ] parseResponseBody 函数支持 Anthropic 流式响应格式（SSE）
- [ ] parseResponseBody 函数正确提取 Anthropic usage 字段（input_tokens/output_tokens）
- [ ] 流式响应正确合并所有 content_block_delta 事件的内容

## Chat View 相关
- [ ] Chat View 正确显示 Anthropic 响应的文本内容
- [ ] Chat View 正确处理 Anthropic 的 content 数组格式
- [ ] Token 使用量条正确显示 Anthropic 的 token 统计

## 向后兼容
- [ ] 未设置 protocolType 的供应商仍使用 OpenAI 格式解析
- [ ] OpenAI 供应商显示正常
- [ ] BigModel 供应商显示正常

## 文档
- [ ] 配置文件变更已记录
- [ ] protocolType 字段的用途已说明
