#!/usr/bin/env node
// Bash ツール呼び出し時に禁止パターンを検出するフック

import { spawnSync } from 'node:child_process';

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const input = JSON.parse(await readStdin());
const command = input?.tool_input?.command ?? '';


// git commit 時にステージング対象をシークレット検査
if (/(^|;|&&|\|)\s*git\s+commit\b/.test(command)) {
  const gitResult = spawnSync(
    'git',
    ['diff', '--cached', '--name-only', '--diff-filter=ACM'],
    { encoding: 'utf8', shell: process.platform === 'win32' },
  );
  const staged = (gitResult.stdout ?? '').trim();
  if (staged) {
    const files = staged.split('\n');
    const result = spawnSync(
      'npx',
      ['-y', '@secretlint/quick-start', ...files],
      { encoding: 'utf8', shell: process.platform === 'win32' },
    );
    if (result.status !== 0) {
      const output = (result.stdout ?? '') + (result.stderr ?? '');
      deny(`secretlint がシークレットを検出しました:\n\n${output}\n\nこれが誤検出だと思う場合は user に確認してください`);
    }
  }
}

process.exit(0);
