import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import {
  findChrome,
  getBrowserCandidates,
  prepareOutput,
  validatePdf,
  waitForExit,
} from '../scripts/export-pdf.js';

test('Windows browser discovery includes standard Edge paths and msedge on PATH', async () => {
  const env = {
    PROGRAMFILES: String.raw`C:\Program Files`,
    'PROGRAMFILES(X86)': String.raw`C:\Program Files (x86)`,
    LOCALAPPDATA: String.raw`C:\Users\tester\AppData\Local`,
    PATH: String.raw`C:\Tools;C:\Windows`,
  };
  const candidates = getBrowserCandidates('win32', env);

  assert.ok(candidates.includes(String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`));
  assert.ok(candidates.includes(String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`));
  assert.ok(candidates.includes(String.raw`C:\Users\tester\AppData\Local\Microsoft\Edge\Application\msedge.exe`));

  const expected = String.raw`C:\Tools\msedge.exe`;
  const browser = await findChrome({
    env,
    platform: 'win32',
    isExecutableFn: async (candidate) => candidate === expected,
  });
  assert.equal(browser, expected);
});

test('PDF output preparation removes stale files and validation requires a fresh PDF', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'wallcal-pdf-test-'));
  const outputPath = join(directory, 'wallcal-2026.pdf');
  const outputUrl = pathToFileURL(outputPath);
  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(directory, { recursive: true, force: true });
  });

  await writeFile(outputPath, '%PDF-stale');
  await prepareOutput(outputUrl);
  await assert.rejects(stat(outputPath), { code: 'ENOENT' });
  await assert.rejects(validatePdf(outputUrl, Date.now()), /未生成 PDF 文件/);

  await writeFile(outputPath, '%PDF-new');
  await utimes(outputPath, new Date(0), new Date(0));
  await assert.rejects(validatePdf(outputUrl, Date.now()), /时间早于本次导出/);

  const exportStartedAt = Date.now();
  await writeFile(outputPath, '%PDF-new');
  await validatePdf(outputUrl, exportStartedAt);

  await writeFile(outputPath, 'not a PDF');
  await assert.rejects(validatePdf(outputUrl, exportStartedAt), /不是有效的 PDF/);
});

test('browser timeout first terminates and then force-kills the process', async () => {
  const child = new EventEmitter();
  const signals = [];
  child.kill = (signal) => {
    signals.push(signal);
    if (signal === 'SIGKILL') setImmediate(() => child.emit('exit', null, signal));
    return true;
  };

  const result = await waitForExit(child, { timeoutMs: 5, terminationGraceMs: 5 });
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
  assert.deepEqual(result, { code: null, signal: 'SIGKILL', timedOut: true });
});
