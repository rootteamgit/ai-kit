#!/usr/bin/env node

import { appendFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { getFlag, readFileOr, readFile } from './lib.mjs'

const args = process.argv.slice(2)
const command = args[0]

if (!command) {
  console.error('Usage:')
  console.error('  knowledge add <file> -key "KEY" -insight "TEXT" -source "SOURCE" -tags "tag1,tag2" [-refs "path1,path2"]')
  console.error('  knowledge read <file> [-tags "tag1,tag2"] [-refs "path1,path2"] [-limit N]')
  console.error('  knowledge delete <file> -key "KEY"')
  process.exit(1)
}

const commands = { add: cmdAdd, read: cmdRead, delete: cmdDelete }
const handler = commands[command]

if (!handler) {
  console.error(`Unknown command: ${command}`)
  process.exit(1)
}

handler(args.slice(1))

// --- コマンド実装 ---

function cmdAdd(args) {
  const filePath = args[0]
  if (!filePath) {
    console.error('Usage: knowledge add <file> -key "KEY" -insight "TEXT" -source "SOURCE"')
    process.exit(1)
  }

  const key = getFlag(args, '-key')
  const insight = getFlag(args, '-insight')
  const source = getFlag(args, '-source')

  if (!key || !insight || !source) {
    console.error('-key, -insight, -source are required')
    process.exit(1)
  }

  const validSources = ['user-stated', 'observed', 'inferred']
  if (!validSources.includes(source)) {
    console.error(`Invalid source: "${source}". Must be one of: ${validSources.join(', ')}`)
    process.exit(1)
  }

  // tags の取得（必須、カンマ区切り、kebab-case）
  const tagsRaw = getFlag(args, '-tags')
  if (!tagsRaw) {
    console.error('-tags is required (comma-separated, kebab-case)')
    process.exit(1)
  }
  const tags = tagsRaw.split(',').map(t => t.trim())
  const invalidTags = tags.filter(t => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t))
  if (invalidTags.length > 0) {
    console.error(`Invalid tags (must be kebab-case): ${invalidTags.join(', ')}`)
    process.exit(1)
  }

  // refs の取得（オプション）と存在確認
  const refsRaw = getFlag(args, '-refs')
  const refs = refsRaw ? refsRaw.split(',').map(r => r.trim()) : undefined

  if (refs) {
    const missing = refs.filter(r => !existsSync(r))
    if (missing.length > 0) {
      console.error(`File not found: ${missing.join(', ')}`)
      process.exit(1)
    }
  }

  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const entry = { key, insight, source, tags, date }
  if (refs) entry.refs = refs

  mkdirSync(dirname(filePath), { recursive: true })
  appendFileSync(filePath, JSON.stringify(entry) + '\n')
}

function cmdRead(args) {
  const filePath = args[0]
  if (!filePath) {
    console.error('Usage: knowledge read <file> [-refs "path1,path2"] [-limit N]')
    process.exit(1)
  }

  const content = readFileOr(filePath)
  if (!content.trim()) {
    process.stdout.write(`No entries: ${filePath}\n`)
    process.exit(0)
  }

  const refsRaw = getFlag(args, '-refs')
  const filterRefs = refsRaw ? new Set(refsRaw.split(',').map(r => r.trim())) : null

  const tagsRaw = getFlag(args, '-tags')
  const filterTags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()) : null

  const limitRaw = getFlag(args, '-limit')
  const limit = limitRaw != null ? Number(limitRaw) : 10

  const sourcePriority = { 'user-stated': 0, 'observed': 1, 'inferred': 2 }

  const sourceDateSort = (a, b) => {
    const sp = (sourcePriority[a.source] ?? 9) - (sourcePriority[b.source] ?? 9)
    if (sp !== 0) return sp
    return b.date.localeCompare(a.date)
  }

  const lines = content.trim().split('\n').filter(l => l.trim())
  const exact = []
  const partial = []
  const unfiltered = []

  for (const line of lines) {
    let entry
    try { entry = JSON.parse(line) } catch { continue }
    if (filterRefs && (!entry.refs || !entry.refs.some(r => filterRefs.has(r)))) continue

    if (filterTags) {
      const entryTags = entry.tags || []
      const hasExact = filterTags.some(ft => entryTags.includes(ft))
      const hasPartial = !hasExact && filterTags.some(ft => entryTags.some(et => et.includes(ft) || ft.includes(et)))
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
    process.stdout.write(`[${entry.key}]${tags} ${entry.insight} — ${entry.source}, ${entry.date}${refs}\n`)
  }

  const remaining = matched.length - shown.length
  if (remaining > 0) {
    process.stderr.write(`(他 ${remaining} 件)\n`)
  }
}

function cmdDelete(args) {
  const filePath = args[0]
  if (!filePath) {
    console.error('Usage: knowledge delete <file> -key "KEY"')
    process.exit(1)
  }

  const key = getFlag(args, '-key')
  if (!key) {
    console.error('-key is required')
    process.exit(1)
  }

  const content = readFile(filePath)
  const lines = content.trim().split('\n').filter(l => l.trim())
  const filtered = lines.filter(line => {
    let entry
    try { entry = JSON.parse(line) } catch { return true }
    return entry.key !== key
  })

  if (filtered.length === lines.length) {
    console.error(`Key not found: "${key}"`)
    process.exit(1)
  }

  writeFileSync(filePath, filtered.length > 0 ? filtered.join('\n') + '\n' : '')
}

