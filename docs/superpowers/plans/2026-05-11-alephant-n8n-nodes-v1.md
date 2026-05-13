# Alephant n8n Nodes v1 实施计划

> **给执行 agent 的要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行。步骤使用 checkbox（`- [ ]`）追踪。

**目标：** 构建 Alephant 的第一版 n8n community package，包含 `Alephant AI`、`Alephant Usage`、`Alephant Management` 三个节点。

**架构：** n8n 包位于 `n8n/`，使用 TypeScript programmatic nodes。`Alephant AI` 使用 Virtual Key 调 AI Gateway；`Alephant Usage` 使用 Virtual Key 调 VK-scoped cockpit API；`Alephant Management` 使用 PAT + workspaceId 调 `backend-saas-service`。策略判断和日志落库仍由现有 Gateway / policy-service / logs-collector 链路负责。

**技术栈：** TypeScript、n8n community node SDK、Jest、ESLint、npm、Alephant AI Gateway、backend-saas-service REST API。

---

## 文件结构

在 `/Users/allin/WE/AlephantAI-main/n8n` 下创建 n8n 节点包：

```text
n8n/
  package.json
  index.ts
  tsconfig.json
  jest.config.js
  eslint.config.js
  .prettierrc
  scripts/
    copy-assets.cjs
  credentials/
    AlephantVirtualKeyApi.credentials.ts
    AlephantManagerApi.credentials.ts
  nodes/
    AlephantAi/
      AlephantAi.node.ts
      alephant.svg
    AlephantUsage/
      AlephantUsage.node.ts
      alephant.svg
    AlephantManagement/
      AlephantManagement.node.ts
      alephant.svg
  shared/
    constants.ts
    credentials.ts
    errors.ts
    http.ts
    json.ts
    output.ts
    types.ts
  test/
    credentials.test.ts
    ai-node.test.ts
    usage-node.test.ts
    management-node.test.ts
    output.test.ts
```

职责边界：

- `credentials/*`：n8n credential 定义，包含可选 base URL 字段。
- `shared/constants.ts`：生产默认 base URL 和 endpoint path。
- `shared/credentials.ts`：credential 解析与默认值合并。
- `shared/http.ts`：统一请求助手，负责 header、base URL、错误归一化。
- `shared/json.ts`：统一解析 n8n `json` 参数，兼容 object 和 JSON string，并拒绝非对象输入。
- `shared/output.ts`：AI 和 API 响应归一化。
- `shared/types.ts`：节点和测试共享的本地 DTO 类型。
- `nodes/AlephantAi`：只做 Chat Completion。
- `nodes/AlephantUsage`：只做当前 VK 的 cockpit analytics。
- `nodes/AlephantManagement`：只做 PAT workspace 管理和已存在的 workspace / agent / member / department analytics；PAT 任意 VK 维度 analytics 等后端契约补齐后再追加。

## 任务 0：确认生产 base URL

**目标：** 在写入 `shared/constants.ts` 和 credential 默认值前，先确认当前产品生产域名，避免后续测试和 README 锁定错误默认值。

- [ ] **步骤 1：确认默认 API / Gateway host**

结合当前公开 API reference、Gateway 文档和产品配置确认：

```text
DEFAULT_GATEWAY_BASE_URL
DEFAULT_SAAS_BASE_URL
DEFAULT_ANALYTICS_BASE_URL
```

当前已知信息：

- 公开 API Reference 位于 `https://developers.alephant.io/api-reference`。
- AI Gateway host 是 `https://ai.alephant.io/v1`。
- SaaS 后端 host 是 `https://alephant.io`。
- 统计分析 host 是 `https://analytics.alephant.io`。
- 旧 MCP 示例曾使用 `https://api.alephant.ai`。

执行本计划时必须在这里选定默认值。如果产品最终确认的域名不同于下面示例代码，先同步更新 `shared/constants.ts`、credential 测试、README 和 smoke test，再继续任务 1。

## 任务 1：初始化 n8n community package

**文件：**

- 新建：`package.json`
- 新建：`index.ts`
- 新建：`tsconfig.json`
- 新建：`jest.config.js`
- 新建：`eslint.config.js`
- 新建：`.prettierrc`
- 新建：`scripts/copy-assets.cjs`
- 新建：`nodes/AlephantAi/alephant.svg`，内容复制自 `Alephantinterface/public/logo.svg`
- 新建：`nodes/AlephantUsage/alephant.svg`，内容复制自 `Alephantinterface/public/logo.svg`
- 新建：`nodes/AlephantManagement/alephant.svg`，内容复制自 `Alephantinterface/public/logo.svg`
- [ ] **步骤 1：确认当前目录是 n8n 独立仓库**

运行：

```bash
pwd
git rev-parse --show-toplevel
```

预期：两个路径都指向 `/Users/allin/WE/AlephantAI-main/n8n`。如果 `git rev-parse --show-toplevel` 返回 `/Users/allin/WE/AlephantAI-main`，停止执行，不要提交；先把 `n8n/` 初始化或切换为独立仓库。

- [ ] **步骤 2：创建目录**

运行：

```bash
mkdir -p credentials shared test docs scripts nodes/AlephantAi nodes/AlephantUsage nodes/AlephantManagement
```

预期：所有后续要写入的目录存在。

- [ ] **步骤 3：创建 package 与工具链配置**

创建 `package.json`：

```json
{
  "name": "@alephantai/n8n-nodes-alephant",
  "version": "0.1.0",
  "description": "n8n nodes for Alephant AI Gateway, Virtual Key usage, and management automation",
  "license": "MIT",
  "homepage": "https://alephant.ai",
  "author": {
    "name": "Alephant"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/alephant-ai/n8n-nodes-alephant.git"
  },
  "keywords": [
    "n8n-community-node-package",
    "n8n",
    "alephant",
    "ai",
    "finops",
    "byok"
  ],
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json && npm run copy:assets",
    "copy:assets": "node scripts/copy-assets.cjs",
    "dev": "n8n-node dev",
    "lint": "eslint \"{credentials,nodes,shared,test}/**/*.ts\"",
    "test": "jest --runInBand",
    "prepublishOnly": "npm run lint && npm run test && npm run build"
  },
  "files": [
    "dist",
    "docs",
    "README.md",
    "package.json"
  ],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/AlephantVirtualKeyApi.credentials.js",
      "dist/credentials/AlephantManagerApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/AlephantAi/AlephantAi.node.js",
      "dist/nodes/AlephantUsage/AlephantUsage.node.js",
      "dist/nodes/AlephantManagement/AlephantManagement.node.js"
    ]
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^20.12.12",
    "typescript-eslint": "^8.35.0",
    "@n8n/node-cli": "^0.29.1",
    "eslint": "^9.31.0",
    "jest": "^29.7.0",
    "n8n-workflow": "^2.16.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}
```

创建 `index.ts`：

```ts
export {};
```

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2021"],
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": ".",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["index.ts", "credentials/**/*.ts", "nodes/**/*.ts", "shared/**/*.ts"],
  "exclude": ["dist", "node_modules", "test"]
}
```

创建 `jest.config.js`：

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  clearMocks: true,
};
```

创建 `eslint.config.js`：

```js
const tseslint = require('typescript-eslint');

module.exports = [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-undef': 'off',
    },
  },
];
```

创建 `.prettierrc`：

```json
{
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

创建 `scripts/copy-assets.cjs`：

```js
const fs = require('fs');
const path = require('path');

const nodes = ['AlephantAi', 'AlephantUsage', 'AlephantManagement'];

for (const nodeName of nodes) {
  const source = path.join(__dirname, '..', 'nodes', nodeName, 'alephant.svg');
  const targetDir = path.join(__dirname, '..', 'dist', 'nodes', nodeName);
  const target = path.join(targetDir, 'alephant.svg');
  fs.mkdirSync(targetDir, { recursive: true });
  fs.copyFileSync(source, target);
}
```

三个节点目录里的 `alephant.svg` 必须复用现有品牌图标，不手写临时 SVG。执行：

```bash
cp /Users/allin/WE/AlephantAI-main/Alephantinterface/public/logo.svg nodes/AlephantAi/alephant.svg
cp /Users/allin/WE/AlephantAI-main/Alephantinterface/public/logo.svg nodes/AlephantUsage/alephant.svg
cp /Users/allin/WE/AlephantAI-main/Alephantinterface/public/logo.svg nodes/AlephantManagement/alephant.svg
```

- [ ] **步骤 4：安装依赖**

运行：

```bash
npm install
```

预期：生成 `node_modules` 和 `package-lock.json`。

- [ ] **步骤 5：验证空包构建链路**

运行：

```bash
npm run build
```

预期：通过，确认 TypeScript build 和 SVG 复制脚本可运行。此时 n8n metadata 指向的 credentials / node JS 文件还未全部生成，后续任务会补齐。

- [ ] **步骤 6：提交脚手架**

```bash
git add package.json package-lock.json index.ts tsconfig.json jest.config.js eslint.config.js .prettierrc scripts/copy-assets.cjs nodes/AlephantAi/alephant.svg nodes/AlephantUsage/alephant.svg nodes/AlephantManagement/alephant.svg
git commit -m "chore(n8n): scaffold Alephant node package"
```

## 任务 2：共享常量、类型、HTTP 和输出助手

**文件：**

- 新建：`shared/constants.ts`
- 新建：`shared/types.ts`
- 新建：`shared/errors.ts`
- 新建：`shared/http.ts`
- 新建：`shared/json.ts`
- 新建：`shared/output.ts`
- 测试：`test/output.test.ts`
- [ ] **步骤 1：先写输出归一化测试**

创建 `test/output.test.ts`：

```ts
import { parseJsonObjectInput } from '../shared/json';
import { normalizeChatCompletion, trimTrailingSlash } from '../shared/output';

describe('shared output helpers', () => {
  it('normalizes chat completion text and usage', () => {
    const normalized = normalizeChatCompletion(
      {
        id: 'chatcmpl_123',
        model: 'gpt-4o-mini',
        choices: [
          {
            message: { role: 'assistant', content: 'Hello from Alephant' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
      },
      'req_123',
    );

    expect(normalized.text).toBe('Hello from Alephant');
    expect(normalized.model).toBe('gpt-4o-mini');
    expect(normalized.requestId).toBe('req_123');
    expect(normalized.finishReason).toBe('stop');
    expect(normalized.usage.total_tokens).toBe(14);
  });

  it('trims trailing slashes from base URLs', () => {
    expect(trimTrailingSlash('https://analytics.alephant.io///')).toBe('https://analytics.alephant.io');
  });

  it('parses JSON object parameters from strings and objects', () => {
    expect(parseJsonObjectInput('{"seed":7}', 'Additional Options')).toEqual({ seed: 7 });
    expect(parseJsonObjectInput({ workflow: 'wf_1' }, 'Metadata')).toEqual({ workflow: 'wf_1' });
    expect(parseJsonObjectInput('', 'Metadata')).toEqual({});
    expect(parseJsonObjectInput(undefined, 'Metadata')).toEqual({});
  });

  it('rejects JSON parameters that are not objects', () => {
    expect(() => parseJsonObjectInput('[1,2]', 'Metadata')).toThrow('Metadata must be a JSON object');
    expect(() => parseJsonObjectInput('{bad json}', 'Metadata')).toThrow('Metadata must be valid JSON');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
npm test -- output.test.ts
```

预期：失败，提示找不到 `../shared/output`。

- [ ] **步骤 3：实现共享文件**

创建 `shared/constants.ts`：

```ts
export const DEFAULT_GATEWAY_BASE_URL = 'https://ai.alephant.io/v1';
export const DEFAULT_SAAS_BASE_URL = 'https://alephant.io';
export const DEFAULT_ANALYTICS_BASE_URL = 'https://analytics.alephant.io';

export const ENDPOINTS = {
  chatCompletions: '/chat/completions',
  cockpitScope: '/api/v1/cockpit/scope',
  cockpitBudgetStatus: '/api/v1/cockpit/budget-status',
  cockpitUsageSummary: '/api/v1/cockpit/usage-summary',
  cockpitDailyCosts: '/api/v1/cockpit/daily-costs',
  cockpitCostByModel: '/api/v1/cockpit/cost-by-model',
  cockpitRecentRequests: '/api/v1/cockpit/recent-requests',
  agents: '/api/v1/agents',
  virtualKeys: '/api/v1/virtual-keys',
  models: '/api/v1/models',
  analyticsOverview: '/api/v1/analytics/overview',
  analyticsUsage: '/api/v1/analytics/usage',
  analyticsModels: '/api/v1/analytics/models',
};
```

创建 `shared/types.ts`：

```ts
export type InputMode = 'prompt' | 'messages';

export interface AlephantVirtualKeyCredentials {
  virtualKey: string;
  gatewayBaseUrl?: string;
  analyticsBaseUrl?: string;
}

export interface AlephantManagerCredentials {
  pat: string;
  workspaceId: string;
  saasBaseUrl?: string;
  analyticsBaseUrl?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface NormalizedChatCompletion {
  raw: unknown;
  text: string;
  usage: Record<string, unknown>;
  model: string | undefined;
  requestId: string | undefined;
  finishReason: string | undefined;
}
```

创建 `shared/errors.ts`：

```ts
import { NodeApiError } from 'n8n-workflow';
import type { IExecuteFunctions, IHttpRequestMethods } from 'n8n-workflow';

export function toNodeApiError(
  ctx: IExecuteFunctions,
  error: unknown,
  method: IHttpRequestMethods,
  url: string,
): NodeApiError {
  if (error instanceof NodeApiError) {
    return error;
  }

  const message = error instanceof Error ? error.message : 'Alephant request failed';
  return new NodeApiError(ctx.getNode(), {
    message,
    description: `${method} ${url}`,
  });
}
```

创建 `shared/http.ts`：

```ts
import type { IExecuteFunctions, IHttpRequestMethods, IHttpRequestOptions } from 'n8n-workflow';
import { toNodeApiError } from './errors';
import { trimTrailingSlash } from './output';

export interface AlephantRequestOptions {
  method: IHttpRequestMethods;
  baseUrl: string;
  path: string;
  token: string;
  workspaceId?: string;
  qs?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export async function alephantRequest<T>(
  ctx: IExecuteFunctions,
  options: AlephantRequestOptions,
): Promise<T> {
  const url = `${trimTrailingSlash(options.baseUrl)}${options.path}`;
  const request: IHttpRequestOptions = {
    method: options.method,
    url,
    json: true,
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      ...(options.workspaceId ? { 'X-Workspace-Id': options.workspaceId } : {}),
    },
    qs: options.qs,
    body: options.body,
  };

  try {
    return (await ctx.helpers.httpRequest(request)) as T;
  } catch (error) {
    throw toNodeApiError(ctx, error, options.method, url);
  }
}
```

创建 `shared/json.ts`：

```ts
export function parseJsonObjectInput(value: unknown, fieldName: string): Record<string, unknown> {
  if (value === undefined || value === null || value === '') {
    return {};
  }

  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error(`${fieldName} must be valid JSON`);
    }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldName} must be a JSON object`);
  }

  return parsed as Record<string, unknown>;
}
```

创建 `shared/output.ts`：

```ts
import type { NormalizedChatCompletion } from './types';

export function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export function normalizeChatCompletion(raw: any, requestId?: string): NormalizedChatCompletion {
  const firstChoice = Array.isArray(raw?.choices) ? raw.choices[0] : undefined;
  const text =
    firstChoice?.message?.content ??
    firstChoice?.text ??
    '';

  return {
    raw,
    text,
    usage: raw?.usage ?? {},
    model: raw?.model,
    requestId,
    finishReason: firstChoice?.finish_reason ?? firstChoice?.finishReason,
  };
}
```

- [ ] **步骤 4：运行测试**

运行：

```bash
npm test -- output.test.ts
```

预期：通过。

- [ ] **步骤 5：提交共享助手**

```bash
git add shared test/output.test.ts
git commit -m "feat(n8n): add Alephant shared helpers"
```

## 任务 3：Credentials

**文件：**

- 新建：`credentials/AlephantVirtualKeyApi.credentials.ts`
- 新建：`credentials/AlephantManagerApi.credentials.ts`
- 新建：`shared/credentials.ts`
- 测试：`test/credentials.test.ts`
- [ ] **步骤 1：先写 credential helper 测试**

创建 `test/credentials.test.ts`：

```ts
import {
  DEFAULT_ANALYTICS_BASE_URL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_SAAS_BASE_URL,
} from '../shared/constants';
import { resolveManagerCredentials, resolveVirtualKeyCredentials } from '../shared/credentials';

describe('credential helpers', () => {
  it('uses default base URLs for virtual key credentials', () => {
    const resolved = resolveVirtualKeyCredentials({ virtualKey: 'vk-test' });
    expect(resolved.virtualKey).toBe('vk-test');
    expect(resolved.gatewayBaseUrl).toBe(DEFAULT_GATEWAY_BASE_URL);
    expect(resolved.analyticsBaseUrl).toBe(DEFAULT_ANALYTICS_BASE_URL);
  });

  it('allows virtual key base URL overrides', () => {
    const resolved = resolveVirtualKeyCredentials({
      virtualKey: 'vk-test',
      gatewayBaseUrl: 'http://localhost:8080/v1/',
      analyticsBaseUrl: 'http://localhost:3001/',
    });
    expect(resolved.gatewayBaseUrl).toBe('http://localhost:8080/v1');
    expect(resolved.analyticsBaseUrl).toBe('http://localhost:3001');
  });

  it('uses default SaaS and analytics base URLs for manager credentials', () => {
    const resolved = resolveManagerCredentials({ pat: 'pat_test', workspaceId: 'ws_123' });
    expect(resolved.saasBaseUrl).toBe(DEFAULT_SAAS_BASE_URL);
    expect(resolved.analyticsBaseUrl).toBe(DEFAULT_ANALYTICS_BASE_URL);
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
npm test -- credentials.test.ts
```

预期：失败，提示找不到 `../shared/credentials`。

- [ ] **步骤 3：实现 credential helper 和 n8n credential 文件**

创建 `shared/credentials.ts`：

```ts
import {
  DEFAULT_ANALYTICS_BASE_URL,
  DEFAULT_GATEWAY_BASE_URL,
  DEFAULT_SAAS_BASE_URL,
} from './constants';
import { trimTrailingSlash } from './output';
import type { AlephantManagerCredentials, AlephantVirtualKeyCredentials } from './types';

export function resolveVirtualKeyCredentials(
  raw: AlephantVirtualKeyCredentials,
): Required<AlephantVirtualKeyCredentials> {
  return {
    virtualKey: raw.virtualKey,
    gatewayBaseUrl: trimTrailingSlash(raw.gatewayBaseUrl || DEFAULT_GATEWAY_BASE_URL),
    analyticsBaseUrl: trimTrailingSlash(raw.analyticsBaseUrl || DEFAULT_ANALYTICS_BASE_URL),
  };
}

export function resolveManagerCredentials(
  raw: AlephantManagerCredentials,
): Required<AlephantManagerCredentials> {
  return {
    pat: raw.pat,
    workspaceId: raw.workspaceId,
    saasBaseUrl: trimTrailingSlash(raw.saasBaseUrl || DEFAULT_SAAS_BASE_URL),
    analyticsBaseUrl: trimTrailingSlash(raw.analyticsBaseUrl || DEFAULT_ANALYTICS_BASE_URL),
  };
}
```

创建 `credentials/AlephantVirtualKeyApi.credentials.ts`：

```ts
import type { ICredentialType, INodeProperties } from 'n8n-workflow';
import { DEFAULT_ANALYTICS_BASE_URL, DEFAULT_GATEWAY_BASE_URL } from '../shared/constants';

export class AlephantVirtualKeyApi implements ICredentialType {
  name = 'alephantVirtualKeyApi';
  displayName = 'Alephant Virtual Key';
  documentationUrl = 'https://docs.alephant.ai/integrations/n8n';

  properties: INodeProperties[] = [
    {
      displayName: 'Virtual Key',
      name: 'virtualKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Alephant Virtual Key used for AI Gateway and VK-scoped usage APIs',
    },
    {
      displayName: 'Gateway Base URL',
      name: 'gatewayBaseUrl',
      type: 'string',
      default: DEFAULT_GATEWAY_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted Gateway testing.',
    },
    {
      displayName: 'Analytics Base URL',
      name: 'analyticsBaseUrl',
      type: 'string',
      default: DEFAULT_ANALYTICS_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted analytics API testing.',
    },
  ];
}
```

创建 `credentials/AlephantManagerApi.credentials.ts`：

```ts
import type { ICredentialType, INodeProperties } from 'n8n-workflow';
import { DEFAULT_ANALYTICS_BASE_URL, DEFAULT_SAAS_BASE_URL } from '../shared/constants';

export class AlephantManagerApi implements ICredentialType {
  name = 'alephantManagerApi';
  displayName = 'Alephant Manager';
  documentationUrl = 'https://docs.alephant.ai/integrations/n8n';

  properties: INodeProperties[] = [
    {
      displayName: 'Personal Access Token',
      name: 'pat',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Alephant PAT for workspace management automation. Read scope is enough for list and analytics; write scope is required for create, revoke, rotate, or update operations.',
    },
    {
      displayName: 'Workspace ID',
      name: 'workspaceId',
      type: 'string',
      default: '',
      required: true,
      description: 'Workspace UUID used as X-Workspace-Id',
    },
    {
      displayName: 'SaaS Base URL',
      name: 'saasBaseUrl',
      type: 'string',
      default: DEFAULT_SAAS_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted SaaS API testing.',
    },
    {
      displayName: 'Analytics Base URL',
      name: 'analyticsBaseUrl',
      type: 'string',
      default: DEFAULT_ANALYTICS_BASE_URL,
      required: false,
      description: 'Optional. Override for staging, local, or self-hosted analytics API testing.',
    },
  ];
}
```

- [ ] **步骤 4：运行测试和构建**

运行：

```bash
npm test -- credentials.test.ts
npm run build
```

预期：credential 测试通过；构建通过，但 n8n metadata 指向的 node JS 文件要到三个节点任务完成后才补齐。

- [ ] **步骤 5：提交 credentials**

```bash
git add credentials shared/credentials.ts test/credentials.test.ts
git commit -m "feat(n8n): add Alephant credentials"
```

## 任务 4：Alephant AI 节点

**文件：**

- 新建：`nodes/AlephantAi/AlephantAi.node.ts`
- 测试：`test/ai-node.test.ts`
- [ ] **步骤 1：先写 payload 构造测试**

创建 `test/ai-node.test.ts`：

```ts
import { buildChatCompletionBody, parseMessagesInput } from '../nodes/AlephantAi/AlephantAi.node';

describe('Alephant AI node', () => {
  it('builds a prompt-mode chat completion body', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Summarize this',
      temperature: 0.2,
      maxTokens: 200,
      responseFormat: 'json_object',
      metadata: { workflow: 'wf_1' },
      additionalOptions: {},
    });

    expect(body.messages).toEqual([{ role: 'user', content: 'Summarize this' }]);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(200);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('builds a messages-mode chat completion body', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'messages',
      messages: [{ role: 'system', content: 'Be concise' }, { role: 'user', content: 'Hi' }],
      additionalOptions: { seed: 7 },
    });

    expect(body.messages).toHaveLength(2);
    expect(body.seed).toBe(7);
  });

  it('does not let additional options override core request fields', () => {
    const body = buildChatCompletionBody({
      model: 'gpt-4o-mini',
      inputMode: 'prompt',
      prompt: 'Hi',
      additionalOptions: {
        model: 'override',
        messages: [],
        temperature: 0,
        seed: 7,
      },
    });

    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toEqual([{ role: 'user', content: 'Hi' }]);
    expect(body.temperature).toBeUndefined();
    expect(body.seed).toBe(7);
  });

  it('parses messages from JSON string input', () => {
    expect(parseMessagesInput('[{"role":"user","content":"Hi"}]')).toEqual([
      { role: 'user', content: 'Hi' },
    ]);
  });

  it('rejects non-array messages input', () => {
    expect(() => parseMessagesInput('{"role":"user","content":"Hi"}')).toThrow(
      'Messages must be a JSON array',
    );
  });

  it('rejects invalid messages JSON with a stable message', () => {
    expect(() => parseMessagesInput('{bad json}')).toThrow('Messages must be valid JSON');
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
npm test -- ai-node.test.ts
```

预期：失败，提示找不到 `AlephantAi.node`。

- [ ] **步骤 3：实现 AI 节点**

创建 `nodes/AlephantAi/AlephantAi.node.ts`：

```ts
import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveVirtualKeyCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import { parseJsonObjectInput } from '../../shared/json';
import { normalizeChatCompletion } from '../../shared/output';
import type { AlephantVirtualKeyCredentials, ChatMessage, InputMode } from '../../shared/types';

export interface ChatCompletionInput {
  model: string;
  inputMode: InputMode;
  prompt?: string;
  messages?: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: string;
  metadata?: Record<string, unknown>;
  additionalOptions?: Record<string, unknown>;
}

const CORE_CHAT_COMPLETION_FIELDS = new Set([
  'model',
  'messages',
  'temperature',
  'max_tokens',
  'response_format',
  'metadata',
]);

export function buildChatCompletionBody(input: ChatCompletionInput): Record<string, unknown> {
  const messages =
    input.inputMode === 'messages'
      ? input.messages || []
      : [{ role: 'user', content: input.prompt || '' }];

  const body: Record<string, unknown> = {
    model: input.model,
    messages,
    ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
    ...(input.maxTokens !== undefined ? { max_tokens: input.maxTokens } : {}),
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...filterAdditionalOptions(input.additionalOptions || {}),
  };

  if (input.responseFormat && input.responseFormat !== 'text') {
    body.response_format = { type: input.responseFormat };
  }

  return body;
}

function filterAdditionalOptions(options: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(options).filter(([key]) => !CORE_CHAT_COMPLETION_FIELDS.has(key)),
  );
}

export function parseMessagesInput(value: unknown): ChatMessage[] {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('Messages must be valid JSON');
    }
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Messages must be a JSON array');
  }
  for (const message of parsed) {
    if (
      typeof message !== 'object' ||
      message === null ||
      typeof (message as ChatMessage).role !== 'string' ||
      typeof (message as ChatMessage).content !== 'string'
    ) {
      throw new Error('Each message must include string role and content fields');
    }
  }
  return parsed as ChatMessage[];
}

export class AlephantAi implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Alephant AI',
    name: 'alephantAi',
    icon: 'file:alephant.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Call Alephant AI Gateway with a Virtual Key',
    defaults: { name: 'Alephant AI' },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [{ name: 'alephantVirtualKeyApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'chatCompletion',
        options: [{ name: 'Chat Completion', value: 'chatCompletion' }],
      },
      { displayName: 'Model', name: 'model', type: 'string', default: 'gpt-4o-mini', required: true },
      {
        displayName: 'Input Mode',
        name: 'inputMode',
        type: 'options',
        default: 'prompt',
        options: [
          { name: 'Prompt', value: 'prompt' },
          { name: 'Messages JSON', value: 'messages' },
        ],
      },
      {
        displayName: 'Prompt',
        name: 'prompt',
        type: 'string',
        typeOptions: { rows: 5 },
        default: '',
        displayOptions: { show: { inputMode: ['prompt'] } },
      },
      {
        displayName: 'Messages',
        name: 'messages',
        type: 'json',
        default: '[]',
        displayOptions: { show: { inputMode: ['messages'] } },
      },
      { displayName: 'Temperature', name: 'temperature', type: 'number', default: 0.7 },
      { displayName: 'Max Tokens', name: 'maxTokens', type: 'number', default: 1024 },
      {
        displayName: 'Response Format',
        name: 'responseFormat',
        type: 'options',
        default: 'text',
        options: [
          { name: 'Text', value: 'text' },
          { name: 'JSON Object', value: 'json_object' },
        ],
      },
      { displayName: 'Metadata', name: 'metadata', type: 'json', default: '{}' },
      { displayName: 'Additional Options', name: 'additionalOptions', type: 'json', default: '{}' },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = resolveVirtualKeyCredentials(
      (await this.getCredentials('alephantVirtualKeyApi')) as AlephantVirtualKeyCredentials,
    );
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const inputMode = this.getNodeParameter('inputMode', itemIndex) as InputMode;
      let body: Record<string, unknown>;

      try {
        const rawMessages =
          inputMode === 'messages'
            ? parseMessagesInput(this.getNodeParameter('messages', itemIndex, []))
            : [];
        body = buildChatCompletionBody({
          model: this.getNodeParameter('model', itemIndex) as string,
          inputMode,
          prompt: this.getNodeParameter('prompt', itemIndex, '') as string,
          messages: rawMessages,
          temperature: this.getNodeParameter('temperature', itemIndex, undefined) as number | undefined,
          maxTokens: this.getNodeParameter('maxTokens', itemIndex, undefined) as number | undefined,
          responseFormat: this.getNodeParameter('responseFormat', itemIndex, 'text') as string,
          metadata: parseJsonObjectInput(this.getNodeParameter('metadata', itemIndex, {}), 'Metadata'),
          additionalOptions: parseJsonObjectInput(
            this.getNodeParameter('additionalOptions', itemIndex, {}),
            'Additional Options',
          ),
        });
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          error instanceof Error ? error.message : 'Invalid Alephant AI input',
          { itemIndex },
        );
      }

      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        throw new NodeOperationError(this.getNode(), 'At least one message is required', { itemIndex });
      }

      const raw = await alephantRequest<Record<string, unknown>>(this, {
        method: 'POST',
        baseUrl: credentials.gatewayBaseUrl,
        path: ENDPOINTS.chatCompletions,
        token: credentials.virtualKey,
        body,
      });

      returnData.push({ json: normalizeChatCompletion(raw) as unknown as Record<string, unknown> });
    }

    return [returnData];
  }
}
```

- [ ] **步骤 4：运行测试**

运行：

```bash
npm test -- ai-node.test.ts
```

预期：通过。

- [ ] **步骤 5：提交 AI 节点**

```bash
git add nodes/AlephantAi test/ai-node.test.ts
git commit -m "feat(n8n): add Alephant AI node"
```

## 任务 5：Alephant Usage 节点

**文件：**

- 新建：`nodes/AlephantUsage/AlephantUsage.node.ts`
- 测试：`test/usage-node.test.ts`
- [ ] **步骤 1：先写 operation mapping 测试**

创建 `test/usage-node.test.ts`：

```ts
import { buildUsageRequest } from '../nodes/AlephantUsage/AlephantUsage.node';

describe('Alephant Usage node', () => {
  it('maps usage summary operation', () => {
    expect(buildUsageRequest('usageSummary', { period: '7d' })).toEqual({
      path: '/api/v1/cockpit/usage-summary',
      qs: { period: '7d' },
    });
  });

  it('maps recent requests operation', () => {
    expect(buildUsageRequest('recentRequests', { limit: 25, offset: 10 })).toEqual({
      path: '/api/v1/cockpit/recent-requests',
      qs: { limit: 25, offset: 10 },
    });
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
npm test -- usage-node.test.ts
```

预期：失败，提示找不到 `AlephantUsage.node`。

- [ ] **步骤 3：实现 Usage 节点**

创建 `nodes/AlephantUsage/AlephantUsage.node.ts`：

```ts
import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveVirtualKeyCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import type { AlephantVirtualKeyCredentials } from '../../shared/types';

export type UsageOperation =
  | 'scope'
  | 'budgetStatus'
  | 'usageSummary'
  | 'dailyCosts'
  | 'costByModel'
  | 'recentRequests';

export function buildUsageRequest(
  operation: UsageOperation,
  params: Record<string, unknown>,
): { path: string; qs?: Record<string, unknown> } {
  switch (operation) {
    case 'scope':
      return { path: ENDPOINTS.cockpitScope };
    case 'budgetStatus':
      return { path: ENDPOINTS.cockpitBudgetStatus, qs: { period: params.period } };
    case 'usageSummary':
      return { path: ENDPOINTS.cockpitUsageSummary, qs: { period: params.period } };
    case 'dailyCosts':
      return { path: ENDPOINTS.cockpitDailyCosts, qs: { period: params.period } };
    case 'costByModel':
      return { path: ENDPOINTS.cockpitCostByModel, qs: { period: params.period } };
    case 'recentRequests':
      return { path: ENDPOINTS.cockpitRecentRequests, qs: { limit: params.limit, offset: params.offset } };
  }
}

export class AlephantUsage implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Alephant Usage',
    name: 'alephantUsage',
    icon: 'file:alephant.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Read usage and budget information for the current Alephant Virtual Key',
    defaults: { name: 'Alephant Usage' },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [{ name: 'alephantVirtualKeyApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        default: 'usageSummary',
        options: [
          { name: 'Get My Scope', value: 'scope' },
          { name: 'Get My Budget Status', value: 'budgetStatus' },
          { name: 'Get My Usage Summary', value: 'usageSummary' },
          { name: 'Get My Daily Costs', value: 'dailyCosts' },
          { name: 'Get My Cost By Model', value: 'costByModel' },
          { name: 'Get My Recent Requests', value: 'recentRequests' },
        ],
      },
      {
        displayName: 'Period',
        name: 'period',
        type: 'options',
        default: 'billing_cycle',
        options: [
          { name: '24 Hours', value: '24h' },
          { name: '7 Days', value: '7d' },
          { name: '30 Days', value: '30d' },
          { name: 'Billing Cycle', value: 'billing_cycle' },
        ],
        displayOptions: { hide: { operation: ['scope', 'recentRequests'] } },
      },
      {
        displayName: 'Limit',
        name: 'limit',
        type: 'number',
        default: 20,
        displayOptions: { show: { operation: ['recentRequests'] } },
      },
      {
        displayName: 'Offset',
        name: 'offset',
        type: 'number',
        default: 0,
        displayOptions: { show: { operation: ['recentRequests'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = resolveVirtualKeyCredentials(
      (await this.getCredentials('alephantVirtualKeyApi')) as AlephantVirtualKeyCredentials,
    );
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const operation = this.getNodeParameter('operation', itemIndex) as UsageOperation;
      const request = buildUsageRequest(operation, {
        period: this.getNodeParameter('period', itemIndex, 'billing_cycle'),
        limit: this.getNodeParameter('limit', itemIndex, 20),
        offset: this.getNodeParameter('offset', itemIndex, 0),
      });

      const data = await alephantRequest<Record<string, unknown>>(this, {
        method: 'GET',
        baseUrl: credentials.analyticsBaseUrl,
        path: request.path,
        token: credentials.virtualKey,
        qs: request.qs,
      });

      returnData.push({ json: data });
    }

    return [returnData];
  }
}
```

- [ ] **步骤 4：运行测试**

运行：

```bash
npm test -- usage-node.test.ts
```

预期：通过。

- [ ] **步骤 5：提交 Usage 节点**

```bash
git add nodes/AlephantUsage test/usage-node.test.ts
git commit -m "feat(n8n): add Alephant Usage node"
```

## 任务 6：Alephant Management 节点

**文件：**

- 新建：`nodes/AlephantManagement/AlephantManagement.node.ts`
- 测试：`test/management-node.test.ts`
- [ ] **步骤 1：先写 operation mapping 测试**

创建 `test/management-node.test.ts`：

```ts
import { buildManagementRequest } from '../nodes/AlephantManagement/AlephantManagement.node';

describe('Alephant Management node', () => {
  it('maps virtual key revoke', () => {
    expect(buildManagementRequest('virtualKey', 'revoke', { id: 'vk-id' })).toEqual({
      method: 'POST',
      host: 'saas',
      path: '/api/v1/virtual-keys/vk-id/revoke',
    });
  });

  it('maps workspace usage history', () => {
    expect(buildManagementRequest('workspaceUsage', 'history', { dateFrom: '2026-05-01', dateTo: '2026-05-11' })).toEqual({
      method: 'GET',
      host: 'analytics',
      path: '/api/v1/analytics/usage',
      qs: { dateFrom: '2026-05-01', dateTo: '2026-05-11' },
    });
  });

  it('maps workspace usage history with agent filter', () => {
    expect(buildManagementRequest('workspaceUsage', 'history', {
      dateFrom: '2026-05-01',
      dateTo: '2026-05-11',
      agentId: 'agent-id',
    })).toEqual({
      method: 'GET',
      host: 'analytics',
      path: '/api/v1/analytics/usage',
      qs: { dateFrom: '2026-05-01', dateTo: '2026-05-11', agentId: 'agent-id' },
    });
  });

  it('rejects workspace usage history with multiple scoped filters', () => {
    expect(() => buildManagementRequest('workspaceUsage', 'history', {
      agentId: 'agent-id',
      memberId: 'member-id',
    })).toThrow('Choose only one analytics scope filter');
  });

  it('requires an id for virtual key revoke', () => {
    expect(() => buildManagementRequest('virtualKey', 'revoke', { id: '' })).toThrow(
      'Virtual Key ID is required',
    );
  });

  it('requires a non-empty body for agent create', () => {
    expect(() => buildManagementRequest('agent', 'create', { body: {} })).toThrow(
      'Body must not be empty',
    );
  });

  it('requires a non-empty body for virtual key create', () => {
    expect(() => buildManagementRequest('virtualKey', 'create', { body: {} })).toThrow(
      'Body must not be empty',
    );
  });
});
```

- [ ] **步骤 2：运行测试确认失败**

运行：

```bash
npm test -- management-node.test.ts
```

预期：失败，提示找不到 `AlephantManagement.node`。

- [ ] **步骤 3：实现 management request mapping**

创建 `nodes/AlephantManagement/AlephantManagement.node.ts`，先写 mapper：

```ts
import type {
  IExecuteFunctions,
  IHttpRequestMethods,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType, NodeOperationError } from 'n8n-workflow';
import { ENDPOINTS } from '../../shared/constants';
import { resolveManagerCredentials } from '../../shared/credentials';
import { alephantRequest } from '../../shared/http';
import { parseJsonObjectInput } from '../../shared/json';
import type { AlephantManagerCredentials } from '../../shared/types';

export type ManagementResource = 'agent' | 'virtualKey' | 'models' | 'workspaceUsage';
export type ManagementOperation = 'list' | 'create' | 'revoke' | 'summary' | 'history' | 'costByModel';

export interface ManagementRequest {
  method: IHttpRequestMethods;
  host: 'saas' | 'analytics';
  path: string;
  qs?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export function buildManagementRequest(
  resource: ManagementResource,
  operation: ManagementOperation,
  params: Record<string, unknown>,
): ManagementRequest {
  if (resource === 'agent' && operation === 'list') {
    return { method: 'GET', host: 'saas', path: ENDPOINTS.agents, qs: pick(params, ['page', 'pageSize', 'status', 'departmentId', 'environment', 'search']) };
  }
  if (resource === 'agent' && operation === 'create') {
    requireNonEmptyObject(params.body, 'Body');
    return { method: 'POST', host: 'saas', path: ENDPOINTS.agents, body: params.body as Record<string, unknown> };
  }
  if (resource === 'virtualKey' && operation === 'list') {
    return { method: 'GET', host: 'saas', path: ENDPOINTS.virtualKeys, qs: pick(params, ['page', 'pageSize', 'status', 'entityType']) };
  }
  if (resource === 'virtualKey' && operation === 'create') {
    requireNonEmptyObject(params.body, 'Body');
    return { method: 'POST', host: 'saas', path: ENDPOINTS.virtualKeys, body: params.body as Record<string, unknown> };
  }
  if (resource === 'virtualKey' && operation === 'revoke') {
    requireString(params.id, 'Virtual Key ID');
    return { method: 'POST', host: 'saas', path: `${ENDPOINTS.virtualKeys}/${params.id}/revoke` };
  }
  if (resource === 'models' && operation === 'list') {
    return { method: 'GET', host: 'saas', path: ENDPOINTS.models };
  }
  if (resource === 'workspaceUsage' && operation === 'summary') {
    return { method: 'GET', host: 'analytics', path: ENDPOINTS.analyticsOverview };
  }
  if (resource === 'workspaceUsage' && operation === 'history') {
    validateSingleAnalyticsScope(params);
    return { method: 'GET', host: 'analytics', path: ENDPOINTS.analyticsUsage, qs: pick(params, ['dateFrom', 'dateTo', 'agentId', 'memberId', 'departmentId']) };
  }
  if (resource === 'workspaceUsage' && operation === 'costByModel') {
    return { method: 'GET', host: 'analytics', path: ENDPOINTS.analyticsModels, qs: pick(params, ['dateFrom', 'dateTo']) };
  }
  throw new Error(`Unsupported Alephant Management operation: ${resource}.${operation}`);
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined && source[key] !== '').map((key) => [key, source[key]]));
}

function requireString(value: unknown, fieldName: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${fieldName} is required`);
  }
}

function requireNonEmptyObject(value: unknown, fieldName: string): void {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value as Record<string, unknown>).length === 0
  ) {
    throw new Error(`${fieldName} must not be empty`);
  }
}

function validateSingleAnalyticsScope(params: Record<string, unknown>): void {
  const filters = ['agentId', 'memberId', 'departmentId'].filter((key) => params[key] !== undefined && params[key] !== '');
  if (filters.length > 1) {
    throw new Error('Choose only one analytics scope filter');
  }
}
```

- [ ] **步骤 4：补上 n8n node class**

在同一文件继续追加：

```ts
export class AlephantManagement implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Alephant Management',
    name: 'alephantManagement',
    icon: 'file:alephant.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["resource"]}}',
    description: 'Manage Alephant agents, virtual keys, models, and workspace analytics with PAT credentials',
    defaults: { name: 'Alephant Management' },
    inputs: [NodeConnectionType.Main],
    outputs: [NodeConnectionType.Main],
    credentials: [{ name: 'alephantManagerApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        default: 'agent',
        options: [
          { name: 'Agent', value: 'agent' },
          { name: 'Models', value: 'models' },
          { name: 'Virtual Key', value: 'virtualKey' },
          { name: 'Workspace Usage', value: 'workspaceUsage' },
        ],
      },
      {
        displayName: 'Agent Operation',
        name: 'agentOperation',
        type: 'options',
        noDataExpression: true,
        default: 'list',
        displayOptions: { show: { resource: ['agent'] } },
        options: [
          { name: 'List', value: 'list' },
          { name: 'Create', value: 'create' },
        ],
      },
      {
        displayName: 'Virtual Key Operation',
        name: 'virtualKeyOperation',
        type: 'options',
        noDataExpression: true,
        default: 'list',
        displayOptions: { show: { resource: ['virtualKey'] } },
        options: [
          { name: 'List', value: 'list' },
          { name: 'Create', value: 'create' },
          { name: 'Revoke', value: 'revoke' },
        ],
      },
      {
        displayName: 'Models Operation',
        name: 'modelsOperation',
        type: 'options',
        noDataExpression: true,
        default: 'list',
        displayOptions: { show: { resource: ['models'] } },
        options: [{ name: 'List', value: 'list' }],
      },
      {
        displayName: 'Workspace Usage Operation',
        name: 'workspaceUsageOperation',
        type: 'options',
        noDataExpression: true,
        default: 'summary',
        displayOptions: { show: { resource: ['workspaceUsage'] } },
        options: [
          { name: 'Get Summary', value: 'summary' },
          { name: 'Get History', value: 'history' },
          { name: 'Get Cost By Model', value: 'costByModel' },
        ],
      },
      {
        displayName: 'ID',
        name: 'id',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['revoke'] } },
      },
      {
        displayName: 'Page',
        name: 'page',
        type: 'number',
        default: 1,
        displayOptions: { show: { resource: ['agent', 'virtualKey'] } },
      },
      {
        displayName: 'Page Size',
        name: 'pageSize',
        type: 'number',
        default: 50,
        displayOptions: { show: { resource: ['agent', 'virtualKey'] } },
      },
      {
        displayName: 'Status',
        name: 'status',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent', 'virtualKey'] } },
      },
      {
        displayName: 'Entity Type',
        name: 'entityType',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['virtualKey'], virtualKeyOperation: ['list'] } },
      },
      {
        displayName: 'Agent ID',
        name: 'agentId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history'] } },
      },
      {
        displayName: 'Member ID',
        name: 'memberId',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history'] } },
      },
      {
        displayName: 'Department ID',
        name: 'departmentId',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['agent'],
            agentOperation: ['list'],
          },
        },
      },
      {
        displayName: 'Department ID',
        name: 'usageDepartmentId',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            resource: ['workspaceUsage'],
            workspaceUsageOperation: ['history'],
          },
        },
      },
      {
        displayName: 'Environment',
        name: 'environment',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Search',
        name: 'search',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['agent'], agentOperation: ['list'] } },
      },
      {
        displayName: 'Date From',
        name: 'dateFrom',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history', 'costByModel'] } },
      },
      {
        displayName: 'Date To',
        name: 'dateTo',
        type: 'string',
        default: '',
        displayOptions: { show: { resource: ['workspaceUsage'], workspaceUsageOperation: ['history', 'costByModel'] } },
      },
      {
        displayName: 'Body',
        name: 'agentBody',
        type: 'json',
        default: '{}',
        displayOptions: {
          show: {
            resource: ['agent'],
            agentOperation: ['create'],
          },
        },
      },
      {
        displayName: 'Body',
        name: 'virtualKeyBody',
        type: 'json',
        default: '{}',
        displayOptions: {
          show: {
            resource: ['virtualKey'],
            virtualKeyOperation: ['create'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const credentials = resolveManagerCredentials(
      (await this.getCredentials('alephantManagerApi')) as AlephantManagerCredentials,
    );
    const returnData: INodeExecutionData[] = [];
    const operationParameterByResource: Record<ManagementResource, string> = {
      agent: 'agentOperation',
      virtualKey: 'virtualKeyOperation',
      models: 'modelsOperation',
      workspaceUsage: 'workspaceUsageOperation',
    };

    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      const resource = this.getNodeParameter('resource', itemIndex) as ManagementResource;
      let request: ManagementRequest;

      try {
        request = buildManagementRequest(
          resource,
          this.getNodeParameter(
            operationParameterByResource[resource],
            itemIndex,
          ) as ManagementOperation,
          {
            id: this.getNodeParameter('id', itemIndex, ''),
            page: this.getNodeParameter('page', itemIndex, 1),
            pageSize: this.getNodeParameter('pageSize', itemIndex, 50),
            status: this.getNodeParameter('status', itemIndex, ''),
            entityType: this.getNodeParameter('entityType', itemIndex, ''),
            agentId: this.getNodeParameter('agentId', itemIndex, ''),
            memberId: this.getNodeParameter('memberId', itemIndex, ''),
            departmentId:
              resource === 'workspaceUsage'
                ? this.getNodeParameter('usageDepartmentId', itemIndex, '')
                : this.getNodeParameter('departmentId', itemIndex, ''),
            environment: this.getNodeParameter('environment', itemIndex, ''),
            search: this.getNodeParameter('search', itemIndex, ''),
            dateFrom: this.getNodeParameter('dateFrom', itemIndex, ''),
            dateTo: this.getNodeParameter('dateTo', itemIndex, ''),
            body:
              resource === 'virtualKey'
                ? parseJsonObjectInput(this.getNodeParameter('virtualKeyBody', itemIndex, {}), 'Body')
                : parseJsonObjectInput(this.getNodeParameter('agentBody', itemIndex, {}), 'Body'),
          },
        );
      } catch (error) {
        throw new NodeOperationError(
          this.getNode(),
          error instanceof Error ? error.message : 'Invalid Alephant Management input',
          { itemIndex },
        );
      }

      const data = await alephantRequest<Record<string, unknown>>(this, {
        method: request.method,
        baseUrl: request.host === 'analytics' ? credentials.analyticsBaseUrl : credentials.saasBaseUrl,
        path: request.path,
        token: credentials.pat,
        workspaceId: credentials.workspaceId,
        qs: request.qs,
        body: request.body,
      });

      returnData.push({ json: data });
    }

    return [returnData];
  }
}
```

- [ ] **步骤 5：运行测试**

运行：

```bash
npm test -- management-node.test.ts
```

预期：通过。

- [ ] **步骤 6：提交 Management 节点**

```bash
git add nodes/AlephantManagement test/management-node.test.ts
git commit -m "feat(n8n): add Alephant Management node"
```

## 任务 7：节点包验证

**文件：**

- 只有验证发现编译错误时，才修改前面任务创建的文件。
- [ ] **步骤 1：运行完整测试**

运行：

```bash
npm test
```

预期：全部通过。

- [ ] **步骤 2：运行 lint**

运行：

```bash
npm run lint
```

预期：通过。如果 ESLint 报类型导入、行宽或格式问题，只修对应文件并重跑。

- [ ] **步骤 3：运行构建**

运行：

```bash
npm run build
```

预期：通过，`dist/` 中生成 `credentials/`、`nodes/`、`shared/` 的 JS 和 d.ts。

- [ ] **步骤 4：检查 n8n package metadata**

运行：

```bash
node -e "const p=require('./package.json'); console.log(p.n8n.nodes.length, p.n8n.credentials.length)"
node -e "const fs=require('fs'); const p=require('./package.json'); for (const f of [...p.n8n.nodes, ...p.n8n.credentials]) { if (!fs.existsSync(f)) throw new Error('Missing n8n entry: ' + f); }"
```

预期第一条命令输出：

```text
3 2
```

预期第二条命令无输出并以 0 退出。

- [ ] **步骤 5：提交验证修复**

如果验证过程中有文件变更：

```bash
git add package.json package-lock.json tsconfig.json jest.config.js .eslintrc.js credentials nodes shared test
git commit -m "test(n8n): verify Alephant node package"
```

如果没有文件变更，不创建空提交。

## 后续外部计划

以下内容不在本 n8n 独立仓库计划中执行，避免跨仓库改动：

- 后端：已核对 `backend-saas-service` 当前 PAT analytics handler / OpenAPI，`/api/v1/analytics/usage` 支持 `agentId`、`memberId`、`departmentId`，`/api/v1/analytics/models` 仅支持日期范围；暂未暴露 `virtualKeyId` filter，也没有 `/api/v1/virtual-keys/{id}/analytics/*` 路由。若第一版必须让 PAT 查询任意 VK 的 summary / history / models，另写后端计划新增 `GET /api/v1/virtual-keys/{id}/analytics/summary|history|models` 或在现有 analytics API 增加 `virtualKeyId` filter。
- 前端：`Alephantinterface` 已有 PAT 创建 / reveal 入口，也已有 Agent / Member / Virtual Key 创建、reveal、rotate 等入口；不需要为了 n8n 新增 VK 或 PAT 创建入口。若后续要提高易用性，只另写 `Alephantinterface` 计划增加 n8n 配置片段 / 复制指引入口，并在 `Alephantinterface` 仓库上下文中执行和提交。

## API Reference 核对记录

本计划已结合 `https://developers.alephant.io/api-reference` 当前公开 API catalog 核对：

- SaaS 后端 host 是 `https://alephant.io`，本计划使用的 Management 路由包括：`GET|POST /api/v1/agents`、`GET|POST /api/v1/virtual-keys`、`POST /api/v1/virtual-keys/{id}/revoke`、`GET /api/v1/models`。
- 统计分析 host 是 `https://analytics.alephant.io`，本计划使用的 Usage / workspace analytics 路由包括：`GET /api/v1/cockpit/scope|budget-status|usage-summary|daily-costs|cost-by-model|recent-requests` 和 `GET /api/v1/analytics/overview|usage|models`。
- Analytics usage 的 `GET /api/v1/analytics/usage` 只支持 `agentId`、`memberId`、`departmentId` 三种 scoped filter，且一次最多使用一个；未暴露 `virtualKeyId` filter。
- API Reference 未暴露 `/api/v1/virtual-keys/{id}/analytics/summary|history|models`。因此 Alephant Management v1 不实现 PAT 任意 VK analytics，避免生成不可用操作。
- AI Gateway host 是 `https://ai.alephant.io/v1`，OpenAI-compatible endpoint path 是 `POST /chat/completions`；执行前必须用当前生产 Gateway base URL 做 smoke test，确认 `Authorization: Bearer <virtual-key>` + OpenAI-compatible body 可用。
- 生产 API host 需要在发布前最终确认：公开 API Reference 位于 `developers.alephant.io/api-reference`；当前 host 分别是 AI Gateway `https://ai.alephant.io/v1`、SaaS 后端 `https://alephant.io`、统计分析 `https://analytics.alephant.io`。现有 MCP 文档示例曾使用 `https://api.alephant.ai`。本 package 保持 base URL 可选配置；发布默认值必须以产品当前生产域名为准。

## 任务 8：本地 n8n 运行 smoke test

**文件：**

- 只有 smoke test 发现 package 或 runtime 缺陷时才修改。
- [ ] **步骤 1：构建 package**

从 `n8n/` 运行：

```bash
npm run build
```

预期：通过。

- [ ] **步骤 2：启动 n8n node dev preview**

运行：

```bash
npm run dev
```

预期：n8n 本地 dev 启动，并输出 localhost URL。

- [ ] **步骤 3：核对生产 base URL 默认值**

发布前必须确认 `DEFAULT_GATEWAY_BASE_URL`、`DEFAULT_SAAS_BASE_URL` 和 `DEFAULT_ANALYTICS_BASE_URL` 与当前产品生产域名一致。当前默认值应分别为 `https://ai.alephant.io/v1`、`https://alephant.io` 和 `https://analytics.alephant.io`；如产品域名再变化，先更新 `shared/constants.ts`、credential 默认值测试和 README，再继续 smoke test。

- [ ] **步骤 4：验证节点出现**

打开 `npm run dev` 输出的 localhost URL，创建 workflow，搜索：

```text
Alephant AI
Alephant Usage
Alephant Management
```

预期：三个节点都能搜索到，credentials 能看到：

```text
Alephant Virtual Key
Alephant Manager
```

- [ ] **步骤 5：验证 base URL 可选**

创建 `Alephant Virtual Key` credential，只填写：

```text
Virtual Key = vk-test
```

预期：保存成功，不要求填写 `gatewayBaseUrl` 或 `analyticsBaseUrl`。

创建 `Alephant Manager` credential，只填写：

```text
Personal Access Token = pat_test
Workspace ID = 00000000-0000-0000-0000-000000000000
```

预期：保存成功，不要求填写 `saasBaseUrl` 或 `analyticsBaseUrl`。

- [ ] **步骤 6：提交 runtime 修复**

如果 smoke test 期间有文件修改：

```bash
git add package.json package-lock.json credentials nodes shared test
git commit -m "fix(n8n): resolve local runtime issues"
```

如果没有文件变更，不创建空提交。

## 任务 9：文档

**文件：**

- 新建：`README.md`
- 新建：`docs/connect-alephant-ai-to-n8n.md`
- 新建：`docs/check-alephant-virtual-key-usage-in-n8n.md`
- 新建：`docs/automate-alephant-management-in-n8n.md`
- [ ] **步骤 1：写 README**

创建 `README.md`：

````markdown
# @alephantai/n8n-nodes-alephant

n8n community nodes for Alephant BYO-KEY.

## Nodes

- Alephant AI: call Alephant AI Gateway with a Virtual Key.
- Alephant Usage: inspect usage and budget for the current Virtual Key.
- Alephant Management: manage Agents, Virtual Keys, models, and workspace analytics with PAT + workspaceId.

## Credentials

### Alephant Virtual Key

Required:

- Virtual Key

Optional:

- Gateway Base URL
- Analytics Base URL

Leave base URLs empty for production defaults. Override them for staging, local, or self-hosted testing.

### Alephant Manager

Required:

- Personal Access Token
- Workspace ID

Optional:

- SaaS Base URL
- Analytics Base URL

PAT scopes:

- Read scope: list, models, and workspace analytics operations.
- Write scope: create, revoke, rotate, or update operations.

## Development

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

````

- [ ] **步骤 2：写三份使用文档**

创建 `docs/connect-alephant-ai-to-n8n.md`：

```markdown
# Connect Alephant AI to n8n

1. Install `@alephantai/n8n-nodes-alephant`.
2. Create an `Alephant Virtual Key` credential.
3. Fill `Virtual Key`.
4. Leave base URLs empty for production.
5. Add the `Alephant AI` node.
6. Choose `Chat Completion`.
7. Set `model` and `prompt` or `messages`.
8. Execute the workflow.
```

创建 `docs/check-alephant-virtual-key-usage-in-n8n.md`：

```markdown
# Check Alephant Virtual Key Usage in n8n

1. Create an `Alephant Virtual Key` credential.
2. Add the `Alephant Usage` node.
3. Choose one operation: `Get My Budget Status`, `Get My Usage Summary`, `Get My Daily Costs`, `Get My Cost By Model`, or `Get My Recent Requests`.
4. Choose a period when the operation supports it.
5. Execute the workflow.

`Get My Recent Requests` may return a degraded empty list until scoped request logs are wired in the backend.
```

创建 `docs/automate-alephant-management-in-n8n.md`：

```markdown
# Automate Alephant Management in n8n

1. Create an `Alephant Manager` credential.
2. Fill `Personal Access Token` and `Workspace ID`.
3. Leave `SaaS Base URL` and `Analytics Base URL` empty for production.
4. Add the `Alephant Management` node.
5. Choose a resource: `Agent`, `Virtual Key`, `Models`, or `Workspace Usage`.
6. Choose an operation and execute.

Use this credential only for trusted administrator workflows.
Use a read-scope PAT for list and analytics workflows. Use a write-scope PAT only for workflows that create, revoke, rotate, or update resources.
```

- [ ] **步骤 3：提交文档**

```bash
git add README.md docs/connect-alephant-ai-to-n8n.md docs/check-alephant-virtual-key-usage-in-n8n.md docs/automate-alephant-management-in-n8n.md
git commit -m "docs(n8n): add Alephant node usage guides"
```

## 最终验证

- [ ] **步骤 1：运行 package 检查**

从 `n8n/` 运行：

```bash
npm test
npm run lint
npm run build
```

预期：全部通过。

- [ ] **步骤 2：检查 git 状态**

运行：

```bash
git status --short
```

预期：没有未提交的 n8n package 变更。若看到父仓库路径或 sibling 项目改动，说明当前不在 n8n 独立仓库上下文，应停止并切回 `/Users/allin/WE/AlephantAI-main/n8n`。

- [ ] **步骤 3：准备发布决策**

如果全部检查通过，再决定内部发布、npm 发布或开 PR。确认 package name ownership 和 n8n community node 要求之前，不发布到 npm。

## 自检记录

- 设计覆盖：本计划覆盖三个 n8n 节点、两个 credentials、base URL 可选行为、本地 n8n smoke test 和文档。
- 已知依赖：PAT 任意 VK 维度 analytics 当前不在 `backend-saas-service` 已暴露契约内；该事项已移入后续后端计划，不在本 n8n 仓库主流程中执行。当前 VK 自查额度 / 用量 / 成本由 `Alephant Usage` 节点通过 Virtual Key credential 调 cockpit API 完成。
- 已知限制：`/api/v1/cockpit/recent-requests` 当前后端实现会返回 `degraded=true` 的空列表，直到 scoped request logs 后端接入；Usage 节点可以保留该 operation，但文档和测试不应承诺一定返回真实请求明细。
- 外部配套：`Alephantinterface` 已有 VK / PAT 创建和 reveal 入口；前端 n8n 配置片段入口属于后续易用性增强，不在本 n8n 仓库主流程中执行。
- 明确非目标：Trigger Node、Streaming、Responses API、Embeddings、Billing、Member / Department / Master Key 管理、Policy 配置、PAT 管理和 OAuth。
