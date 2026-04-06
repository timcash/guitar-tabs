import './style.css';
import { GuitarTabsApp } from './app/GuitarTabsApp';
import { stripAppBasePath } from './appRoutes';
import { CodexTerminalPage } from './codex/CodexTerminalPage';
import { MusicNoteCirclePage } from './music/MusicNoteCirclePage';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { ReadmePreviewPage } from './ui/ReadmePreviewPage';

const appRoot = document.querySelector<HTMLDivElement>('#app');
if (!appRoot) {
  throw new Error('Expected #app root element');
}

const normalizedPath = stripAppBasePath(window.location.pathname);
registerServiceWorker();

document.body.classList.remove('readme-route', 'codex-route', 'music-route');
appRoot.classList.remove('readme-preview-root', 'codex-route-root', 'music-route-root');

if (normalizedPath === '/readme') {
  document.body.classList.add('readme-route');
  const readmePreviewPage = new ReadmePreviewPage(appRoot);
  readmePreviewPage.render();
} else if (normalizedPath === '/music') {
  const musicNoteCirclePage = new MusicNoteCirclePage(appRoot);
  musicNoteCirclePage.render();
} else if (normalizedPath === '/codex') {
  const codexTerminalPage = new CodexTerminalPage(appRoot);
  void codexTerminalPage.render();
} else {
  const guitarTabsApp = new GuitarTabsApp(appRoot);
  guitarTabsApp.start();
}
