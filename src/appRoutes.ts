function normalizePath(path: string) {
  const trimmed = path.replace(/\/+$/, '');
  if (trimmed.length === 0) {
    return '/';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeBasePath(path: string) {
  const normalized = normalizePath(path);
  return normalized === '/' ? '/' : normalized.replace(/\/+$/, '');
}

const configuredBasePath = normalizeBasePath(new URL(import.meta.env.BASE_URL, 'http://localhost').pathname);

export function getAppBasePath() {
  return configuredBasePath;
}

export function stripAppBasePath(pathname: string) {
  const normalizedPath = normalizePath(pathname);
  if (configuredBasePath === '/') {
    return normalizedPath;
  }

  if (normalizedPath === configuredBasePath) {
    return '/';
  }

  if (normalizedPath.startsWith(`${configuredBasePath}/`)) {
    return normalizedPath.slice(configuredBasePath.length) || '/';
  }

  return normalizedPath;
}

export function buildAppPath(path: string) {
  const normalizedPath = normalizePath(path);
  if (configuredBasePath === '/') {
    return normalizedPath;
  }

  if (normalizedPath === '/') {
    return configuredBasePath;
  }

  return `${configuredBasePath}${normalizedPath}`;
}
