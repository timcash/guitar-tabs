import { buildAppPath } from '../appRoutes';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener('load', () => {
    const scope = ensureTrailingSlash(buildAppPath('/'));
    void navigator.serviceWorker.register(buildAppPath('/service-worker.js'), {
      scope
    });
  });
}

function ensureTrailingSlash(path: string) {
  return path.endsWith('/') ? path : `${path}/`;
}
