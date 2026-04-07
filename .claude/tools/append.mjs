#!/usr/bin/env node

import { appendFileSync } from 'node:fs'
import { blankLinePrefix, readFileOr, resolveDate } from './lib.mjs'

const [filePath, content] = process.argv.slice(2)

if (!filePath || !content) {
  console.error('Usage: append <file> <content>')
  console.error('  {date:FORMAT} is replaced with current time')
  console.error('  FORMAT tokens: YYYY, mm, DD, HH, MM, SS')
  process.exit(1)
}

const resolved = resolveDate(content)

const existing = readFileOr(filePath)
appendFileSync(filePath, blankLinePrefix(existing) + resolved + '\n')
