const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const {
  POSIX_SANE_PATH_ENTRIES,
  appendUniquePathEntries,
  buildDesktopBackendEnv,
  buildDesktopBackendPath,
  normalizeNyxoHomeRoot,
  pathEnvKey
} = require('./backend-env.cjs')

test('desktop backend PATH adds Nyxo-managed bins and missing POSIX sane entries', () => {
  const result = buildDesktopBackendPath({
    nyxoHome: '/Users/test/.nyxo',
    venvRoot: '/Users/test/.nyxo/nyxo-agent/venv',
    currentPath: '/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin',
    platform: 'darwin',
    pathModule: path.posix
  })

  const entries = result.split(':')
  assert.equal(entries[0], '/Users/test/.nyxo/node/bin')
  assert.equal(entries[1], '/Users/test/.nyxo/nyxo-agent/venv/bin')
  assert.ok(entries.includes('/opt/homebrew/bin'), 'Apple Silicon Homebrew bin is added')
  assert.ok(entries.includes('/opt/homebrew/sbin'), 'Apple Silicon Homebrew sbin is added')
  assert.ok(entries.includes('/usr/local/sbin'), 'missing standard sbin is added')

  for (const expected of POSIX_SANE_PATH_ENTRIES) {
    assert.ok(entries.includes(expected), `${expected} should be present`)
  }
})

test('desktop backend PATH preserves first occurrence and avoids duplicates', () => {
  const result = buildDesktopBackendPath({
    nyxoHome: '/Users/test/.nyxo',
    venvRoot: '/Users/test/.nyxo/nyxo-agent/venv',
    currentPath: '/opt/homebrew/bin:/usr/bin:/opt/homebrew/bin:/bin',
    platform: 'darwin',
    pathModule: path.posix
  })

  const entries = result.split(':')
  assert.equal(entries.filter(entry => entry === '/opt/homebrew/bin').length, 1)
  assert.ok(
    entries.indexOf('/opt/homebrew/bin') < entries.indexOf('/opt/homebrew/sbin'),
    'existing Homebrew bin keeps its precedence over appended missing sane entries'
  )
})

test('buildDesktopBackendEnv extends PYTHONPATH and backend PATH together', () => {
  const env = buildDesktopBackendEnv({
    nyxoHome: '/Users/test/.nyxo',
    pythonPathEntries: ['/repo/nyxo-agent'],
    venvRoot: '/Users/test/.nyxo/nyxo-agent/venv',
    currentEnv: {
      PATH: '/usr/bin:/bin',
      PYTHONPATH: '/existing/pythonpath'
    },
    platform: 'darwin',
    pathModule: path.posix
  })

  assert.equal(env.PYTHONPATH, '/repo/nyxo-agent:/existing/pythonpath')
  assert.ok(env.PATH.startsWith('/Users/test/.nyxo/node/bin:/Users/test/.nyxo/nyxo-agent/venv/bin:'))
  assert.ok(env.PATH.includes('/opt/homebrew/bin'))
})

test('normalizeNyxoHomeRoot maps profile homes back to the global Nyxo root', () => {
  assert.equal(
    normalizeNyxoHomeRoot('/Users/test/.nyxo/profiles/oracle', { pathModule: path.posix }),
    '/Users/test/.nyxo'
  )
  assert.equal(
    normalizeNyxoHomeRoot('C:\\Users\\test\\AppData\\Local\\nyxo\\profiles\\oracle', { pathModule: path.win32 }),
    'C:\\Users\\test\\AppData\\Local\\nyxo'
  )
  assert.equal(
    normalizeNyxoHomeRoot('/Users/test/.nyxo', { pathModule: path.posix }),
    '/Users/test/.nyxo'
  )
})

test('Windows PATH casing and delimiter are preserved without POSIX sane entries', () => {
  const env = buildDesktopBackendEnv({
    nyxoHome: 'C:\\Users\\test\\AppData\\Local\\nyxo',
    pythonPathEntries: ['C:\\repo\\nyxo-agent'],
    venvRoot: 'C:\\Users\\test\\AppData\\Local\\nyxo\\nyxo-agent\\venv',
    currentEnv: {
      Path: 'C:\\Windows\\System32;C:\\Windows',
      PYTHONPATH: 'C:\\existing\\pythonpath'
    },
    platform: 'win32',
    pathModule: path.win32
  })

  assert.equal(pathEnvKey({ Path: 'x' }, 'win32'), 'Path')
  assert.equal(env.PATH, undefined)
  assert.ok(env.Path.startsWith('C:\\Users\\test\\AppData\\Local\\nyxo\\node\\bin;'))
  assert.ok(env.Path.includes('\\venv\\Scripts;'))
  assert.ok(env.Path.includes(';C:\\Windows\\System32;C:\\Windows'))
  assert.equal(env.Path.includes('/opt/homebrew/bin'), false)
})

test('appendUniquePathEntries drops empty entries and keeps first occurrence', () => {
  assert.equal(
    appendUniquePathEntries([':/a::/b', ['/a', '/c']], { delimiter: ':' }),
    '/a:/b:/c'
  )
})
