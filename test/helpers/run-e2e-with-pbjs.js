'use strict';

/**
 * Official e2e pages/specs use `pbjs`. Adpushup site builds use package.json `_apPbJs`.
 * Temporarily point package.json at `pbjs` for this gulp e2e run only, then restore.
 * This file is Adpushup-owned; do not patch gulp/webpack for upgrades.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const pkgPath = path.join(__dirname, '..', '..', 'package.json');
const originalText = fs.readFileSync(pkgPath, 'utf8');
const e2eText = originalText.replace(/"globalVarName"\s*:\s*"_apPbJs"/, '"globalVarName": "pbjs"');

if (e2eText === originalText) {
  throw new Error('package.json globalVarName is not _apPbJs; refusing to rewrite for e2e');
}

fs.writeFileSync(pkgPath, e2eText);

let result;
try {
  result = spawnSync('npx', ['gulp', 'e2e-test', '--local', ...process.argv.slice(2)], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', '..'),
    shell: process.platform === 'win32'
  });
} finally {
  fs.writeFileSync(pkgPath, originalText);
}

process.exit(result && result.status != null ? result.status : 1);
