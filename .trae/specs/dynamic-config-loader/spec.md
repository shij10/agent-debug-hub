# Provider 和 Model 动态配置加载功能 Spec

## Why
当前聊天界面的 provider 和 model 选择器在配置加载方面缺乏健壮性，当配置列表为空或格式异常时，用户体验较差，且当前选中的配置信息显示不够明确。需要增强配置加载的稳定性和错误处理能力。

## What Changes
- 增强配置加载的错误处理机制，支持配置列表为空或格式异常的情况
- 在界面上明确显示当前选中的 provider 和 model 信息
- 添加配置加载状态反馈（加载中、加载失败、无可用配置等）
- 优化配置选择器的用户体验

## Impact
- Affected specs: chat-endpoint
- Affected code: 
  - `public/chat.html` - 前端界面和配置加载逻辑
  - `src/server.ts` - `/info` 和 `/models` 端点的响应格式
  - `src/config.ts` - 配置管理逻辑

## ADDED Requirements

### Requirement: 配置加载健壮性
系统 SHALL 在配置加载过程中提供健壮的错误处理机制。

#### Scenario: 配置列表为空
- **WHEN** 配置文件中 providers 列表为空
- **THEN** 界面应显示"无可用供应商"提示，并禁用发送功能

#### Scenario: 配置格式异常
- **WHEN** 配置文件格式不正确或解析失败
- **THEN** 界面应显示友好的错误提示，并提供重试选项

#### Scenario: 网络请求失败
- **WHEN** 配置加载请求失败（网络错误、服务器错误等）
- **THEN** 界面应显示错误信息，并提供重试按钮

### Requirement: 当前配置信息显示
系统 SHALL 在界面上明确显示当前选中的 provider 和 model 信息。

#### Scenario: 显示当前 provider
- **WHEN** 用户选择了一个 provider
- **THEN** 界面应在状态栏或标题区域显示当前 provider 的名称和描述

#### Scenario: 显示当前 model
- **WHEN** 用户选择了一个 model
- **THEN** 界面应在状态栏或标题区域显示当前 model 的名称和描述

### Requirement: 配置加载状态反馈
系统 SHALL 提供配置加载状态的实时反馈。

#### Scenario: 加载中状态
- **WHEN** 配置正在加载中
- **THEN** 界面应显示加载指示器，并禁用相关操作

#### Scenario: 加载成功状态
- **WHEN** 配置加载成功
- **THEN** 界面应启用所有功能，并显示成功状态

#### Scenario: 加载失败状态
- **WHEN** 配置加载失败
- **THEN** 界面应显示失败原因，并提供重试选项

### Requirement: Model 列表动态加载
系统 SHALL 在 provider 切换时动态加载对应的 model 列表。

#### Scenario: Provider 切换
- **WHEN** 用户切换 provider
- **THEN** 系统应自动加载新 provider 的 model 列表

#### Scenario: Model 列表为空
- **WHEN** provider 没有可用的 model
- **THEN** 界面应显示"无可用模型"提示

#### Scenario: Model 加载失败
- **WHEN** model 列表加载失败
- **THEN** 界面应显示错误提示，并保留上一个有效的 model 列表（如果有）

## MODIFIED Requirements

### Requirement: 配置选择器 UI
原有的 provider 和 model 选择器 SHALL 增强以下功能：
- 添加加载状态指示器
- 添加空状态提示
- 添加错误状态提示
- 显示当前选中项的详细信息

## REMOVED Requirements
无
