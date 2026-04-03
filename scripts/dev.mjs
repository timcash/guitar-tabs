import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import readline from 'node:readline';

const workspaceRoot = process.cwd();
const stateDir = join(workspaceRoot, 'node_modules', '.cache', 'guitar-tabs');
const stateFile = join(stateDir, 'dev-runner.json');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const managedPorts = [5174, 4176];
const children = [];
let shuttingDown = false;

await cleanupPreviousRunner();
await cleanupManagedPorts();

mkdirSync(stateDir, { recursive: true });
writeStateFile();

console.log('[dev] starting web and bridge services');
startService('web', ['run', 'dev:web']);
startService('bridge', ['run', 'dev:bridge']);

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

process.on('exit', () => {
  removeStateFileIfOwned();
});

async function cleanupPreviousRunner() {
  if (!existsSync(stateFile)) return;

  const previousState = readStateFile();
  if (!previousState?.pid || previousState.pid === process.pid) return;

  if (!isProcessRunning(previousState.pid)) {
    removeStateFileIfOwned(previousState.pid);
    return;
  }

  console.log(`[dev] stopping previous dev runner ${previousState.pid}`);
  await killProcessTree(previousState.pid);
  await wait(800);
  removeStateFileIfOwned(previousState.pid);
}

async function cleanupManagedPorts() {
  for (const port of managedPorts) {
    const pids = findListeningPids(port);
    for (const pid of pids) {
      if (pid === process.pid) continue;
      console.log(`[dev] freeing tcp:${port} from pid ${pid}`);
      await killProcessTree(pid);
    }
  }
}

function startService(name, args) {
  const child = spawn(getServiceCommand(), getServiceArgs(args), {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });

  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');

  pipeWithPrefix(child.stdout, `[${name}]`, process.stdout);
  pipeWithPrefix(child.stderr, `[${name}]`, process.stderr);

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev] ${name} exited (${signal ?? code ?? 0})`);
    void shutdown(code ?? 1);
  });

  children.push(child);
}

function getServiceCommand() {
  if (process.platform === 'win32') {
    return 'cmd.exe';
  }

  return npmCommand;
}

function getServiceArgs(args) {
  if (process.platform === 'win32') {
    return ['/d', '/s', '/c', [npmCommand, ...args].join(' ')];
  }

  return args;
}

function pipeWithPrefix(stream, prefix, target) {
  if (!stream) return;
  const rl = readline.createInterface({ input: stream });
  rl.on('line', (line) => {
    target.write(`${prefix} ${line}\n`);
  });
}

async function shutdown(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.pid) continue;
    await killProcessTree(child.pid);
  }

  removeStateFileIfOwned();
  process.exit(exitCode);
}

function writeStateFile() {
  writeFileSync(
    stateFile,
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString()
      },
      null,
      2
    )
  );
}

function readStateFile() {
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

function removeStateFileIfOwned(ownerPid = process.pid) {
  const state = readStateFile();
  if (!state?.pid || state.pid !== ownerPid) return;

  rmSync(stateFile, { force: true });
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killProcessTree(pid) {
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    return;
  }

  await wait(400);
}

function findListeningPids(port) {
  try {
    if (process.platform === 'win32') {
      const output = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      const pids = new Set();

      for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) continue;

        const columns = trimmed.split(/\s+/);
        if (columns.length < 5) continue;

        const localAddress = columns[1];
        const state = columns[3];
        const pid = Number(columns[4]);

        if (state !== 'LISTENING') continue;
        if (!localAddress.endsWith(`:${port}`)) continue;
        if (Number.isNaN(pid)) continue;

        pids.add(pid);
      }

      return [...pids];
    }

    const output = execFileSync('lsof', ['-ti', `tcp:${port}`], { encoding: 'utf8' });
    return output
      .split(/\r?\n/)
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value));
  } catch {
    return [];
  }
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
