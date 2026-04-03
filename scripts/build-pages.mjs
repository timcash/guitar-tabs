import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const workspaceRoot = process.cwd();
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'guitar-tabs';
const defaultBasePath = `/${repositoryName}/`;
const pagesBasePath = process.env.VITE_SITE_BASE_PATH || defaultBasePath;
const distDir = join(workspaceRoot, 'dist');
const distIndexPath = join(distDir, 'index.html');
const dist404Path = join(distDir, '404.html');
const distNoJekyllPath = join(distDir, '.nojekyll');

execFileSync(getBuildCommand(), getBuildArgs(), {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    VITE_SITE_BASE_PATH: pagesBasePath,
    VITE_CODEX_OFFLINE: process.env.VITE_CODEX_OFFLINE || '1'
  },
  stdio: 'inherit'
});

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

copyFileSync(distIndexPath, dist404Path);
writeFileSync(distNoJekyllPath, '');

function getBuildCommand() {
  if (process.platform === 'win32') {
    return 'cmd.exe';
  }

  return npmCommand;
}

function getBuildArgs() {
  if (process.platform === 'win32') {
    return ['/d', '/s', '/c', `${npmCommand} run build`];
  }

  return ['run', 'build'];
}
