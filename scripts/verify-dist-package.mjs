import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const zipPath = resolve(process.argv[2] || 'zashboard-dist.zip')

const uint16 = (buffer, offset) => buffer.readUInt16LE(offset)
const uint32 = (buffer, offset) => buffer.readUInt32LE(offset)

const findEndOfCentralDirectory = (buffer) => {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22)

  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (uint32(buffer, offset) === 0x06054b50) {
      return offset
    }
  }

  throw new Error('ZIP end-of-central-directory record was not found.')
}

const readCentralDirectoryEntries = (buffer) => {
  const eocdOffset = findEndOfCentralDirectory(buffer)
  const entryCount = uint16(buffer, eocdOffset + 10)
  const directorySize = uint32(buffer, eocdOffset + 12)
  const directoryOffset = uint32(buffer, eocdOffset + 16)
  const directoryEnd = directoryOffset + directorySize

  if (directoryEnd > buffer.length) {
    throw new Error('ZIP central directory points outside the file.')
  }

  const entries = []
  let offset = directoryOffset

  for (let index = 0; index < entryCount; index += 1) {
    if (uint32(buffer, offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory header at offset ${offset}.`)
    }

    const compressedSize = uint32(buffer, offset + 20)
    const uncompressedSize = uint32(buffer, offset + 24)
    const nameLength = uint16(buffer, offset + 28)
    const extraLength = uint16(buffer, offset + 30)
    const commentLength = uint16(buffer, offset + 32)
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')

    entries.push({
      name: name.replaceAll('\\', '/'),
      compressedSize,
      uncompressedSize,
    })

    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message)
  }
}

const buffer = await readFile(zipPath)
const entries = readCentralDirectoryEntries(buffer)
const names = entries.map((entry) => entry.name)
const files = entries.filter((entry) => !entry.name.endsWith('/'))

const invalidPath = names.find(
  (name) =>
    name.startsWith('/') ||
    /^[a-z]:\//i.test(name) ||
    name.split('/').some((segment) => segment === '..') ||
    name.length === 0,
)

assert(!invalidPath, `ZIP contains an unsafe path: ${invalidPath}`)
assert(names.includes('index.html'), 'ZIP is missing index.html.')
assert(names.includes('sw.js'), 'ZIP is missing sw.js.')
assert(names.includes('manifest.webmanifest'), 'ZIP is missing manifest.webmanifest.')
assert(names.some((name) => /^assets\/.+\.js$/.test(name)), 'ZIP is missing a built JS asset.')
assert(names.some((name) => /^assets\/.+\.css$/.test(name)), 'ZIP is missing a built CSS asset.')
assert(names.includes('pwa-192x192.png'), 'ZIP is missing pwa-192x192.png.')
assert(names.includes('pwa-512x512.png'), 'ZIP is missing pwa-512x512.png.')
assert(!names.some((name) => name.startsWith('dist/')), 'ZIP should contain dist contents, not a nested dist directory.')
assert(files.length >= 10, 'ZIP has too few files to be a complete dist package.')

const totalCompressedBytes = files.reduce((total, entry) => total + entry.compressedSize, 0)
const totalUncompressedBytes = files.reduce((total, entry) => total + entry.uncompressedSize, 0)

console.log(
  JSON.stringify(
    {
      zipPath,
      bytes: buffer.length,
      entries: entries.length,
      files: files.length,
      hasIndex: true,
      hasServiceWorker: true,
      totalCompressedBytes,
      totalUncompressedBytes,
    },
    null,
    2,
  ),
)
