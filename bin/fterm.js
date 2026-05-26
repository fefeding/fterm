#!/usr/bin/env node

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');

const projectRoot = path.resolve(__dirname, '..');

function getPidFilePath() {
  const dataDir = process.env.fterm_DATA_DIR || path.join(os.homedir(), '.fterm');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'fterm.server.pid');
}

function readPid() {
  const pidFilePath = getPidFilePath();
  if (fs.existsSync(pidFilePath)) {
    return parseInt(fs.readFileSync(pidFilePath, 'utf8'));
  }
  return null;
}

function writePid(pid) {
  const pidFilePath = getPidFilePath();
  fs.writeFileSync(pidFilePath, pid.toString());
}

function deletePid() {
  const pidFilePath = getPidFilePath();
  if (fs.existsSync(pidFilePath)) {
    fs.unlinkSync(pidFilePath);
  }
}

const args = process.argv.slice(2);
const command = args[0] || 'help';
const commandArgs = args.slice(1);

switch (command) {
  case 'start': startProject(); break;
  case 'stop': stopProject(); break;
  case 'restart': restartProject(); break;
  case '-v':
  case '--version': showVersion(); break;
  default: showHelp(); break;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => { server.close(); resolve(true); });
    server.listen(port);
  });
}

async function findAvailablePort(startPort) {
  let port = startPort;
  for (let i = 0; i < 100; i++) {
    if (await isPortAvailable(port)) return port;
    port++;
  }
  throw new Error(`无法找到可用端口，已尝试 100 次`);
}

async function startProject() {
  console.log('Starting fterm...');

  const pid = readPid();
  if (pid) {
    try {
      process.kill(pid, 0);
      console.log('Server is already running with PID:', pid);
      return;
    } catch (error) {
      if (error.code === 'ESRCH') {
        console.log('Cleaning up stale PID file...');
        deletePid();
      }
    }
  }

  let port = 9801;
  const portIndex = commandArgs.findIndex(arg => arg === '-p' || arg === '--port');
  if (portIndex !== -1 && commandArgs[portIndex + 1]) {
    port = parseInt(commandArgs[portIndex + 1]);
  }

  try {
    port = await findAvailablePort(port);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  const logFilePath = path.join(projectRoot, 'server.log');
  let logFileFd;
  try {
    logFileFd = fs.openSync(logFilePath, 'a');
  } catch (e) { /* ignore */ }

  const child = spawn('node', ['server.js', '-p', port.toString()], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', logFileFd || 'inherit', logFileFd || 'inherit']
  });

  child.unref();
  writePid(child.pid);

  console.log('Server started with PID:', child.pid);
  console.log(`fterm is running at http://localhost:${port}`);
}

function stopProject() {
  console.log('Stopping fterm...');
  const pid = readPid();
  if (!pid) {
    console.log('No server process found');
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
    deletePid();
    console.log('Server stopped');
  } catch (error) {
    if (error.code === 'ESRCH') {
      deletePid();
    }
    console.error('Failed to stop:', error.message);
  }
}

function restartProject() {
  stopProject();
  for (let i = 0; i < 10; i++) {
    if (!readPid()) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  startProject();
}

function showVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  console.log(pkg.version);
}

function showHelp() {
  console.log('fterm - Web SSH Terminal');
  console.log('');
  console.log('Usage:');
  console.log('  fterm start    Start the server');
  console.log('  fterm stop     Stop the server');
  console.log('  fterm restart  Restart the server');
  console.log('  fterm -v       Show version');
  console.log('');
}
