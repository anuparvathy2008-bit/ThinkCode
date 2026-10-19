import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const maxOutputBytes = 1024 * 1024;

function normalizeOutput(value = '') {
  return value.replace(/\r\n/g, '\n').trim().split(/\s+/).filter(Boolean).join(' ');
}

function runExecutableOnce(executable, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let outputExceeded = false;
    let timedOut = false;

    const appendOutput = (current, chunk) => {
      if (Buffer.byteLength(current) + chunk.length > maxOutputBytes) {
        outputExceeded = true;
        child.kill();
        return current;
      }
      return current + chunk.toString();
    };

    child.stdout.on('data', (chunk) => { stdout = appendOutput(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = appendOutput(stderr, chunk); });
    child.once('error', reject);
    child.once('close', (exitCode, signal) => resolve({
      stdout,
      stderr,
      exitCode,
      signal,
      outputExceeded,
      timedOut,
    }));

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 5000);
    child.once('close', () => clearTimeout(timeout));
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

async function runExecutable(executable, input = '') {
  try {
    return await runExecutableOnce(executable, input);
  } catch (error) {
    if (process.platform !== 'win32' || error.code !== 'UNKNOWN') throw error;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return runExecutableOnce(executable, input);
  }
}

export async function verifyCpp({ code, input = '', expectedOutput = null }) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'thinkcode-'));
  const sourcePath = path.join(tempDir, 'corrected.cpp');
  const executablePath = path.join(tempDir, process.platform === 'win32' ? 'corrected.exe' : 'corrected');

  try {
    fs.writeFileSync(sourcePath, code);

    try {
      await execFileAsync('g++', ['-std=c++17', sourcePath, '-o', executablePath], {
        timeout: 15000,
        maxBuffer: maxOutputBytes,
      });
    } catch (error) {
      return {
        status: 'compile-error',
        message: 'Your code did not compile. Review the compiler error and try again.',
        compilerOutput: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim() || error.message,
        actualOutput: '',
        expectedOutput,
      };
    }

    let runResult;
    try {
      runResult = await runExecutable(executablePath, input);
    } catch (error) {
      return {
        status: 'runtime-error',
        message: 'Your code compiled, but could not be started.',
        compilerOutput: error.message,
        actualOutput: '',
        expectedOutput,
      };
    }

    const actualOutput = runResult.stdout.trim();
    if (runResult.timedOut || runResult.outputExceeded || runResult.exitCode !== 0) {
      const reason = runResult.timedOut
        ? 'The program exceeded the 5 second run limit.'
        : runResult.outputExceeded
          ? 'The program exceeded the output limit.'
          : `The program exited with code ${runResult.exitCode}.`;
      return {
        status: 'runtime-error',
        message: reason,
        compilerOutput: runResult.stderr.trim(),
        actualOutput,
        expectedOutput,
      };
    }

    if (expectedOutput === null || expectedOutput === undefined || !String(expectedOutput).trim()) {
      return {
        status: 'unverified',
        message: 'Your code compiled and ran. An expected output was not provided, so correctness could not be confirmed.',
        compilerOutput: '',
        actualOutput,
        expectedOutput: null,
      };
    }

    const matchesExpected = normalizeOutput(actualOutput) === normalizeOutput(String(expectedOutput));
    return {
      status: matchesExpected ? 'pass' : 'output-mismatch',
      message: matchesExpected
        ? 'Your corrected code produced the expected output.'
        : 'Your code ran, but its output does not match the expected result.',
      compilerOutput: '',
      actualOutput,
      expectedOutput: String(expectedOutput).trim(),
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}