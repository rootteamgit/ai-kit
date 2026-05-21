#!/usr/bin/env node

import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { getFlag, readFileOr, readFile } from './lib.mjs'

const DEFAULT_FILE = '.claude/knowledge.jsonl'
const args = process.argv.slice(2)

const commands = {
  add: cmdAdd,
  read: cmdRead,
  delete: cmdDelete,
  dedupe: cmdDedupe,
  'refs-check': cmdRefsCheck,
  'refs-update': cmdRefsUpdate,
  reset: cmdReset,
}

const usages = {
  read: "node .claude/tools/knowledge.mjs read [-tags 'tag1,tag2'] [-refs 'path1,path2'] [-limit N]",
  add: "node .claude/tools/knowledge.mjs add -key 'KEY' -insight 'TEXT' -source 'user-stated|observed|inferred' -tags 'tag1,tag2' [-refs 'path1,path2']",
  delete: "node .claude/tools/knowledge.mjs delete -key 'KEY'",
  dedupe: 'node .claude/tools/knowledge.mjs dedupe',
  'refs-check': 'node .claude/tools/knowledge.mjs refs-check',
  'refs-update': "node .claude/tools/knowledge.mjs refs-update -key 'KEY' -refs 'path1,path2'",
  reset: "node .claude/tools/knowledge.mjs reset -key 'KEY' -insight 'TEXT' -source 'user-stated|observed|inferred' -tags 'tag1,tag2' [-refs 'path1,path2']",
}

// --help / -h 対応 (サブコマンド前後のどちらでも)
if (args.includes('--help') || args.includes('-h')) {
  const cmdArg = args.find((a) => commands[a])
  printUsage(cmdArg)
  process.exit(0)
}

if (args[0] && !commands[args[0]] && !args[0].startsWith('-')) {
  console.error(`Unknown command: ${args[0]}`)
  printUsage()
  process.exit(1)
}

if (args[0]?.startsWith('-') && !['-tags', '-refs', '-limit'].includes(args[0])) {
  console.error(`Unknown option: ${args[0]}`)
  printUsage('read')
  process.exit(1)
}

const command = commands[args[0]] ? args[0] : 'read'
const handler = commands[command]
const commandArgs = command === 'read' && args[0] !== 'read' ? args : args.slice(1)

handler(commandArgs, command)

// --- コマンド実装 ---

function cmdAdd(args, cmd) {
  assertOnlyFlags(args, ['-key', '-insight', '-source', '-tags', '-refs'], cmd)
  const entry = buildEntryFromArgs(args, cmd)
  appendEntry(DEFAULT_FILE, entry)
  process.stdout.write(`Added: ${entry.key}\n`)
}

function cmdRead(args, cmd) {
  assertOnlyFlags(args, ['-tags', '-refs', '-limit'], cmd)
  const filePath = DEFAULT_FILE

  const content = readFileOr(filePath)
  if (!content.trim()) {
    process.stdout.write(`No entries: ${filePath}\n`)
    process.exit(0)
  }

  const refsRaw = getFlag(args, '-refs')
  const filterRefs = refsRaw ? new Set(refsRaw.split(',').map((r) => r.trim())) : null

  const tagsRaw = getFlag(args, '-tags')
  const filterTags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()) : null

  const limitRaw = getFlag(args, '-limit')
  const limit = limitRaw != null ? Number(limitRaw) : 30
  if (limitRaw != null && (!Number.isInteger(limit) || limit < 0)) {
    console.error('-limit must be a non-negative integer (0 for unlimited)')
    process.exit(1)
  }

  const sourcePriority = { 'user-stated': 0, observed: 1, inferred: 2 }

  const sourceDateSort = (a, b) => {
    const sp = (sourcePriority[a.source] ?? 9) - (sourcePriority[b.source] ?? 9)
    if (sp !== 0) return sp
    return b.date.localeCompare(a.date)
  }

  const lines = content
    .trim()
    .split('\n')
    .filter((l) => l.trim())
  const exact = []
  const partial = []
  const unfiltered = []

  for (const line of lines) {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (filterRefs && (!entry.refs || !entry.refs.some((r) => filterRefs.has(r)))) continue

    if (filterTags) {
      const entryTags = entry.tags || []
      const hasExact = filterTags.some((ft) => entryTags.includes(ft))
      const hasPartial =
        !hasExact &&
        filterTags.some((ft) => entryTags.some((et) => et.includes(ft) || ft.includes(et)))
      if (hasExact) exact.push(entry)
      else if (hasPartial) partial.push(entry)
    } else {
      unfiltered.push(entry)
    }
  }

  exact.sort(sourceDateSort)
  partial.sort(sourceDateSort)
  unfiltered.sort(sourceDateSort)

  const matched = filterTags ? [...exact, ...partial] : unfiltered

  const shown = limit > 0 ? matched.slice(0, limit) : matched
  for (const entry of shown) {
    const tags = entry.tags ? ` [${entry.tags.join(', ')}]` : ''
    const refs = entry.refs ? ` (refs: ${entry.refs.join(', ')})` : ''
    process.stdout.write(
      `[${entry.key}]${tags} ${entry.insight} — ${entry.source}, ${entry.date}${refs}\n`,
    )
  }

  const remaining = matched.length - shown.length
  if (remaining > 0) {
    process.stderr.write(`(他 ${remaining} 件)\n`)
  }
}

function cmdDelete(args, cmd) {
  assertOnlyFlags(args, ['-key'], cmd)
  const key = getFlag(args, '-key')
  if (!key) {
    console.error('-key is required')
    printUsage(cmd)
    process.exit(1)
  }
  const result = deleteByKey(DEFAULT_FILE, key)
  if (!result.deleted) {
    console.error(`Key not found: "${key}". Use 'read' to see existing keys.`)
    process.exit(1)
  }
  process.stdout.write(`Deleted: ${key}\n`)
}

function cmdDedupe(args, cmd) {
  assertOnlyFlags(args, [], cmd)
  const filePath = DEFAULT_FILE

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const content = readFile(filePath)
  const lines = content
    .trim()
    .split('\n')
    .filter((l) => l.trim())

  // key ごとに「残す行の index」を決める。date が新しい方を採用、同じなら後勝ち
  const parsed = lines.map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return null
    }
  })

  const keepIndex = new Map() // key -> index
  parsed.forEach((entry, index) => {
    if (!entry || !entry.key) return
    const prev = keepIndex.get(entry.key)
    if (prev === undefined) {
      keepIndex.set(entry.key, index)
      return
    }
    const prevEntry = parsed[prev]
    const prevDate = prevEntry.date ?? ''
    const curDate = entry.date ?? ''
    if (curDate >= prevDate) {
      keepIndex.set(entry.key, index)
    }
  })

  const keepSet = new Set(keepIndex.values())
  const kept = []
  const removed = []
  lines.forEach((line, index) => {
    const entry = parsed[index]
    if (!entry) {
      // JSON でない行は保全
      kept.push(line)
      return
    }
    if (keepSet.has(index)) {
      kept.push(line)
    } else {
      removed.push(`  - ${entry.key} (${entry.date ?? 'no-date'})`)
    }
  })

  writeFileSync(filePath, kept.length > 0 ? kept.join('\n') + '\n' : '')
  process.stdout.write(`Removed ${removed.length} duplicate entries\n`)
  for (const r of removed) process.stdout.write(r + '\n')
}

/**
 * 各 entry の refs に存在しない path が含まれているかを検証
 * 出力は `[key]\t<missing-ref>` 形式、 1 missing ref ごとに 1 行 (内容/insight は出さない)
 */
function cmdRefsCheck(args, cmd) {
  assertOnlyFlags(args, [], cmd)
  const filePath = DEFAULT_FILE

  const content = readFileOr(filePath)
  if (!content.trim()) {
    process.stdout.write(`No entries: ${filePath}\n`)
    process.exit(0)
  }

  const lines = content.trim().split('\n').filter((l) => l.trim())
  let missingCount = 0
  for (const line of lines) {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (!entry.refs) continue
    for (const ref of entry.refs) {
      if (!existsSync(ref)) {
        process.stdout.write(`[${entry.key}]\t${ref}\n`)
        missingCount += 1
      }
    }
  }
  if (missingCount === 0) {
    process.stdout.write('No missing refs\n')
  }
}

/**
 * 指定 key の entry の refs を全置換 (insight / tags / source / date 等は維持)
 * 行位置はその場 (= 末尾移動なし、 reset と異なる)
 */
function cmdRefsUpdate(args, cmd) {
  assertOnlyFlags(args, ['-key', '-refs'], cmd)
  const filePath = DEFAULT_FILE

  const key = getFlag(args, '-key')
  const refsRaw = getFlag(args, '-refs')
  if (!key || refsRaw == null) {
    console.error('-key and -refs are required')
    printUsage(cmd)
    process.exit(1)
  }

  const refs = parseAndValidateRefs(refsRaw)
  if (refs.length === 0) {
    console.error('-refs must not be empty (refs を空にしたい場合は reset コマンドを使う)')
    process.exit(1)
  }

  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }

  const content = readFile(filePath)
  const lines = content.trim().split('\n').filter((l) => l.trim())
  let updated = false
  const newLines = lines.map((line) => {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      return line
    }
    if (entry.key !== key) return line
    entry.refs = refs
    updated = true
    return JSON.stringify(entry)
  })
  if (!updated) {
    console.error(`Key not found: "${key}". Use 'read' to see existing keys.`)
    process.exit(1)
  }
  writeFileSync(filePath, newLines.join('\n') + '\n')
  process.stdout.write(`Updated refs: ${key}\n`)
}

/**
 * 指定 key の entry を delete + add で完全リセット (insight / tags / refs / source 全て新規)
 * 内部動作も削除→追記 = 末尾に来る、 既存 refs / insight / tags / source は全消去 (= update ではない)
 * 既存 entry が不在でも error にせず、 単に追記する
 */
function cmdReset(args, cmd) {
  assertOnlyFlags(args, ['-key', '-insight', '-source', '-tags', '-refs'], cmd)
  const entry = buildEntryFromArgs(args, cmd)
  // 既存 key を silent に削除 (不在でもOK)、 その後末尾に append
  deleteByKey(DEFAULT_FILE, entry.key)
  appendEntry(DEFAULT_FILE, entry)
  process.stdout.write(`Reset: ${entry.key}\n`)
}

// --- 内部 helper ---

/**
 * cmdAdd / cmdReset 共通の引数 parse + validation
 * 戻り値: { key, insight, source, tags, date, refs? } の entry オブジェクト
 */
function buildEntryFromArgs(args, cmd) {
  const key = getFlag(args, '-key')
  const insightRaw = getFlag(args, '-insight')
  const insight = insightRaw ? insightRaw.replace(/\n/g, ' ') : null
  const source = getFlag(args, '-source')
  const tagsRaw = getFlag(args, '-tags')

  if (!key || !insight || !source || !tagsRaw) {
    console.error('-key, -insight, -source, -tags are required')
    printUsage(cmd)
    process.exit(1)
  }

  const validSources = ['user-stated', 'observed', 'inferred']
  if (!validSources.includes(source)) {
    console.error(`Invalid source: "${source}". Must be one of: ${validSources.join(', ')}`)
    process.exit(1)
  }

  const tags = tagsRaw.split(',').map((t) => t.trim())
  const invalidTags = tags.filter((t) => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t))
  if (invalidTags.length > 0) {
    console.error(`Invalid tags (must be kebab-case): ${invalidTags.join(', ')}`)
    process.exit(1)
  }

  const refsRaw = getFlag(args, '-refs')
  const refs = refsRaw != null ? parseAndValidateRefs(refsRaw) : undefined

  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const entry = { key, insight, source, tags, date }
  if (refs && refs.length > 0) entry.refs = refs
  return entry
}

/**
 * refs string を array に分解、 .claude 配下チェック + 存在チェックを実施
 * 不正なら process.exit、 OK なら array を返す
 */
function parseAndValidateRefs(refsRaw) {
  const refs = refsRaw
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)

  if (refs.length === 0) return refs

  const disallowed = refs.filter((r) => r === '.claude' || r.startsWith('.claude/'))
  if (disallowed.length > 0) {
    console.error(`-refs に .claude/ 配下のパスは使えません: ${disallowed.join(', ')}`)
    console.error(
      'refs は knowledge が対象とするコード・スキーマ・設定ファイルを指す（読み手が「どのコード/スキーマに現れる判断か」を辿るため）',
    )
    console.error(
      '.claude/ 内のファイルは運用物（rules/skills/knowledge 自体）で knowledge の対象ではない',
    )
    process.exit(1)
  }
  const missing = refs.filter((r) => !existsSync(r))
  if (missing.length > 0) {
    console.error(`File not found (cwd 起点の相対パスで指定): ${missing.join(', ')}`)
    process.exit(1)
  }
  return refs
}

function appendEntry(filePath, entry) {
  mkdirSync(dirname(filePath), { recursive: true })
  appendFileSync(filePath, JSON.stringify(entry) + '\n')
}

/**
 * 指定 key の entry を削除。 戻り値 { deleted: boolean }
 * file 不在 / 該当 key 不在は silent (= 呼び出し側が必要なら error にする)
 */
function deleteByKey(filePath, key) {
  if (!existsSync(filePath)) return { deleted: false }

  const content = readFile(filePath)
  const lines = content.trim().split('\n').filter((l) => l.trim())
  const filtered = lines.filter((line) => {
    let entry
    try {
      entry = JSON.parse(line)
    } catch {
      return true
    }
    return entry.key !== key
  })

  if (filtered.length === lines.length) return { deleted: false }

  writeFileSync(filePath, filtered.length > 0 ? filtered.join('\n') + '\n' : '')
  return { deleted: true }
}

function printUsage(commandName) {
  if (commandName && usages[commandName]) {
    console.error(`Usage: ${usages[commandName]}`)
  } else {
    console.error('Usage:')
    for (const u of Object.values(usages)) console.error(`  ${u}`)
    console.error(`Default file: ${DEFAULT_FILE}`)
  }
  console.error('Note: 引用符は単引用符（"..." だと bash が $0 / $VAR を展開する）')
}

function assertOnlyFlags(args, allowedFlags, cmd) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (!arg.startsWith('-')) {
      console.error(`Unexpected argument: ${arg}`)
      printUsage(cmd)
      process.exit(1)
    }
    if (!allowedFlags.includes(arg)) {
      console.error(`Unknown option: ${arg}`)
      printUsage(cmd)
      process.exit(1)
    }
    if (i + 1 >= args.length) {
      console.error(`Missing value for ${arg}`)
      printUsage(cmd)
      process.exit(1)
    }
    i += 1
  }
}
