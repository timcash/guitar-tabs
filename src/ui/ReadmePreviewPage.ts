import { marked } from 'marked';
import { buildAppPath } from '../appRoutes';
import readmeMarkdown from '../../README.md?raw';

const readmeDocAssets = import.meta.glob('../../docs/**/*.{png,jpg,jpeg,gif,svg,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url'
}) as Record<string, string>;

const readmeRootAssets = import.meta.glob('../../*.{png,jpg,jpeg,gif,svg,webp,avif}', {
  eager: true,
  import: 'default',
  query: '?url'
}) as Record<string, string>;

const readmeAssetManifest = buildReadmeAssetManifest({
  ...readmeDocAssets,
  ...readmeRootAssets
});

export class ReadmePreviewPage {
  private readonly root: HTMLDivElement;

  constructor(root: HTMLDivElement) {
    this.root = root;
  }

  public render() {
    document.title = 'README - guitar-tabs';

    this.root.classList.add('readme-preview-root');
    this.root.innerHTML = `
      <div class="readme-page">
        <article class="markdown-body" id="readmeMarkdown"></article>
      </div>
    `;

    const markdownRoot = this.root.querySelector<HTMLElement>('#readmeMarkdown');
    if (!markdownRoot) return;

    markdownRoot.innerHTML = marked.parse(readmeMarkdown, {
      gfm: true,
      breaks: true
    }) as string;

    this.decorateMarkdown(markdownRoot);
  }

  private decorateMarkdown(markdownRoot: HTMLElement) {
    markdownRoot.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      const src = img.getAttribute('src');
      if (!src) return;

      img.src = this.resolveReadmeUrl(src);
      img.loading = 'lazy';
    });

    markdownRoot.querySelectorAll<HTMLAnchorElement>('a').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (!href) return;

      const resolvedHref = this.resolveReadmeUrl(href);
      anchor.href = resolvedHref;

      if (/^https?:\/\//i.test(resolvedHref)) {
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
      }
    });
  }

  private resolveReadmeUrl(url: string) {
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('data:') ||
      url.startsWith('#')
    ) {
      return url;
    }

    if (url.startsWith('/')) {
      return buildAppPath(url);
    }

    const normalized = url.replace(/\\/g, '/').replace(/^\.\//, '');

    if (normalized.toLowerCase() === 'readme.md') {
      return buildAppPath('/readme');
    }

    if (normalized.startsWith('public/')) {
      return buildAppPath(`/${normalized.slice('public/'.length)}`);
    }

    return readmeAssetManifest[normalized] ?? buildAppPath(`/${normalized}`);
  }
}

function buildReadmeAssetManifest(modules: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(modules).map(([modulePath, assetUrl]) => [
      modulePath.replace(/^\.\.\//, '').replace(/^\.\.\//, ''),
      assetUrl
    ])
  );
}
