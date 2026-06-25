const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('nyxoDesktop', {
  getConnection: profile => ipcRenderer.invoke('nyxo:connection', profile),
  revalidateConnection: () => ipcRenderer.invoke('nyxo:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('nyxo:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('nyxo:gateway:ws-url', profile),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('nyxo:window:openSession', sessionId, opts),
  openNewSessionWindow: () => ipcRenderer.invoke('nyxo:window:openNewSession'),
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('nyxo:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('nyxo:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('nyxo:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('nyxo:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('nyxo:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('nyxo:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('nyxo:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nyxo:pet-overlay:state', listener)
      return () => ipcRenderer.removeListener('nyxo:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nyxo:pet-overlay:control', listener)
      return () => ipcRenderer.removeListener('nyxo:pet-overlay:control', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('nyxo:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('nyxo:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('nyxo:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('nyxo:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('nyxo:connection-config:test', payload),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('nyxo:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('nyxo:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('nyxo:connection-config:oauth-logout', remoteUrl),
  profile: {
    get: () => ipcRenderer.invoke('nyxo:profile:get'),
    set: name => ipcRenderer.invoke('nyxo:profile:set', name)
  },
  api: request => ipcRenderer.invoke('nyxo:api', request),
  notify: payload => ipcRenderer.invoke('nyxo:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('nyxo:requestMicrophoneAccess'),
  readFileDataUrl: filePath => ipcRenderer.invoke('nyxo:readFileDataUrl', filePath),
  readFileText: filePath => ipcRenderer.invoke('nyxo:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('nyxo:selectPaths', options),
  writeClipboard: text => ipcRenderer.invoke('nyxo:writeClipboard', text),
  saveImageFromUrl: url => ipcRenderer.invoke('nyxo:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('nyxo:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('nyxo:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('nyxo:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('nyxo:watchPreviewFile', url),
  stopPreviewFileWatch: id => ipcRenderer.invoke('nyxo:stopPreviewFileWatch', id),
  setTitleBarTheme: payload => ipcRenderer.send('nyxo:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('nyxo:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('nyxo:translucency', payload),
  setPreviewShortcutActive: active => ipcRenderer.send('nyxo:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('nyxo:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('nyxo:openPreviewInBrowser', url),
  fetchLinkTitle: url => ipcRenderer.invoke('nyxo:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('nyxo:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('nyxo:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('nyxo:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('nyxo:setting:defaultProjectDir:pick')
  },
  revealLogs: () => ipcRenderer.invoke('nyxo:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('nyxo:logs:recent'),
  readDir: dirPath => ipcRenderer.invoke('nyxo:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('nyxo:fs:gitRoot', startPath),
  worktrees: cwds => ipcRenderer.invoke('nyxo:fs:worktrees', cwds),
  terminal: {
    dispose: id => ipcRenderer.invoke('nyxo:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('nyxo:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('nyxo:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('nyxo:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `nyxo:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `nyxo:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)
      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('nyxo:close-preview-requested', listener)
    return () => ipcRenderer.removeListener('nyxo:close-preview-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('nyxo:open-updates', listener)
    return () => ipcRenderer.removeListener('nyxo:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:deep-link', listener)
    return () => ipcRenderer.removeListener('nyxo:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('nyxo:deep-link-ready'),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:window-state-changed', listener)
    return () => ipcRenderer.removeListener('nyxo:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('nyxo:focus-session', listener)
    return () => ipcRenderer.removeListener('nyxo:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:notification-action', listener)
    return () => ipcRenderer.removeListener('nyxo:notification-action', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:preview-file-changed', listener)
    return () => ipcRenderer.removeListener('nyxo:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:backend-exit', listener)
    return () => ipcRenderer.removeListener('nyxo:backend-exit', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('nyxo:power-resume', listener)
    return () => ipcRenderer.removeListener('nyxo:power-resume', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:boot-progress', listener)
    return () => ipcRenderer.removeListener('nyxo:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.cjs (apps/desktop/electron/bootstrap-runner.cjs).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('nyxo:bootstrap:get'),
  resetBootstrap: () => ipcRenderer.invoke('nyxo:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('nyxo:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('nyxo:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('nyxo:bootstrap:event', listener)
    return () => ipcRenderer.removeListener('nyxo:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('nyxo:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('nyxo:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('nyxo:uninstall:summary'),
    run: mode => ipcRenderer.invoke('nyxo:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('nyxo:updates:check'),
    apply: opts => ipcRenderer.invoke('nyxo:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('nyxo:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('nyxo:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('nyxo:updates:progress', listener)
      return () => ipcRenderer.removeListener('nyxo:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('nyxo:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('nyxo:vscode-theme:search', query)
  }
})
