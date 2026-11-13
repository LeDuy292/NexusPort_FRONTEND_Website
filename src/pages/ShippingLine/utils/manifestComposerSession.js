const sessionKey = () => {
  const user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}')
  return `nexusport_manifest_composer:${user.id || user.username || 'session'}`
}
export function saveManifestComposerSession(value) {
  sessionStorage.setItem(sessionKey(), JSON.stringify(value))
}
export function readManifestComposerSession() {
  try { return JSON.parse(sessionStorage.getItem(sessionKey()) || 'null') } catch { return null }
}
export function clearManifestComposerSession() {
  try { sessionStorage.removeItem(sessionKey()) } catch { /* No saved session. */ }
}
