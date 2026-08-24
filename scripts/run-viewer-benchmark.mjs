import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from '@playwright/test';

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const baseUrl = option('url', 'http://127.0.0.1:4173');
const output = option('output', '.gstack/benchmark-reports/latest-viewer-benchmark.json');
const headless = option('headless', 'true') !== 'false';

async function isReachable(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startLocalServerIfNeeded() {
  if (await isReachable(baseUrl)) return null;
  const target = new URL(baseUrl);
  if (!['127.0.0.1', 'localhost', '::1'].includes(target.hostname)) {
    throw new Error(`Benchmark target is unreachable: ${baseUrl}`);
  }
  const port = target.port || '80';
  const child = spawn('npm', ['run', 'dev', '--', '--host', target.hostname, '--port', port, '--strictPort'], {
    cwd: process.cwd(),
    env: { ...process.env, NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs += chunk.toString(); });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Local benchmark server exited early.\n${logs}`);
    if (await isReachable(baseUrl)) return child;
    await delay(250);
  }
  child.kill('SIGTERM');
  throw new Error(`Local benchmark server did not become ready.\n${logs}`);
}

const localServer = await startLocalServerIfNeeded();
const browser = await chromium.launch({ headless });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(new URL('benchmark/', baseUrl).toString(), { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Run benchmark' }).click();
  await page.waitForFunction(() => Boolean(window.__MODERN_3D_BENCHMARK__), null, { timeout: 120_000 });
  const report = await page.evaluate(() => window.__MODERN_3D_BENCHMARK__);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.stderr.write(`Saved benchmark report to ${output}\n`);
} finally {
  await browser.close();
  if (localServer && localServer.exitCode === null) localServer.kill('SIGTERM');
}
