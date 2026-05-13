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
