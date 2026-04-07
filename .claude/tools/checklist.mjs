#!/usr/bin/env node

import { appendFileSync, writeFileSync } from 'node:fs'
import {
  blankLinePrefix,
  getFlag,
  readFile,
  readFileOr,
  resolveDate,
} from './lib.mjs'

// --- エントリポイント ---

const args = process.argv.slice(2)
const command = args[0]
const filePath = args[1]

if (!command || !filePath) {
  console.error('Usage:')
  console.error('  checklist add <file> -title "TITLE" [-body "TEXT"]')
  console.error('  checklist read <file>')
  console.error('  checklist check <file> <number>')
  process.exit(1)
}

const commands = { add: cmdAdd, read: cmdRead, check: cmdCheck }
const handler = commands[command]

if (!handler) {
  console.error(`Unknown command: ${command}`)
  process.exit(1)
}

handler(filePath, command === 'check' ? args[2] : args)

// --- コマンド実装 ---

function cmdAdd(filePath, args) {
  const title = getFlag(args, '-title')
  if (!title) {
    console.error('-title is required')
    process.exit(1)
  }

  const existing = readFileOr(filePath)
  const num = getMaxNum(existing) + 1
  const body = getFlag(args, '-body')

  let entry = `# [ ] ${num}. ${resolveDate(title)}`
  if (body) entry += `\n${resolveDate(body)}`

  appendFileSync(filePath, blankLinePrefix(existing) + entry + '\n')
}

function cmdRead(filePath) {
  const lines = readFile(filePath).split('\n')
  const result = []
  let inUnchecked = false

  for (const line of lines) {
    if (/^# \[ \] \d+\./.test(line)) {
      inUnchecked = true
      result.push(line)
    } else if (/^# \[x\] \d+\./.test(line) || /^# /.test(line)) {
      inUnchecked = false
    } else if (inUnchecked) {
      result.push(line)
    }
  }

  const output = result.join('\n').trim()
  if (output) process.stdout.write(output + '\n')
}

function cmdCheck(filePath, num) {
  if (!num) {
    console.error('Usage: checklist check <file> <number>')
    process.exit(1)
  }

  const content = readFile(filePath)
  const updated = content.replace(
    new RegExp(`^# \\[ \\] ${num}\\.`, 'm'),
    `# [x] ${num}.`
  )

  if (updated === content) {
    const isChecked = new RegExp(`^# \\[x\\] ${num}\\.`, 'm').test(content)
    console.error(
      isChecked ? `Item ${num} is already checked` : `Item ${num} not found`
    )
    process.exit(1)
  }

  writeFileSync(filePath, updated)
}

// --- ユーティリティ関数 ---

// ファイルから最大番号を取得
function getMaxNum(content) {
  let max = 0
  for (const m of content.matchAll(/^# \[[ x]\] (\d+)\./gm)) {
    const n = Number(m[1])
    if (n > max) max = n
  }
  return max
}
