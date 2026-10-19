import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCode, buildAdaptivePrompt, buildDryRun, createInvestigation, createSession, getConceptExplanationError, parseProblemContext, recordMentorAnswer, startInvestigation } from './debugLogic.js';

const sumLoopCode = `#include <iostream>
using namespace std;
int main() {
    int n;
    cin >> n;
    int sum = 0;
    for (int i = 1; i < n; i++) {
        sum += i;
    }
    cout << "Sum = " << sum;
    return 0;
}`;

const largestNumberCode = `#include <iostream>
using namespace std;
int main() {
  int a, b, c;
  cin >> a >> b >> c;
  int largest = a;
  if (b < largest) {
    largest = b;
  }
  if (c < largest) {
    largest = c;
  }
  cout << largest;
  return 0;
}`;

const averageCode = `#include <iostream>
using namespace std;

int main() {
  int a, b, c;
  cin >> a >> b >> c;

  int sum = a + b + c;
  int average = sum / 2;

  cout << "Average = " << average;

  return 0;
}`;

test('accepts a 20-word explanation and rejects a 10-word explanation', () => {
  const twentyWords = 'I think this loop adds each number before the limit and prints the total after all iterations have finished correctly.';
  const tenWords = 'The loop adds numbers and then prints their total afterward.';

  assert.equal(getConceptExplanationError(twentyWords), null);
  assert.match(getConceptExplanationError(tenWords), /at least 15 words/);
});

test('accepts explanations longer than the recommended range', () => {
  const longExplanation = Array.from({ length: 120 }, (_, index) => `word${index}`).join(' ');
  assert.equal(getConceptExplanationError(longExplanation), null);
});

test('recognizes a sum loop as a boundary issue without array context', () => {
  const session = {
    code: sumLoopCode,
    errorText: 'For input 5, the expected sum is 15 but the program prints 10.',
    conceptExplanation: 'The loop adds values from one up to the input and stores them in a running sum.',
    mentorHistory: [],
  };
  const analysis = analyzeCode(session.code);
  const question = buildAdaptivePrompt(session);

  assert.equal(analysis.focus, 'loop-boundary');
  assert.match(question, /sum/);
  assert.match(question, /i/);
  assert.match(question, /< n/);
  assert.doesNotMatch(question, /array|index/i);
  assert.ok(question.split(/\s+/).length <= 16);
});

test('uses the current answer for the next mentor question', () => {
  const session = createSession('session-loop-followup', sumLoopCode, 'Input 5 should produce 15.');
  session.conceptExplanation = 'The loop adds values into a total.';
  session.currentPrompt = startInvestigation(session);
  recordMentorAnswer(session, 'The loop uses i and n.');
  const question = session.currentPrompt;

  assert.match(question, /You said/);
  assert.match(question, /i < n/);
  assert.match(question, /which values satisfy/i);
  assert.doesNotMatch(question, /array|index/i);
});

test('asks about array bounds only when submitted code contains array access', () => {
  const session = {
    code: 'int values[3] = {1, 2, 3}; for (int i = 0; i <= 3; i++) { total += values[i]; }',
    errorText: 'Index is out of bounds when i is 3.',
    conceptExplanation: 'The loop reads each element and adds it to the total.',
    mentorHistory: [],
  };

  assert.equal(analyzeCode(session.code).focus, 'array-access');
  const prompt = startInvestigation(session);
  assert.match(prompt, /values\[i\]/);
  assert.match(prompt, /i <= 3/);
});

test('does not mistake an array declaration for an indexing issue', () => {
  const analysis = analyzeCode('int values[3] = {1, 2, 3}; int total = 0;');
  assert.equal(analysis.arrayAccess, null);
  assert.equal(analysis.focus, 'code-behavior');
});

test('builds dry-run details from the current session code', () => {
  const dryRun = buildDryRun({
    code: sumLoopCode,
    errorText: 'Input 5 should produce 15.',
  });

  assert.match(dryRun.title, /loop/);
  assert.match(dryRun.steps.join(' '), /sum/);
  assert.doesNotMatch(dryRun.steps.join(' '), /array|index/i);
});

test('a new session starts with no previous debugging state', () => {
  const session = createSession('session-new', 'int current = 1;', 'The result is incorrect.');

  assert.equal(session.code, 'int current = 1;');
  assert.equal(session.errorText, 'The result is incorrect.');
  assert.equal(session.conceptExplanation, '');
  assert.deepEqual(session.mentorHistory, []);
  assert.equal(session.currentPrompt, '');
  assert.equal(session.dryRun, null);
  assert.equal(session.dryRunShown, false);
  assert.equal(session.correctedCode, '');
  assert.equal(session.validationResult, null);
});

test('targets inverted largest-number comparisons and reported output', () => {
  const session = {
    code: largestNumberCode,
    errorText: 'For input 10, 25, 15, the program outputs 10 instead of 25.',
    conceptExplanation: 'The program reads three numbers and compares them to keep track of the largest value.',
    mentorHistory: [],
  };
  const analysis = analyzeCode(session.code);
  const question = buildAdaptivePrompt(session);

  assert.equal(analysis.focus, 'extremum-comparison');
  assert.match(question, /output "10"/);
  assert.match(question, /b < largest/);
  assert.doesNotMatch(question, /using namespace|include/);
  assert.doesNotMatch(question, /change .* to|should be >/i);
  assert.ok(question.split(/\s+/).length <= 16);
});

test('uses the observed rather than expected output in mentor prompts', () => {
  const session = {
    code: largestNumberCode,
    errorText: 'For input 10, 25, 15, expected output is 25 but the program prints 10.',
    conceptExplanation: 'The code compares three values to select the largest.',
    mentorHistory: [],
  };

  assert.match(buildAdaptivePrompt(session), /output "10"/);
  assert.doesNotMatch(buildAdaptivePrompt(session), /output "25"/);
});

test('adapts largest-number follow-up to the current answer', () => {
  const session = createSession('session-largest-followup', largestNumberCode, 'For input 10, 25, 15, output is 10 instead of 25.');
  session.conceptExplanation = 'The program selects a largest number.';
  session.currentPrompt = startInvestigation(session);
  recordMentorAnswer(session, 'The first value remains in largest.');

  const question = session.currentPrompt;
  assert.match(question, /You said/);
  assert.match(question, /b < largest/);
  assert.match(question, /which input satisfies/i);
  assert.ok(question.split(/\s+/).length <= 16);
});

test('moves a learner who explains the loop boundary directly to corrected code', () => {
  const session = createSession('session-loop', sumLoopCode, 'For input 5, expected sum is 15 but the program prints 10.');
  session.conceptExplanation = 'The loop adds values into a running total.';
  session.currentPrompt = buildAdaptivePrompt(session);

  recordMentorAnswer(session, 'No, because i < n stops the loop before n.');

  assert.equal(session.stage, 'fix');
  assert.equal(session.understandsBug, true);
  assert.equal(session.currentPrompt, '');
  assert.match(session.mentorAcknowledgment, /identified the issue/i);
  assert.match(session.mentorAcknowledgment, /corrected code/i);
});

test('extracts stdin and expected output from the problem description', () => {
  assert.deepEqual(parseProblemContext('For input 5, expected output is 15 but the program prints 10.'), {
    testInput: '5\n',
    expectedOutput: '15',
  });
  assert.deepEqual(parseProblemContext('Input: 10, 25, 15. Output 10 instead of 25.'), {
    testInput: '10\n25\n15\n',
    expectedOutput: '25',
  });
});

test('investigates the average divisor, not the correct sum statement', () => {
  const errorText = 'Input 10 20 30. Expected output: Average = 20; actual output: Average = 30.';
  const session = createSession('session-average', averageCode, errorText);
  session.conceptExplanation = 'The program calculates the average of three input numbers and prints the result.';
  session.currentPrompt = startInvestigation(session);

  const analysis = analyzeCode(averageCode);
  assert.equal(analysis.focus, 'average-divisor');
  assert.equal(analysis.averageDivision.numeratorStatement, 'int sum = a + b + c;');
  assert.equal(analysis.averageDivision.statement, 'int average = sum / 2;');
  assert.equal(session.testInput, '10\n20\n30\n');
  assert.equal(session.expectedOutput, 'Average = 20');
  assert.match(session.currentPrompt, /How many values are included in sum/);
  assert.doesNotMatch(session.currentPrompt, /int sum = a \+ b \+ c/);
  assert.equal(session.investigation.activeQuestion.location.statement, 'int average = sum / 2;');
  assert.match(session.investigation.activeQuestion.hypothesis, /divisor 2.*3 values/);
});

test('finds the average divisor when assignments share a line', () => {
  const compactCode = '#include <iostream>\nint main(){int a,b,c; cin>>a>>b>>c; int sum=a+b+c; int average=sum/2; std::cout<<average;}';
  const analysis = analyzeCode(compactCode);

  assert.equal(analysis.focus, 'average-divisor');
  assert.equal(analysis.averageDivision.statement, 'int average=sum/2;');
  assert.equal(analysis.averageDivision.numeratorStatement, 'int sum=a+b+c;');
});

test('keeps a ruled-out statement excluded after its line number changes', () => {
  const correctedSession = createSession('session-shifted-lines', `\n${averageCode.replace('sum / 2', 'sum / 3')}`, 'Input 10 20 30. Expected output: Average = 20.');
  const investigation = createInvestigation(correctedSession, [], [{
    lineNumber: 8,
    statement: 'int sum = a + b + c;',
  }]);

  assert.equal(investigation.ruledOutLocations[0].lineNumber, 9);
  assert.equal(investigation.candidates.some((candidate) => candidate.location.statement === 'int sum = a + b + c;'), false);
});

test('uses answers to narrow average investigation and stops once the divisor is understood', () => {
  const session = createSession(
    'session-average-understood',
    averageCode,
    'Input 10 20 30. Expected output: Average = 20; actual output: Average = 30.',
  );
  session.currentPrompt = startInvestigation(session);
  const firstQuestion = session.currentPrompt;

  recordMentorAnswer(session, '3');
  const secondQuestion = session.currentPrompt;

  assert.equal(session.stage, 'think');
  assert.notEqual(secondQuestion, firstQuestion);
  assert.match(secondQuestion, /What should average divide sum by/);
  assert.equal(session.investigation.questions[0].location.statement, 'int average = sum / 2;');
  assert.equal(session.investigation.questions[0].hypothesis, session.investigation.candidates[0].hypothesis);
  assert.equal(session.investigation.questions[0].answer, '3');
  assert.equal(session.investigation.questions[0].verdict, 'supports-hypothesis');
  assert.deepEqual(session.investigation.questions[0].remainingLocations.map((location) => location.statement), ['int average = sum / 2;']);

  recordMentorAnswer(session, '3 because there are three values.');

  assert.equal(session.stage, 'fix');
  assert.equal(session.understandsBug, true);
  assert.equal(session.currentPrompt, '');
  assert.equal(session.investigation.questions[1].question, secondQuestion);
  assert.equal(session.investigation.questions[1].verdict, 'confirms-hypothesis');
  assert.match(session.mentorAcknowledgment, /paste your corrected code/i);
});

test('rules out a correct sum location without removing the average-divisor hypothesis', () => {
  const session = createSession(
    'session-average-sum-ruled-out',
    averageCode,
    'Input 10 20 30. Expected output: Average = 20; actual output: Average = 30.',
  );
  session.currentPrompt = startInvestigation(session);

  recordMentorAnswer(session, 'The sum line is correct.');

  assert.equal(session.stage, 'think');
  assert.equal(session.investigation.questions[0].verdict, 'ruled-out-referenced-location');
  assert.deepEqual(session.investigation.ruledOutLocations, [{ lineNumber: 8, statement: 'int sum = a + b + c;' }]);
  assert.equal(session.investigation.remainingLocations.length, 1);
  assert.match(session.currentPrompt, /What should average divide sum by/);
  assert.doesNotMatch(session.currentPrompt, /sum line/i);
});