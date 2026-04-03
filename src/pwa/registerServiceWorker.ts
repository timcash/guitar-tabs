import { buildAppPath } from '../appRoutes';

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    return;
  }

  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(buildAppPath('/service-worker.js'), {
      scope: buildAppPath('/')
    });
  });
}
