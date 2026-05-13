# Automate Alephant Management in n8n

1. Create an `Alephant Manager` credential.
2. Fill `Personal Access Token` and `Workspace ID`.
3. Leave `SaaS Base URL` and `Analytics Base URL` empty for production.
4. Add the `Alephant Management` node.
5. Choose a resource: `Agent`, `Virtual Key`, `Models`, or `Workspace Usage`.
6. Choose an operation and execute.

Use this credential only for trusted administrator workflows.
Use a read-scope PAT for list and analytics workflows. Use a write-scope PAT only for workflows that create or revoke resources.
