# 管理员页面(Admin)功能 Spec

## Why
当前系统缺乏一个统一的管理界面来配置和管理 Provider、认证信息和模型选择。用户需要手动编辑 JSON 配置文件，操作复杂且容易出错。需要一个用户友好的 Web 管理界面，让管理员能够方便地添加/删除 Provider、管理 API Token、选择模型，并自动将配置持久化到本地 JSON 文件。

## What Changes
- 创建全新的管理员页面 `/admin`，提供 Provider、认证、模型的可视化管理
- 实现 Provider 管理功能：添加、删除、协议选择
- 实现认证管理功能：Token 输入和保存
- 实现 Model 管理功能：从 Provider 获取模型列表、选择首选模型
- 修改后端 API，支持配置的动态读写和持久化
- 修改 chat 页面，从本地 JSON 配置文件读取 provider 和 model 信息

## Impact
- Affected specs: chat-endpoint, dynamic-config-loader
- Affected code:
  - `public/admin.html` - 新的管理员页面
  - `src/server.ts` - 新增 admin 相关 API 端点
  - `src/config.ts` - 增强配置管理，支持动态保存
  - `public/chat.html` - 修改配置加载逻辑

## ADDED Requirements

### Requirement: Provider 管理功能
系统 SHALL 提供 Provider 的完整管理功能。

#### Scenario: 添加自定义 Provider
- **GIVEN** 用户在管理员页面
- **WHEN** 用户填写 provider 信息（名称、目标主机、协议、Base Path、描述）并提交
- **THEN** 系统验证输入信息，将新 provider 保存到配置文件，并返回成功提示

#### Scenario: 删除 Provider
- **GIVEN** 用户在管理员页面，存在可删除的 provider
- **WHEN** 用户点击删除按钮并确认
- **THEN** 系统从配置文件中移除该 provider，并返回成功提示
- **AND** 至少保留一个默认 provider，防止全部删除

#### Scenario: Provider 协议选择
- **GIVEN** 用户在添加或编辑 provider
- **WHEN** 用户选择协议类型（openai 或 anthropic）
- **THEN** 系统根据协议类型显示相应的配置选项和验证规则

### Requirement: 认证管理功能
系统 SHALL 提供 API Token 的管理功能。

#### Scenario: Token 输入和保存
- **GIVEN** 用户在管理员页面的认证管理区域
- **WHEN** 用户输入 API Token 并点击保存
- **THEN** 系统验证 Token 格式，保存到对应 provider 的配置中
- **AND** Token 在界面上显示为掩码形式（如 ****...****），支持显示/隐藏切换

### Requirement: Model 管理功能
系统 SHALL 提供模型的选择和管理功能。

#### Scenario: 获取 Provider 的模型列表
- **GIVEN** 用户在管理员页面，已选择某个 provider
- **WHEN** 用户点击"获取模型列表"按钮
- **THEN** 系统调用 provider 的 models API，获取并显示可用模型列表
- **AND** 如果 API 调用失败，显示错误提示，不提供手动添加选项

#### Scenario: 选择要保存的模型
- **GIVEN** 用户在管理员页面，已成功获取模型列表
- **WHEN** 用户从列表中**多选**需要保存的模型
- **THEN** 系统将选中的多个模型保存到配置文件
- **AND** Chat 页面可以从这些保存的模型中进行选择使用

#### Scenario: 设置默认模型
- **GIVEN** 用户在管理员页面，已保存多个模型
- **WHEN** 用户从已保存的模型中选择一个作为默认模型
- **THEN** 系统将选中的模型标记为默认模型，保存到配置文件

### Requirement: 数据持久化
系统 SHALL 将所有配置变更持久化到本地 JSON 文件。

#### Scenario: 配置自动保存
- **WHEN** 用户进行任何配置变更（添加/删除 provider、修改 token、选择模型等）
- **THEN** 系统自动将变更写入 config.json 文件
- **AND** 保存成功后显示确认提示

#### Scenario: 配置读取
- **GIVEN** chat 页面加载或管理员页面加载
- **WHEN** 系统需要获取配置信息
- **THEN** 系统从本地 JSON 配置文件读取，不依赖网络请求

### Requirement: 管理员页面 UI/UX
系统 SHALL 提供用户友好的管理界面。

#### Scenario: 页面布局和导航
- **GIVEN** 用户访问 /admin 页面
- **THEN** 页面显示清晰的导航结构：Provider 管理、认证管理、模型管理
- **AND** 每个区域有明确的标题和操作指引

#### Scenario: 表单验证
- **WHEN** 用户提交表单时
- **THEN** 系统验证必填字段、格式正确性
- **AND** 显示清晰的错误提示信息

#### Scenario: 状态反馈
- **WHEN** 用户执行操作（保存、删除、获取模型等）
- **THEN** 系统显示操作状态（加载中、成功、失败）
- **AND** 提供友好的状态提示和操作指引

## MODIFIED Requirements

### Requirement: Chat 页面配置加载
原有的 chat 页面配置加载逻辑 SHALL 修改为从本地 JSON 配置文件读取。

#### Scenario: Chat 页面加载配置
- **GIVEN** 用户访问 chat 页面
- **WHEN** 页面初始化时
- **THEN** 系统从本地 JSON 配置文件读取 provider 和 model 信息
- **AND** 不再访问 /models 端点获取模型列表，而是直接使用配置文件中的模型列表

## REMOVED Requirements
无
