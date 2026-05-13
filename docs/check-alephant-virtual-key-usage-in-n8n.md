# Check Alephant Virtual Key Usage in n8n

1. Create an `Alephant Virtual Key` credential.
2. Add the `Alephant Usage` node.
3. Choose one operation: `Get My Budget Status`, `Get My Usage Summary`, `Get My Daily Costs`, `Get My Cost By Model`, or `Get My Recent Requests`.
4. Choose a period when the operation supports it.
5. Execute the workflow.

`Get My Recent Requests` may return a degraded empty list until scoped request logs are wired in the backend.
