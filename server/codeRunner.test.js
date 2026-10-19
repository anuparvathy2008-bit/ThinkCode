import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verifyCpp } from './codeRunner.js';
import { applyVerificationResult, buildAdaptivePrompt, buildDryRun, createSession, recordMentorAnswer, startInvestigation } from './debugLogic.js';

const execFileAsync = promisify(execFile);
let compilerAvailable = true;

try {
  await execFileAsync('g++', ['--version']);
} catch {
  compilerAvailable = false;
}

test('detects a remaining bug after the student fixes only the first issue', { skip: !compilerAvailable }, async () => {
  const code = `#include <iostream>
int main() {
  int n = 5;
  int sum = 1;
  for (int i = 1; i <= n; i++) sum += i;
  std::cout << sum;
}`;
  const result = await verifyCpp({ code, expectedOutput: '15' });

  assert.equal(result.status, 'output-mismatch');
  assert.equal(result.actualOutput, '16');
  assert.equal(result.expectedOutput, '15');
});

test('passes only after compiled code produces the expected output', { skip: !compilerAvailable }, async () => {
  const code = `#include <iostream>
int main() {
  int n = 5;
  int sum = 0;
  for (int i = 1; i <= n; i++) sum += i;
  std::cout << sum;
}`;
  const result = await verifyCpp({ code, expectedOutput: '15' });

  assert.equal(result.status, 'pass', JSON.stringify(result));
  assert.equal(result.actualOutput, '15');
});

test('returns compiler diagnostics for invalid corrected code', { skip: !compilerAvailable }, async () => {
  const result = await verifyCpp({ code: 'int main( {', expectedOutput: '0' });
  const session = createSession('session-compile-error', 'int main() {}', 'Expected output 0.');
  applyVerificationResult(session, 'int main( {', result);

  assert.equal(result.status, 'compile-error');
  assert.match(result.compilerOutput, /error/i);
  assert.equal(session.stage, 'think');
  assert.match(session.errorText, /Compiler error/);
  assert.equal(session.validationResult.compilerOutput, result.compilerOutput);
});

test('returns to Think with the newly observed issue when a second bug remains', { skip: !compilerAvailable }, async () => {
  const originalCode = `#include <iostream>
int main() {
  int n = 5;
  int sum = 1;
  for (int i = 1; i < n; i++) sum += i;
  std::cout << sum;
}`;
  const correctedCode = originalCode.replace('int sum = 1;', 'int sum = 0;');
  const session = createSession('session-multiple-bugs', originalCode, 'For input 5, expected output 15, but output 11.');
  session.currentPrompt = buildAdaptivePrompt(session);
  recordMentorAnswer(session, 'The sum starts at 1 because I initialized it with one.');

  const result = await verifyCpp({ code: correctedCode, input: session.testInput, expectedOutput: session.expectedOutput });
  applyVerificationResult(session, correctedCode, result);

  assert.equal(session.stage, 'think');
  assert.equal(result.status, 'output-mismatch');
  assert.equal(result.actualOutput, '10');
  assert.equal(result.expectedOutput, '15');
  assert.match(session.errorText, /expected output 15.*produced 10/i);
  assert.match(session.currentPrompt, /i < n/);
  assert.match(session.currentPrompt, /output "10"/);
  assert.doesNotMatch(session.currentPrompt, /sum starting at 1/i);
});

test('moves to Verify only after actual output matches expected output', { skip: !compilerAvailable }, async () => {
  const code = `#include <iostream>
int main() {
  int n = 5;
  int sum = 0;
  for (int i = 1; i <= n; i++) sum += i;
  std::cout << sum;
}`;
  const session = createSession('session-verified', code, 'Input 5 should produce 15.');
  const result = await verifyCpp({ code, input: session.testInput, expectedOutput: session.expectedOutput });
  applyVerificationResult(session, code, result);

  assert.equal(session.stage, 'verify');
  assert.equal(result.status, 'pass');
  assert.equal(result.actualOutput, '15');
});

test('compares quoted expected text with actual program output', { skip: !compilerAvailable }, async () => {
  const code = '#include <iostream>\nint main() { std::cout << "hello world"; }';
  const result = await verifyCpp({ code, expectedOutput: 'hello world' });

  assert.equal(result.status, 'pass');
  assert.equal(result.actualOutput, 'hello world');
});

test('continues the exact array debug session through two fixes and compiler verification', { skip: !compilerAvailable }, async () => {
  const originalCode = `#include <iostream>
using namespace std;

int main() {
    int arr[] = {-2, 5, 7, -1, 4};
    int count = 0;

    for (int i = 0; i <= 5; i++) {
        if (arr[i] < 0) {
            count++;
        }
    }

    cout << "Positive numbers = " << count;

    return 0;
}`;
  const errorText = 'Expected: Positive numbers = 3\nActual: Positive numbers = 2';
  const session = createSession('session-array-multiple-bugs', originalCode, errorText);
  session.currentPrompt = startInvestigation(session);

  assert.equal(session.originalCode, originalCode);
  assert.equal(session.expectedOutput, 'Positive numbers = 3');
  assert.equal(session.latestActualOutput, 'Positive numbers = 2');
  assert.match(session.currentPrompt, /i <= 5/);
  assert.match(session.currentPrompt, /arr\[i\]/);
  assert.equal(session.investigation.activeQuestion.location.statement, 'arr[i]');

  recordMentorAnswer(session, 'arr[5] is out of bounds because the valid indexes are 0 through 4.');
  assert.equal(session.stage, 'fix');
  assert.equal(session.currentQuestion, '');
  assert.equal(session.waitingForFix, true);
  assert.equal(session.studentDemonstratedUnderstanding, true);
  assert.equal(session.latestAnswerCorrect, true);
  assert.match(session.mentorAcknowledgment, /fix it and paste your corrected code/i);
  assert.equal(session.mentorHistory.length, 1);
  assert.match(session.mentorHistory[0].answer, /arr\[5\]/);

  const dryRun = buildDryRun(session);
  assert.deepEqual(dryRun.steps.slice(0, 5), [
    'i = 0: valid arr[0] = -2.',
    'i = 1: valid arr[1] = 5.',
    'i = 2: valid arr[2] = 7.',
    'i = 3: valid arr[3] = -1.',
    'i = 4: valid arr[4] = 4.',
  ]);
  assert.match(dryRun.steps.join(' '), /i = 5/);
  assert.match(dryRun.steps.join(' '), /arr\[5\] is outside the array/);

  const boundsFixedCode = originalCode.replace('i <= 5', 'i < 5');
  const firstVerification = await verifyCpp({
    code: boundsFixedCode,
    expectedOutput: session.expectedOutput,
  });
  assert.equal(firstVerification.status, 'output-mismatch');
  assert.equal(firstVerification.actualOutput, 'Positive numbers = 2');
  applyVerificationResult(session, boundsFixedCode, firstVerification);

  assert.equal(session.stage, 'think');
  assert.equal(session.latestActualOutput, 'Positive numbers = 2');
  assert.equal(session.code, boundsFixedCode);
  assert.equal(session.verificationResults.length, 1);
  assert.equal(session.latestSubmittedCode, boundsFixedCode);
  assert.equal(session.isVerifying, false);
  assert.equal(session.anotherBugRemains, true);
  assert.equal(session.fixedBugs.length, 1);
  assert.equal(session.fixedBugs[0].type, 'array-access');
  assert.equal(session.currentBug.type, 'array-predicate');
  assert.equal(session.currentBug.location.statement, 'if (arr[i] < 0) {');
  assert.equal(session.investigation.activeQuestion.location.statement, 'if (arr[i] < 0) {');
  assert.match(session.currentPrompt, /arr\[i\] < 0/);
  assert.doesNotMatch(session.currentPrompt, /i <= 5/);

  const firstPredicateQuestion = session.currentPrompt;
  recordMentorAnswer(session, 'I am not sure how the condition affects the result.');
  assert.equal(session.stage, 'think');
  assert.notEqual(session.currentPrompt, firstPredicateQuestion);
  assert.match(session.currentPrompt, /condition affect the count of positive values/i);

  recordMentorAnswer(session, 'It checks whether the array value is negative.');
  assert.equal(session.stage, 'fix');
  assert.equal(session.currentPrompt, '');
  assert.equal(session.activeHypothesisConfirmed, true);
  assert.equal(session.latestAnswerCorrect, true);
  assert.match(session.mentorAcknowledgment, /fix it and paste your corrected code/i);

  const finalCode = boundsFixedCode.replace('arr[i] < 0', 'arr[i] > 0');
  const finalVerification = await verifyCpp({
    code: finalCode,
    expectedOutput: session.expectedOutput,
  });
  applyVerificationResult(session, finalCode, finalVerification);

  assert.equal(finalVerification.status, 'pass', JSON.stringify(finalVerification));
  assert.equal(finalVerification.actualOutput, 'Positive numbers = 3');
  assert.equal(session.stage, 'verify');
  assert.equal(session.latestActualOutput, 'Positive numbers = 3');
  assert.equal(session.currentQuestion, '');
  assert.equal(session.waitingForFix, false);
  assert.equal(session.isVerifying, false);
  assert.equal(session.anotherBugRemains, false);
  assert.equal(session.isComplete, true);
  assert.equal(session.originalCode, originalCode);
  assert.equal(session.latestExecutionError, '');
  assert.equal(session.correctedCode, finalCode);
  assert.equal(session.latestSubmittedCode, finalCode);
  assert.equal(session.fixedBugs.length, 2);
  assert.deepEqual(session.verificationResults.map(({ status }) => status), ['output-mismatch', 'pass']);
  assert.equal(session.verificationResults[1].actualOutput, 'Positive numbers = 3');
});

test('debugs the exact three-number average bug without blaming the sum statement', { skip: !compilerAvailable }, async () => {
  const code = `#include <iostream>
using namespace std;

int main() {
    int a, b, c;
    cin >> a >> b >> c;

    int sum = a + b + c;
    int average = sum / 2;

    cout << "Average = " << average;

    return 0;
}`;
  const errorText = `Input:
10 20 30

Expected output:
Average = 20

Actual output:
Average = 30`;
  const session = createSession('session-average-integration', code, errorText);
  session.currentPrompt = startInvestigation(session);

  assert.match(session.currentPrompt, /How many values are included in sum/);
  assert.equal(session.investigation.activeQuestion.location.statement, 'int average = sum / 2;');
  recordMentorAnswer(session, '3');
  assert.match(session.currentPrompt, /What should average divide sum by/);
  recordMentorAnswer(session, '3');
  assert.equal(session.stage, 'fix');

  const stillIncorrect = await verifyCpp({ code, input: session.testInput, expectedOutput: session.expectedOutput });
  assert.equal(stillIncorrect.status, 'output-mismatch');
  assert.equal(stillIncorrect.actualOutput, 'Average = 30');
  assert.equal(stillIncorrect.expectedOutput, 'Average = 20');
  applyVerificationResult(session, code, stillIncorrect);
  assert.equal(session.stage, 'think');
  assert.notEqual(session.currentPrompt, 'How many values are included in sum?');
  assert.equal(session.investigation.activeQuestion.location.statement, 'int average = sum / 2;');

  recordMentorAnswer(session, 'The sum line is correct.');
  assert.deepEqual(session.investigation.ruledOutLocations, [{
    lineNumber: 8,
    statement: 'int sum = a + b + c;',
  }]);
  assert.match(session.currentPrompt, /What value does average produce when sum is 60/);
  assert.equal(session.investigation.questions.at(-1).verdict, 'ruled-out-referenced-location');

  recordMentorAnswer(session, '30');
  assert.match(session.currentPrompt, /How does that result compare with the expected average/);
  recordMentorAnswer(session, 'It should be 20, not 30, because the divisor needs to match three values.');
  assert.equal(session.stage, 'fix');
  const correctedCode = code.replace('sum / 2', 'sum / 3');
  const passes = await verifyCpp({ code: correctedCode, input: session.testInput, expectedOutput: session.expectedOutput });
  applyVerificationResult(session, correctedCode, passes);

  assert.equal(passes.status, 'pass');
  assert.equal(passes.actualOutput, 'Average = 20');
  assert.equal(session.stage, 'verify');
});