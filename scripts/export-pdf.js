import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, mkdir, open, rm, stat } from 'node:fs/promises';
import { delimiter, dirname, join, resolve, win32 } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  SUPPORTED_YEAR_END,
  SUPPORTED_YEAR_START,
  isSupportedYear,
  resolveYear,
} from '../src/calendar-data.js';

export const EXPORT_TIMEOUT_MS = 120_000;
export const TERMINATION_GRACE_MS = 2_000;

export async function isExecutable(file) {
  try {
    await access(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export async function findOnPath(
  command,
  { env = process.env, platform = process.platform, isExecutableFn = isExecutable } = {},
) {
  const pathDelimiter = platform === 'win32' ? ';' : delimiter;
  const pathJoin = platform === 'win32' ? win32.join : join;
  const pathEntries = (env.PATH || '').split(pathDelimiter).filter(Boolean);
  const names = platform === 'win32' ? [`${command}.exe`, command] : [command];

  for (const directory of pathEntries) {
    for (const name of names) {
      const candidate = pathJoin(directory, name);
      if (await isExecutableFn(candidate)) return candidate;
    }
  }
  return '';
}

export function getBrowserCandidates(platform = process.platform, env = process.env) {
  if (platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
  }
  if (platform === 'linux') {
    return [
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/usr/bin/msedge',
    ];
  }
  if (platform === 'win32') {
    const roots = [
      env.PROGRAMFILES || env.ProgramFiles,
      env['PROGRAMFILES(X86)'] || env['ProgramFiles(x86)'],
      env.LOCALAPPDATA || env.LocalAppData,
    ].filter(Boolean);
    return roots.flatMap((root) => [
      win32.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      win32.join(root, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]);
  }
  return [];
}

export async function findChrome({
  env = process.env,
  platform = process.platform,
  isExecutableFn = isExecutable,
} = {}) {
  if (env.CHROME_PATH) {
    if (await isExecutableFn(env.CHROME_PATH)) return env.CHROME_PATH;
    throw new Error(`CHROME_PATH 不可执行或不存在：${env.CHROME_PATH}`);
  }

  for (const candidate of getBrowserCandidates(platform, env)) {
    if (await isExecutableFn(candidate)) return candidate;
  }
  for (const command of [
    'google-chrome',
    'chrome',
    'chromium',
    'chromium-browser',
    'microsoft-edge',
    'msedge',
  ]) {
    const candidate = await findOnPath(command, { env, platform, isExecutableFn });
    if (candidate) return candidate;
  }

  throw new Error('未找到 Chrome、Edge 或 Chromium。请安装浏览器，或通过 CHROME_PATH 指定可执行文件。');
}

function killBrowser(child, signal) {
  try {
    child.kill(signal);
  } catch {
    // The process may have exited between the timeout and the kill attempt.
  }
}

export function waitForExit(
  child,
  { timeoutMs = EXPORT_TIMEOUT_MS, terminationGraceMs = TERMINATION_GRACE_MS } = {},
) {
  return new Promise((resolvePromise, reject) => {
    let timedOut = false;
    let forceKillTimer;
    let finalTimer;

    const cleanup = () => {
      clearTimeout(timeoutTimer);
      clearTimeout(forceKillTimer);
      clearTimeout(finalTimer);
    };
    const finish = (code, signal) => {
      cleanup();
      resolvePromise({ code, signal, timedOut });
    };
    const fail = (error) => {
      cleanup();
      reject(error);
    };

    child.once('error', fail);
    child.once('exit', finish);

    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      killBrowser(child, 'SIGTERM');
      forceKillTimer = setTimeout(() => {
        killBrowser(child, 'SIGKILL');
        finalTimer = setTimeout(() => {
          fail(new Error(`浏览器导出超时，且无法在 ${terminationGraceMs * 2}ms 内终止进程。`));
        }, terminationGraceMs);
      }, terminationGraceMs);
    }, timeoutMs);
  });
}

export async function prepareOutput(outputUrl) {
  await mkdir(dirname(fileURLToPath(outputUrl)), { recursive: true });
  await rm(outputUrl, { force: true });
}

export async function validatePdf(outputUrl, exportStartedAt) {
  let outputStat;
  try {
    outputStat = await stat(outputUrl);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('浏览器未生成 PDF 文件。');
    throw error;
  }
  if (outputStat.size < 5) throw new Error('浏览器生成了空或不完整的 PDF 文件。');
  if (outputStat.mtimeMs < exportStartedAt - 1_000) {
    throw new Error('PDF 文件时间早于本次导出，无法确认产物为最新生成。');
  }

  const file = await open(outputUrl, 'r');
  try {
    const signature = Buffer.alloc(5);
    await file.read(signature, 0, signature.length, 0);
    if (signature.toString('ascii') !== '%PDF-') {
      throw new Error('浏览器生成的文件不是有效的 PDF。');
    }
  } finally {
    await file.close();
  }
}

export async function exportPdf(year, { spawnFn = spawn } = {}) {
  const distEntry = new URL('../dist/index.html', import.meta.url);
  try {
    await access(distEntry);
  } catch {
    throw new Error('缺少 dist/index.html，请先运行 npm run build。');
  }

  const chrome = await findChrome();
  const pageUrl = new URL(distEntry);
  pageUrl.searchParams.set('year', year);
  const outputUrl = new URL(`../output/wallcal-${year}.pdf`, import.meta.url);

  await prepareOutput(outputUrl);
  const exportStartedAt = Date.now();
  const browser = spawnFn(
    chrome,
    [
      '--headless',
      '--disable-gpu',
      '--allow-file-access-from-files',
      '--no-pdf-header-footer',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1000',
      `--print-to-pdf=${fileURLToPath(outputUrl)}`,
      pageUrl.href,
    ],
    { stdio: 'inherit' },
  );
  const result = await waitForExit(browser);
  if (result.timedOut) {
    throw new Error(`浏览器导出超过 ${EXPORT_TIMEOUT_MS / 1_000} 秒，进程已终止。`);
  }
  if (result.code !== 0) {
    throw new Error(`浏览器导出失败（exit code ${result.code ?? 'null'}${result.signal ? `, signal ${result.signal}` : ''}）。`);
  }

  await validatePdf(outputUrl, exportStartedAt);
  return outputUrl;
}

export async function main(argv = process.argv.slice(2)) {
  const year = argv[0] === undefined ? resolveYear(null) : Number(argv[0]);
  if (!isSupportedYear(year)) {
    throw new Error(`年份需在 ${SUPPORTED_YEAR_START}—${SUPPORTED_YEAR_END} 之间（法定节假日数据范围）。`);
  }

  await exportPdf(year);
  console.log(`PDF 已生成：output/wallcal-${year}.pdf`);
}

const isDirectRun = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  main().catch((error) => {
    console.error(`PDF 导出失败：${error.message}`);
    process.exitCode = 1;
  });
}
