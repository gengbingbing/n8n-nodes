# Alephant n8n Nodes v1 设计

日期：2026-05-11
状态：已确认，待实施计划
范围：`n8n` 新包、`Alephantinterface` 配置入口、`backend-saas-service` 接口确认

## 1. 背景

Alephant BYO-KEY 需要接入 n8n，让用户在自动化 workflow 中通过 Alephant 发起 AI 推理、查看当前 Virtual Key 用量，并让管理员用 PAT 管理 Agent / Virtual Key 与查询治理数据。

当前 Alephant 架构边界如下：

- AI Gateway 负责接收 Virtual Key、询问 policy-service、转发 OpenAI-compatible 推理请求，并异步写入 usage 日志。
- backend-saas-service 负责 SaaS 管理 API、PAT 认证、Agent / Virtual Key / Analytics 查询。
- policy-service 负责策略判断，n8n 节点不直接调用。
- logs-collector / ClickHouse 负责日志落库和分析沉淀，n8n 节点不直接调用。

## 2. 核心决策

第一版发布一个 npm 包，包含三个 n8n 节点：

`@alephantai/n8n-nodes-alephant`

| 节点 | 用户 | Credential | 后端 |
| --- | --- | --- | --- |
| Alephant AI | 使用 VK 发起推理的人 | Alephant Virtual Key | AI Gateway |
| Alephant Usage | 只有 VK 的成员/开发者 | Alephant Virtual Key | Cockpit VK-scoped API |
| Alephant Management | 管理员/FinOps 自动化 | Alephant Manager | backend-saas-service |

选择三个节点而不是一个或两个节点，是为了保持权限边界清晰：

- 推理能力和管理能力分离，避免普通 VK 用户看到高权限管理操作。
- VK 自查用量独立成 Alephant Usage，避免把成员自查误归类到管理员 Management。
- Management 只承载 PAT + workspaceId 的管理与全局分析能力。

## 3. Credential 设计

### 3.1 Alephant Virtual Key

用于 Alephant AI 和 Alephant Usage。

字段：

- `virtualKey`：Virtual Key 明文，作为 Bearer token 使用。
- `gatewayBaseUrl`：可选，高级配置。AI Gateway base URL，未填写时使用节点内置生产默认值，例如 `https://gateway.alephant.ai/v1`。
- `apiBaseUrl`：可选，高级配置。SaaS API base URL，用于 cockpit API，未填写时使用节点内置生产默认值，例如 `https://api.alephant.ai`。

base URL 设计原则：

- 用户正常使用时只需要填写 Virtual Key。
- 测试、staging、self-hosted 或本地联调时，用户可以覆盖 `gatewayBaseUrl` / `apiBaseUrl`。
- 节点实现中应集中维护默认域名，避免三个节点各自硬编码。

请求头：

```http
Authorization: Bearer <virtualKey>
Content-Type: application/json
```

### 3.2 Alephant Manager

用于 Alephant Management。

字段：

- `pat`：Personal Access Token。
- `workspaceId`：目标 workspace UUID。
- `apiBaseUrl`：可选，高级配置。SaaS API base URL，未填写时使用节点内置生产默认值，例如 `https://api.alephant.ai`。

base URL 设计原则：

- 管理员正常使用时只需要填写 PAT 和 workspaceId。
- 测试、staging、self-hosted 或本地联调时，用户可以覆盖 `apiBaseUrl`。
- 与 Alephant Virtual Key credential 共用同一套默认 SaaS API base URL 常量。

请求头：

```http
Authorization: Bearer <pat>
X-Workspace-Id: <workspaceId>
Content-Type: application/json
```

## 4. 节点设计

### 4.1 Alephant AI

目标：让 n8n workflow 通过 Alephant AI Gateway 发起 OpenAI-compatible 推理请求，并自动获得 Alephant 的策略、归因、计费和审计能力。

第一版操作：

| Resource | Operation | 说明 |
| --- | --- | --- |
| Chat | Create Chat Completion | 调用 AI Gateway 的 OpenAI-compatible chat completion endpoint |

参数：

- `model`：模型名称，第一版先支持文本输入；后续可从 Management / Models 动态加载。
- `inputMode`：`prompt` 或 `messages`。
- `prompt`：简单文本输入，节点内部转换为 user message。
- `messages`：JSON 数组，传入 OpenAI-compatible messages。
- `temperature`：可选。
- `maxTokens`：可选。
- `responseFormat`：可选，支持 text/json object 等网关兼容格式。
- `metadata`：可选对象，用于携带 n8n workflow/job/source 标识。
- `additionalOptions`：可选对象，允许透传少量兼容字段。

输出：

- `raw`：Gateway 原始响应。
- `text`：归一化后的首选文本输出。
- `usage`：token usage。
- `model`：实际响应模型。
- `requestId`：响应头或响应体中的请求 ID，若可获得。
- `finishReason`：结束原因。

不做：

- 不查 workspace usage。
- 不创建或管理 VK。
- 不直接调用 backend-saas-service 管理 API。
- 不实现 streaming。

### 4.2 Alephant Usage

目标：让只有一个 VK 的成员、开发者或外部自动化使用者查询“当前这个 VK 自己”的额度、用量、成本和近期请求。

Credential：Alephant Virtual Key。

调用对象：`/api/v1/cockpit/*`。

第一版操作：

| Resource | Operation | 后端接口 |
| --- | --- | --- |
| My Scope | Get | `GET /api/v1/cockpit/scope` |
| My Budget | Get Status | `GET /api/v1/cockpit/budget-status` |
| My Usage | Get Summary | `GET /api/v1/cockpit/usage-summary` |
| My Usage | Get Daily Costs | `GET /api/v1/cockpit/daily-costs` |
| My Usage | Get Cost By Model | `GET /api/v1/cockpit/cost-by-model` |
| My Requests | Get Recent Requests | `GET /api/v1/cockpit/recent-requests` |

常用参数：

- `period`：`24h`、`7d`、`30d`、`billing_cycle`。
- `limit` / `offset`：用于 recent requests。

权限边界：

- 只能查询当前 VK 自己的 scope 和统计。
- 不允许选择其他 `virtualKeyId`。
- 不允许 workspace 全局统计。
- 不允许创建、撤销或修改资源。

### 4.3 Alephant Management

目标：让管理员或 FinOps 自动化 workflow 使用 PAT 管理 Agent / Virtual Key，并查询 workspace 与任意 VK 维度的统计。

Credential：Alephant Manager。

第一版资源与操作：

| Resource | Operation | 后端接口 |
| --- | --- | --- |
| Agent | List | `GET /api/v1/agents` |
| Agent | Create | `POST /api/v1/agents` |
| Virtual Key | List | `GET /api/v1/virtual-keys` |
| Virtual Key | Create | `POST /api/v1/virtual-keys` |
| Virtual Key | Revoke | `POST /api/v1/virtual-keys/{id}/revoke` |
| Models | List | `GET /api/v1/models` |
| Workspace Usage | Get Summary | 复用现有 analytics summary/overview 能力 |
| Workspace Usage | Get History | `GET /api/v1/analytics/usage` |
| Workspace Usage | Get Cost By Model | `GET /api/v1/analytics/models` 或等价成本接口 |
| Virtual Key Usage | Get Summary | 需确认或补充 VK 维度管理接口 |
| Virtual Key Usage | Get History | 需确认或补充 VK 维度管理接口 |
| Virtual Key Usage | Get Cost By Model | 需确认或补充 VK 维度管理接口 |

建议的 VK 维度管理接口：

```http
GET /api/v1/virtual-keys/{id}/analytics/summary
GET /api/v1/virtual-keys/{id}/analytics/history
GET /api/v1/virtual-keys/{id}/analytics/models
```

若现有 analytics API 已支持 `virtualKeyId` filter，则第一版直接复用 filter，不新增接口。

不做：

- 不管理 Master Key。
- 不管理 Workspace Member。
- 不管理 Department。
- 不管理 Billing / Subscription。
- 不配置策略。
- 不创建或撤销 PAT。

## 5. 前端配合

Alephantinterface 需要增加 n8n 配置入口，但不需要实现 n8n 节点逻辑。

入口建议：

- VK 创建成功页 / VK 详情页：`Use with Alephant AI in n8n`，重点展示 `virtualKey`；生产环境不要求用户填写 `gatewayBaseUrl`。
- VK 详情页：`View this key's Usage in n8n`，重点展示 `virtualKey`；生产环境不要求用户填写 `apiBaseUrl`。
- PAT / API Access 面板：`Use Alephant Management in n8n`，重点展示 `pat`、`workspaceId`；生产环境不要求用户填写 `apiBaseUrl`。
- 文档和 UI 可提供 Advanced section，说明 staging/local/self-hosted 场景下如何覆盖 base URL。

文案原则：

- VK 配置和 PAT 配置分开展示。
- 明确说明 Management 凭证权限更高，适合管理员自动化。
- 不在普通成员入口展示 PAT 相关内容。

## 6. 后端配合

必须确认：

- AI Gateway OpenAI-compatible chat completion endpoint 稳定。
- Gateway 使用 VK 作为认证凭证，并能返回可归因的 usage。
- Cockpit VK-scoped API 支持当前 VK 的 budget、usage、model cost、daily costs、recent requests。
- Management API 支持 PAT + `X-Workspace-Id`。
- `/api/v1/models` 在 PAT 场景可稳定返回模型列表。
- VK 维度管理分析能力是否已有 filter；若没有，需要新增接口。

错误结构需要覆盖：

- 无效 VK / PAT。
- VK revoked / expired。
- Policy deny。
- Budget exceeded。
- Rate limited。
- Model not allowed。
- Workspace mismatch。

## 7. 技术实现方向

使用 n8n programmatic style 实现三个节点。原因：

- Alephant AI 需要把 n8n item 转换为 OpenAI-compatible messages。
- 三个节点需要做批量 item 执行和输出归一化。
- Management 节点有多资源多操作，错误处理和参数组合比普通 REST declarative 更复杂。
- 后续可能扩展 streaming、Responses API 或更细粒度错误映射。

第一版包结构建议：

```text
@alephantai/n8n-nodes-alephant
  credentials/
    AlephantVirtualKeyApi.credentials.ts
    AlephantManagerApi.credentials.ts
  nodes/
    AlephantAi/
      AlephantAi.node.ts
    AlephantUsage/
      AlephantUsage.node.ts
    AlephantManagement/
      AlephantManagement.node.ts
  shared/
    transport.ts
    errors.ts
    output.ts
```

## 8. 测试范围

节点包：

- Credential test：VK 和 PAT credentials 能正确注入请求头。
- Alephant AI：prompt 模式、messages 模式、错误响应映射。
- Alephant Usage：每个 cockpit operation 参数和输出结构。
- Alephant Management：Agent / VK / Usage / Models 操作参数和错误映射。
- n8n 本地 dev：节点能在 n8n UI 搜索、配置 credential、执行 workflow。

后端契约：

- 使用真实测试 VK 调 Gateway。
- 使用测试 VK 调 cockpit API。
- 使用测试 PAT 调 Management API。
- 验证 VK 维度 analytics 接口或 filter。

前端：

- 三个 n8n 配置入口展示正确字段。
- 普通 VK 入口不展示 PAT。
- PAT 入口明确 workspaceId 和高权限提示。
- 生产环境 smoke test 覆盖“base URL 留空使用默认值”。
- staging/local 测试覆盖“base URL 覆盖值生效”。

## 9. 发布与文档

发布包：

- 包名：`@alephantai/n8n-nodes-alephant`
- npm package 中包含三个 nodes 和两个 credentials。
- 若申请 n8n verified community node，按 n8n 官方要求通过 GitHub Actions provenance 发布。

文档：

- `Connect Alephant AI to n8n`
- `Check Alephant Virtual Key Usage in n8n`
- `Automate Alephant Management in n8n`

## 10. 非目标

第一版不做：

- Trigger Node。
- Streaming。
- Responses API。
- Embeddings。
- Billing / Subscription。
- Workspace Member / Department 管理。
- Master Key 管理。
- Policy 配置。
- PAT 创建 / 撤销。
- OAuth。

## 11. 待确认项

- Gateway 生产 base URL 的最终域名。
- SaaS API 生产 base URL 的最终域名。
- Chat completion endpoint 的精确路径和响应中的 request ID 来源。
- VK 维度管理分析是否已有现成 filter；若没有，需补 Management API。
