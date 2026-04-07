import { existsSync, readFileSync } from 'node:fs'

// {date:FORMAT} を置換する
export function resolveDate(str) {
  const now = new Date()
  const tokens = {
    YYYY: String(now.getFullYear()),
    mm: String(now.getMonth() + 1).padStart(2, '0'),
    DD: String(now.getDate()).padStart(2, '0'),
    HH: String(now.getHours()).padStart(2, '0'),
    MM: String(now.getMinutes()).padStart(2, '0'),
    SS: String(now.getSeconds()).padStart(2, '0'),
  }
  const tokenPattern = new RegExp(Object.keys(tokens).join('|'), 'g')
  return str.replace(/\{date:([^}]+)\}/g, (_, format) => {
    const result = format.replace(tokenPattern, (m) => tokens[m])
    const remaining = result.match(/[A-Za-z]+/)
    if (remaining) {
      console.error(
        `Unknown date token: "${remaining[0]}" in "{date:${format}}"`
      )
      process.exit(1)
    }
    return result
  })
}

// 引数からフラグを取得
export function getFlag(args, name) {
  const idx = args.indexOf(name)
  if (idx === -1 || idx + 1 >= args.length) return null
  return args[idx + 1]
}

// ファイルを読む（存在しなければ空文字）
export function readFileOr(filePath, fallback = '') {
  return existsSync(filePath)
    ? readFileSync(filePath, 'utf-8').replace(/\r/g, '')
    : fallback
}

// 既存内容の末尾に空行を保証するための prefix を返す
export function blankLinePrefix(existing) {
  if (existing.length === 0) return ''
  if (existing.endsWith('\n\n')) return ''
  return existing.endsWith('\n') ? '\n' : '\n\n'
}

// ファイルを読む（存在しなければエラー終了）
export function readFile(filePath) {
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }
  return readFileSync(filePath, 'utf-8').replace(/\r/g, '')
}
