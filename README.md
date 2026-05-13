# @alephantai/n8n-nodes-alephant

n8n community nodes for Alephant BYO-KEY.

## Nodes

### Alephant AI

Run Alephant gateway AI requests from n8n workflows. Use this node for chat completion workflows with a virtual key.

### Alephant Usage

Check virtual key budget status, usage summaries, daily costs, cost by model, and recent requests.

### Alephant Management

Automate Alephant workspace administration. Supported operations include:

- Agent list and create
- Virtual key list, create, and revoke
- Model list
- Workspace analytics summary, history, and cost by model

## Credentials

### Alephant Virtual Key

Required fields:

- `Virtual Key`

Optional fields:

- `Gateway Base URL`

Leave `Gateway Base URL` empty for production. The production default is `https://ai.alephant.io/v1`.

### Alephant Manager

Required fields:

- `Personal Access Token`
- `Workspace ID`

Optional fields:

- `SaaS Base URL`
- `Analytics Base URL`

Leave base URL fields empty for production. The production defaults are:

- SaaS: `https://alephant.io`
- Analytics: `https://analytics.alephant.io`

Use a PAT with read scope for list, models, and analytics workflows. Use a PAT with write scope only for create and revoke operations.

## Production Base URL Overrides

Base URL fields are optional and should usually be left empty. Set them only when you need to target a non-production Alephant environment or a dedicated deployment.

Production defaults:

- Gateway: `https://ai.alephant.io/v1`
- SaaS: `https://alephant.io`
- Analytics: `https://analytics.alephant.io`

## Development

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```
