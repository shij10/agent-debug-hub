- [x] 检查点 1: 管理员页面 admin.html 已创建，包含完整的页面结构

- [x] 检查点 2: 页面导航和布局正确，包含 Provider 管理、认证管理、模型管理三个区域

- [x] 检查点 3: Provider 列表展示组件正常工作，显示所有已配置的 provider

- [x] 检查点 4: 添加 Provider 表单功能完整，包含名称、目标主机、协议、Base Path、描述字段

- [x] 检查点 5: 删除 Provider 功能正常工作，带确认对话框，且至少保留一个默认 provider

- [x] 检查点 6: 协议选择功能（openai/anthropic）正常工作

- [x] 检查点 7: Token 输入表单组件正常工作，支持掩码显示和显示/隐藏切换

- [x] 检查点 8: Token 保存功能正常，保存后更新配置文件

- [x] 检查点 9: 模型列表展示组件正常工作，支持多选

- [x] 检查点 10: "获取模型列表"按钮功能正常，能从 provider API 获取模型列表

- [x] 检查点 11: 模型多选功能正常，用户可选择多个模型保存到配置文件

- [x] 检查点 12: 默认模型设置功能正常，能从已保存的模型中选择默认模型

- [x] 检查点 13: 获取模型列表失败时显示错误提示，不提供手动添加选项

- [x] 检查点 14: 后端 API GET /admin/config 端点正常工作，返回当前配置

- [x] 检查点 15: 后端 API POST /admin/providers 端点正常工作，能创建新 provider

- [x] 检查点 16: 后端 API DELETE /admin/providers/:id 端点正常工作，能删除 provider

- [x] 检查点 17: 后端 API PUT /admin/providers/:id/token 端点正常工作，能更新 token

- [x] 检查点 18: 后端 API PUT /admin/providers/:id/models 端点正常工作，能更新模型列表

- [x] 检查点 19: 后端 API PUT /admin/providers/:id/default-model 端点正常工作，能设置默认模型

- [x] 检查点 20: ConfigManager 类已添加 saveConfig 方法，支持动态保存配置

- [x] 检查点 21: 配置写入文件功能正常，保持 JSON 格式

- [x] 检查点 22: Chat 页面已修改，从 /admin/config 获取配置，不再依赖 /models 端点

- [x] 检查点 23: 表单验证功能正常，必填字段和格式验证正确

- [x] 检查点 24: 操作状态提示功能正常，显示加载中、成功、失败状态

- [x] 检查点 25: 所有配置变更正确持久化到 config.json 文件

- [x] 检查点 26: 完整测试套件通过
