'use strict';
const allowed = new Set(['media', 'fullscreen', 'local-network', 'local-network-access', 'loopback-network']);
function allowedPermission(contents, permission, origin, requestingUrl, details = {}) {
  if (!contents || !allowed.has(permission) || details.isMainFrame === false) return false;
  try {
    if (new URL(contents.getURL()).origin !== origin) return false;
    if (!requestingUrl || new URL(requestingUrl).origin !== origin) return false;
    if (details.embeddingOrigin && new URL(details.embeddingOrigin).origin !== origin) return false;
    return true;
  } catch { return false; }
}
module.exports = { allowedPermission };
