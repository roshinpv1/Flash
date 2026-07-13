import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('flashDesktop', {
  getConnection: profile => ipcRenderer.invoke('flash:connection', profile),
  revalidateConnection: () => ipcRenderer.invoke('flash:connection:revalidate'),
  touchBackend: profile => ipcRenderer.invoke('flash:backend:touch', profile),
  getGatewayWsUrl: profile => ipcRenderer.invoke('flash:gateway:ws-url', profile),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('flash:window:openSession', sessionId, opts),
  openNewSessionWindow: () => ipcRenderer.invoke('flash:window:openNewSession'),
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('flash:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('flash:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('flash:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('flash:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('flash:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('flash:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('flash:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('flash:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('flash:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('flash:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('flash:pet-overlay:control', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('flash:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('flash:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('flash:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('flash:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('flash:connection-config:test', payload),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('flash:connection-config:probe', remoteUrl),
  oauthLoginConnectionConfig: remoteUrl => ipcRenderer.invoke('flash:connection-config:oauth-login', remoteUrl),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('flash:connection-config:oauth-logout', remoteUrl),
  // Flash Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('flash:cloud:status'),
    login: () => ipcRenderer.invoke('flash:cloud:login'),
    logout: () => ipcRenderer.invoke('flash:cloud:logout'),
    discover: org => ipcRenderer.invoke('flash:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('flash:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    get: () => ipcRenderer.invoke('flash:profile:get'),
    set: name => ipcRenderer.invoke('flash:profile:set', name)
  },
  api: request => ipcRenderer.invoke('flash:api', request),
  notify: payload => ipcRenderer.invoke('flash:notify', payload),
  requestMicrophoneAccess: () => ipcRenderer.invoke('flash:requestMicrophoneAccess'),
  readFileDataUrl: filePath => ipcRenderer.invoke('flash:readFileDataUrl', filePath),
  readFileText: filePath => ipcRenderer.invoke('flash:readFileText', filePath),
  selectPaths: options => ipcRenderer.invoke('flash:selectPaths', options),
  writeClipboard: text => ipcRenderer.invoke('flash:writeClipboard', text),
  saveImageFromUrl: url => ipcRenderer.invoke('flash:saveImageFromUrl', url),
  saveImageBuffer: (data, ext) => ipcRenderer.invoke('flash:saveImageBuffer', { data, ext }),
  saveClipboardImage: () => ipcRenderer.invoke('flash:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('flash:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('flash:watchPreviewFile', url),
  stopPreviewFileWatch: id => ipcRenderer.invoke('flash:stopPreviewFileWatch', id),
  setTitleBarTheme: payload => ipcRenderer.send('flash:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('flash:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('flash:translucency', payload),
  setPreviewShortcutActive: active => ipcRenderer.send('flash:previewShortcutActive', Boolean(active)),
  openExternal: url => ipcRenderer.invoke('flash:openExternal', url),
  openPreviewInBrowser: url => ipcRenderer.invoke('flash:openPreviewInBrowser', url),
  fetchLinkTitle: url => ipcRenderer.invoke('flash:fetchLinkTitle', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('flash:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('flash:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('flash:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('flash:setting:defaultProjectDir:pick')
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('flash:zoom:get'),
    setPercent: percent => ipcRenderer.send('flash:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('flash:zoom:changed', listener)

      return () => ipcRenderer.removeListener('flash:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('flash:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('flash:logs:recent'),
  readDir: dirPath => ipcRenderer.invoke('flash:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('flash:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('flash:fs:reveal', targetPath),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('flash:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('flash:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('flash:fs:trash', targetPath),
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('flash:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('flash:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('flash:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('flash:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('flash:git:branchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('flash:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('flash:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('flash:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('flash:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('flash:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('flash:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('flash:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('flash:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('flash:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('flash:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('flash:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('flash:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('flash:git:review:shipInfo', repoPath),
      createPr: repoPath => ipcRenderer.invoke('flash:git:review:createPr', repoPath)
    }
  },
  terminal: {
    cwd: id => ipcRenderer.invoke('flash:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('flash:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('flash:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('flash:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('flash:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `flash:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `flash:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('flash:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('flash:close-preview-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('flash:open-updates', listener)

    return () => ipcRenderer.removeListener('flash:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:deep-link', listener)

    return () => ipcRenderer.removeListener('flash:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('flash:deep-link-ready'),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:window-state-changed', listener)

    return () => ipcRenderer.removeListener('flash:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('flash:focus-session', listener)

    return () => ipcRenderer.removeListener('flash:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:notification-action', listener)

    return () => ipcRenderer.removeListener('flash:notification-action', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('flash:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:backend-exit', listener)

    return () => ipcRenderer.removeListener('flash:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('flash:connection:applied', listener)

    return () => ipcRenderer.removeListener('flash:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('flash:power-resume', listener)

    return () => ipcRenderer.removeListener('flash:power-resume', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:boot-progress', listener)

    return () => ipcRenderer.removeListener('flash:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('flash:bootstrap:get'),
  resetBootstrap: () => ipcRenderer.invoke('flash:bootstrap:reset'),
  repairBootstrap: () => ipcRenderer.invoke('flash:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('flash:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('flash:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('flash:bootstrap:event', listener)
  },
  getVersion: () => ipcRenderer.invoke('flash:version'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('flash:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('flash:uninstall:summary'),
    run: mode => ipcRenderer.invoke('flash:uninstall:run', { mode })
  },
  updates: {
    check: () => ipcRenderer.invoke('flash:updates:check'),
    apply: opts => ipcRenderer.invoke('flash:updates:apply', opts),
    getBranch: () => ipcRenderer.invoke('flash:updates:branch:get'),
    setBranch: name => ipcRenderer.invoke('flash:updates:branch:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('flash:updates:progress', listener)

      return () => ipcRenderer.removeListener('flash:updates:progress', listener)
    }
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('flash:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('flash:vscode-theme:search', query)
  }
})
