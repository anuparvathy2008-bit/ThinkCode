export function countWords(value = '') {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function getConceptExplanationError(value = '') {
  return countWords(value) < 15
    ? 'Please explain your thinking a little more. Add at least 15 words before continuing.'
    : null;
}

export function parseProblemContext(errorText = '') {
  const inputMatch = errorText.match(/\binput\s*(?::|=|is)?\s*(-?\d+(?:[\s,]+-?\d+)*)/i);
  const expectedMatch = errorText.match(/\bexpected(?:\s+(?:output|result|sum))?\s*(?::|=|is)?\s*(-?\d+(?:\.\d+)?)/i)
    ?? errorText.match(/\b(?:output|result)\s*(?::|=|is)?\s*-?\d+(?:\.\d+)?\s+instead of\s+(-?\d+(?:\.\d+)?)/i)
    ?? errorText.match(/\bshould\s+(?:produce|print|output)\s+(-?\d+(?:\.\d+)?)/i);
  const expectedTextMatch = errorText.match(/\bexpected(?:\s+output)?\s*(?::|=|is)\s*(?:"([^"]+)"|'([^']+)'|([^;\r\n.!?]+))/i);
  const expectedText = expectedTextMatch?.[1] ?? expectedTextMatch?.[2] ?? expectedTextMatch?.[3];

  return {
    testInput: inputMatch ? `${inputMatch[1].trim().split(/[\s,]+/).join('\n')}\n` : '',
    expectedOutput: expectedMatch?.[1] ?? expectedText?.split(/\s+(?:but|however|actual(?:ly)?\s+output)\b/i)[0].trim() ?? null,
  };
}

export function createSession(sessionId, code = '', errorText = '') {
  const problemContext = parseProblemContext(errorText);
  const initialActualOutput = observedOutput(errorText);
  const session = {
    sessionId,
    originalCode: code,
    code,
    errorText,
    originalErrorText: errorText,
    testInput: problemContext.testInput,
    expectedOutput: problemContext.expectedOutput,
    latestActualOutput: initialActualOutput,
    latestSubmittedCode: code,
    latestExecutionError: '',
    conceptExplanation: '',
    mentorHistory: [],
    currentPrompt: '',
    currentQuestion: '',
    currentBug: null,
    activeBugLocation: null,
    activeHypothesis: '',
    activeHypothesisConfirmed: false,
    latestStudentAnswer: '',
    latestAnswerCorrect: null,
    studentDemonstratedUnderstanding: false,
    waitingForFix: false,
    pendingBugFix: null,
    fixedBugs: [],
    rejectedBugs: [],
    isVerifying: false,
    anotherBugRemains: false,
    isComplete: false,
    investigation: null,
    understandsBug: false,
    mentorAcknowledgment: '',
    stage: 'explain',
    dryRun: null,
    dryRunShown: false,
    correctedCode: '',
    validationResult: null,
    verificationResults: [],
  };
  session.investigation = createInvestigation(session);
  return session;
}

function shorten(value, maxLength = 64) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 3)}...`
    : normalized;
}

function observedOutput(value) {
  const match = value.match(/\bactual(?:\s+(?:output|result))?\s*(?::|=|is)?\s*(.+?)(?:[,.!?]|$)/i)
    ?? value.match(/\b(?:but|while)\s+(?:the\s+)?(?:program\s+)?(?:outputs?|prints?)\s+(?:is\s+)?(.+?)(?:[,.!?]|$)/i)
    ?? value.match(/\b(?:program|code)\s+(?:outputs?|prints?)\s+(?:is\s+)?(.+?)(?:\s+instead of\b|[,.!?]|$)/i)
    ?? value.match(/\b(?:produced|printed)\s+(.+?)(?:[,.!?]|$)/i)
    ?? value.match(/\b(?:outputs?|prints?)\s+(?:is\s+)?(.+?)\s+instead of\b/i)
    ?? value.match(/\b(?:outputs?|prints?)\s+(?:is\s+)?(.+?)(?:[,.!?]|$)/i);
  return match?.[1].trim() ?? match?.[2].trim() ?? '';
}

export function analyzeCode(code = '') {
  const source = code.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
  const lines = source.split(/\r?\n/);
  const assignments = [...source.matchAll(/(?:^|(?<=[;{}]))\s*(?:(?:const\s+)?(?:unsigned\s+)?(?:int|float|double|long(?:\s+long)?|auto)\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);/g)]
    .map((match) => {
      const identifierIndex = match.index + match[0].lastIndexOf(match[1]);
      const lineNumber = source.slice(0, identifierIndex).split(/\r?\n/).length;
      return {
        name: match[1],
        expression: match[2].trim(),
        line: match[0].trim().replace(/^[;{}]\s*/, ''),
        lineNumber,
      };
    });
  const averageAssignment = assignments.find((assignment) => /\b(?:average|avg|mean)\b/i.test(assignment.name));
  const divisionMatch = averageAssignment?.expression.match(/^([A-Za-z_]\w*)\s*\/\s*(\d+)$/);
  const numeratorAssignment = divisionMatch
    ? assignments.find((assignment) => assignment.name === divisionMatch[1])
    : null;
  const summedTerms = numeratorAssignment?.expression.split('+').map((term) => term.trim()).filter(Boolean) ?? [];
  const averageDivision = divisionMatch && summedTerms.length > 1 && Number(divisionMatch[2]) !== summedTerms.length
    ? {
        lineNumber: averageAssignment.lineNumber,
        statement: averageAssignment.line.trim(),
        target: averageAssignment.name,
        numerator: divisionMatch[1],
        divisor: Number(divisionMatch[2]),
        count: summedTerms.length,
        numeratorStatement: numeratorAssignment.line.trim(),
        numeratorLineNumber: numeratorAssignment.lineNumber,
        terms: summedTerms,
      }
    : null;
  const loopMatch = source.match(/for\s*\(\s*(?:(?:const|unsigned|long|short|int|size_t|auto)\s+)?([A-Za-z_]\w*)\s*=\s*([^;]+);\s*([^;]+);\s*([^)]+)\)/);
  const arrayMatch = source.match(/\b(?:int|char|float|double|bool|long|short)\s+([A-Za-z_]\w*)\s*\[\s*([^\]]*)\s*\]/);
  const accessMatch = [...source.matchAll(/\b([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]/g)]
    .find((match) => !/\b(?:int|char|float|double|bool|long|short)\s+$/.test(source.slice(0, match.index)));
  const arrayPredicateMatch = source.match(/if\s*\(\s*([A-Za-z_]\w*)\s*\[\s*([^\]]+)\s*\]\s*(<=|>=|==|!=|<|>)\s*(-?\d+)\s*\)\s*\{?\s*([A-Za-z_]\w*)\s*(\+\+|\+=\s*1)\s*;?/);
  const accumulationMatch = source.match(/\b([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=)\s*([^;]+);/)
    ?? source.match(/\b([A-Za-z_]\w*)\s*=\s*\1\s*([+-])\s*([^;]+);/);
  const accumulatorInitialValue = accumulationMatch
    ? source.match(new RegExp(`\\b${accumulationMatch[1]}\\s*=\\s*(-?\\d+(?:\\.\\d+)?)\\s*;`))?.[1]
    : null;
  const extremumMatch = [...source.matchAll(/if\s*\(\s*([A-Za-z_]\w*)\s*(<=|>=|<|>)\s*([A-Za-z_]\w*)\s*\)\s*\{?\s*([A-Za-z_]\w*)\s*=\s*([A-Za-z_]\w*)\s*;\s*\}?/g)]
    .map((match) => {
      const [, left, operator, right, assignedTo, assignedValue] = match;
      const target = [left, right].find((name) => name === assignedTo && /largest|maximum|(^|_)max(?:[A-Z_]|$)|smallest|minimum|(^|_)min(?:[A-Z_]|$)/i.test(name));

      if (!target || assignedValue === target) return null;

      const isMaximum = /largest|maximum|(^|_)max(?:[A-Z_]|$)/i.test(target);
      const candidate = target === left ? right : left;
      if (candidate !== assignedValue) return null;

      const suspectOperator = target === right
        ? (isMaximum ? '<' : '>')
        : (isMaximum ? '>' : '<');
      if (operator !== suspectOperator && operator !== `${suspectOperator}=`) return null;

      const initializationMatch = source.match(new RegExp(`\\b${target}\\s*=\\s*([^;]+);`));
      const lineNumber = source.slice(0, match.index).split(/\r?\n/).length;
      return {
        target,
        candidate,
        operator,
        condition: `${left} ${operator} ${right}`,
        initialization: initializationMatch?.[1].trim() ?? '',
        statement: lines[lineNumber - 1].trim(),
        assignment: `${target} = ${candidate}`,
        lineNumber,
      };
    })
    .find(Boolean);

  const loop = loopMatch
    ? {
        iterator: loopMatch[1],
        start: loopMatch[2].trim(),
        condition: loopMatch[3].trim(),
        update: loopMatch[4].trim(),
        lineNumber: source.slice(0, loopMatch.index).split(/\r?\n/).length,
      }
    : null;

  const arrayAccess = accessMatch
    ? {
        name: accessMatch[1],
        index: accessMatch[2].trim(),
        size: arrayMatch?.[1] === accessMatch[1] && arrayMatch[2].trim() ? arrayMatch[2].trim() : null,
        lineNumber: source.slice(0, accessMatch.index).split(/\r?\n/).length,
      }
    : null;
  const arrayInitializer = arrayAccess
    ? source.match(new RegExp(`\\b(?:int|char|float|double|bool|long|short)\\s+${arrayAccess.name}\\s*\\[[^\\]]*\\]\\s*=\\s*\\{([^}]*)\\}`))
    : null;
  if (arrayAccess) {
    arrayAccess.values = arrayInitializer
      ? arrayInitializer[1].split(',').map((value) => value.trim()).filter(Boolean)
      : null;
    if (!arrayAccess.size && arrayAccess.values) arrayAccess.size = String(arrayAccess.values.length);
  }
  const arrayPredicate = arrayPredicateMatch
    ? {
        array: arrayPredicateMatch[1],
        index: arrayPredicateMatch[2].trim(),
        operator: arrayPredicateMatch[3],
        value: Number(arrayPredicateMatch[4]),
        counter: arrayPredicateMatch[5],
        statement: lines[source.slice(0, arrayPredicateMatch.index).split(/\r?\n/).length - 1].trim(),
        lineNumber: source.slice(0, arrayPredicateMatch.index).split(/\r?\n/).length,
      }
    : null;

  const arrayLoopIsUnsafe = Boolean(arrayAccess && (
    !loop
    || arrayAccess.index !== loop.iterator
    || !arrayAccess.size
    || !/^\d+$/.test(arrayAccess.size)
    || !/^\d+$/.test(loop.start)
    || (() => {
      const condition = loop.condition.match(new RegExp(`^\\s*${loop.iterator}\\s*(<=|<)\\s*(\\d+)\\s*$`));
      if (!condition) return true;
      const [, operator, boundText] = condition;
      const start = Number(loop.start);
      const bound = Number(boundText);
      const size = Number(arrayAccess.size);
      return start < 0 || start >= size || (operator === '<' ? bound > size : bound >= size);
    })()
  ));
  const accumulation = accumulationMatch
    ? {
        name: accumulationMatch[1],
        operator: accumulationMatch[2],
        expression: accumulationMatch[3].trim(),
      }
    : null;
  const accumulatorInitialization = accumulatorInitialValue && Number(accumulatorInitialValue) !== 0
    ? { name: accumulation.name, value: accumulatorInitialValue }
    : null;

  return {
    lines,
    assignments,
    averageDivision,
    loop,
    arrayAccess,
    arrayPredicate,
    arrayLoopIsUnsafe,
    accumulation,
    accumulatorInitialization,
    extremum: extremumMatch,
    focus: averageDivision
      ? 'average-divisor'
      : arrayLoopIsUnsafe
      ? 'array-access'
      : arrayPredicate
        ? 'array-predicate'
      : extremumMatch
        ? 'extremum-comparison'
        : accumulatorInitialization
          ? 'accumulator-initialization'
          : loop && accumulation
            ? 'loop-boundary'
            : 'code-behavior',
  };
}

function investigationCandidate(type, location, hypothesis, details = {}) {
  const statement = location.statement ?? location.sourceLine ?? location.condition ?? `${location.name ?? location.target ?? 'code'} at line ${location.lineNumber}`;
  return {
    id: `${type}:${location.lineNumber}`,
    type,
    location: { lineNumber: location.lineNumber, statement },
    hypothesis,
    status: 'open',
    questionCount: 0,
    ...details,
  };
}

export function createInvestigation(session, previousQuestions = [], previousRuledOutLocations = []) {
  const analysis = analyzeCode(session.code);
  const candidates = [];

  if (analysis.averageDivision) {
    const average = analysis.averageDivision;
    const priorQuestionsAtLine = previousQuestions.filter((record) => record.location?.lineNumber === average.lineNumber);
    const averagePhases = ['count', 'divisor', 'divisor-retry', 'trace-result', 'compare-result', 'identify-terms'];
    const numericInputs = (session.testInput ?? '').trim().split(/\s+/).map(Number).filter(Number.isFinite);
    const numeratorValue = numericInputs.length === average.count
      ? numericInputs.reduce((total, value) => total + value, 0)
      : null;
    candidates.push(investigationCandidate(
      'average-divisor',
      average,
      `The divisor ${average.divisor} may not match the ${average.count} values in ${average.numerator}.`,
      {
        ...average,
        numeratorValue,
        phase: averagePhases[Math.min(priorQuestionsAtLine.length, averagePhases.length - 1)],
      },
    ));
  } else {
    if (analysis.arrayAccess && analysis.arrayLoopIsUnsafe) {
      const location = {
        ...analysis.arrayAccess,
        statement: `${analysis.arrayAccess.name}[${analysis.arrayAccess.index}]`,
      };
      candidates.push(investigationCandidate(
        'array-access',
        location,
        `The access ${analysis.arrayAccess.name}[${analysis.arrayAccess.index}] may not be valid for this array.`,
        analysis.arrayAccess,
      ));
    }
    const expectedOutput = String(session.expectedOutput ?? '');
    const expectsPositiveCount = /\bpositive\b/i.test(expectedOutput);
    const predicateCountsNonPositive = analysis.arrayPredicate
      && ['<', '<='].includes(analysis.arrayPredicate.operator)
      && analysis.arrayPredicate.value <= 0;
    if (expectsPositiveCount && predicateCountsNonPositive) {
      candidates.push(investigationCandidate(
        'array-predicate',
        analysis.arrayPredicate,
        `${analysis.arrayPredicate.statement} counts non-positive values, but the expected result is a positive count.`,
        analysis.arrayPredicate,
      ));
    }
    if (analysis.extremum) {
      candidates.push(investigationCandidate(
        'extremum-comparison',
        analysis.extremum,
        `The condition ${analysis.extremum.condition} may select the wrong value for ${analysis.extremum.target}.`,
        analysis.extremum,
      ));
    }
    if (analysis.accumulatorInitialization) {
      const statement = analysis.assignments.find((assignment) => assignment.name === analysis.accumulatorInitialization.name);
      candidates.push(investigationCandidate(
        'accumulator-initialization',
        statement,
        `${statement.name} may begin with an unexpected value.`,
        analysis.accumulatorInitialization,
      ));
    }
    if (analysis.loop && analysis.accumulation) {
      candidates.push(investigationCandidate(
        'loop-boundary',
        analysis.loop,
        `The loop condition ${analysis.loop.condition} may omit or include a value incorrectly.`,
        { loop: analysis.loop, accumulation: analysis.accumulation },
      ));
    }

    if (!candidates.length) {
      const statements = analysis.lines.map((line, index) => ({ line: line.trim(), lineNumber: index + 1 }))
        .filter(({ line }) => line && !line.startsWith('#') && !/^using\s+namespace\b/.test(line))
        .filter(({ line }) => /^(?:if|while)\s*\(/.test(line) || /\b[A-Za-z_]\w*\s*=\s*[^=].*[+*/%-]/.test(line))
        .filter(({ line }) => !/^(?:cin|cout)\s*(?:>>|<<)/.test(line));

      for (const location of statements) {
        candidates.push(investigationCandidate(
          'statement',
          { ...location, statement: location.line },
          `This condition or calculation may affect the reported result.`,
        ));
      }
    }
  }

  const lines = session.code.split(/\r?\n/).map((line) => line.trim());
  const ruledOutLocations = previousRuledOutLocations.flatMap((location) => {
    const updatedLine = lines.findIndex((line) => line === location.statement);
    return updatedLine < 0 ? [] : [{ ...location, lineNumber: updatedLine + 1 }];
  });
  const activeCandidates = candidates.filter((candidate) => !ruledOutLocations.some((location) =>
  location.statement === candidate.location.statement)
  && !session.fixedBugs?.some((bug) => bug.type === candidate.type
    && bug.location.statement === candidate.location.statement));

  return {
    candidates: activeCandidates,
    currentCandidateId: activeCandidates[0]?.id ?? null,
    remainingLocations: activeCandidates.map((candidate) => candidate.location),
    ruledOutLocations,
    questions: previousQuestions,
    activeQuestion: null,
    lastVerdict: null,
    fallbackQuestionCount: previousQuestions.filter((record) => record.location === null).length,
  };
}

function currentCandidate(session) {
  return session.investigation?.candidates.find((candidate) => candidate.id === session.investigation.currentCandidateId
    && !['ruled-out', 'confirmed', 'exhausted'].includes(candidate.status))
    ?? session.investigation?.candidates.find((candidate) => !['ruled-out', 'confirmed', 'exhausted'].includes(candidate.status));
}

function makeQuestion(session, candidate) {
  const analysis = analyzeCode(session.code);
  const output = observedOutput(session.errorText ?? '');
  const answerPrefix = candidate.lastAnswer ? `You said "${shorten(candidate.lastAnswer, 48)}"; ` : '';

  if (candidate.type === 'average-divisor') {
    if (candidate.phase === 'count') return `How many values are included in ${candidate.numerator}?`;
    if (candidate.phase === 'identify-terms') return `What values does "${candidate.numeratorStatement}" add together?`;
    if (candidate.phase === 'divisor') return `What should ${candidate.target} divide ${candidate.numerator} by?`;
    if (candidate.phase === 'divisor-retry') {
      if (candidate.questionCount < 3) return `Which divisor matches the ${candidate.count} values being averaged?`;
      const expected = parseSmallNumber(String(session.expectedOutput ?? ''));
      return expected !== null && candidate.numeratorValue !== null
        ? `What divisor turns ${candidate.numeratorValue} into the expected ${expected}?`
        : `What divisor accounts for all ${candidate.count} values?`;
    }
    if (candidate.phase === 'trace-result') {
      return candidate.numeratorValue === null
        ? `What value does ${candidate.target} produce from ${candidate.numerator}?`
        : `What value does ${candidate.target} produce when ${candidate.numerator} is ${candidate.numeratorValue}?`;
    }
    if (candidate.phase === 'compare-result') return `How does that result compare with the expected average?`;
    return `Could dividing ${candidate.numerator} by ${candidate.divisor} explain output "${shorten(output || 'the reported result', 24)}"?`;
  }

  if (candidate.type === 'array-access') {
    const questions = [
      `Could "${analysis.loop?.condition ?? `${candidate.name}[${candidate.index}]`}" cause the issue at "${candidate.name}[${candidate.index}]"?`,
      analysis.loop
        ? `${answerPrefix}what index does ${analysis.loop.iterator} use on its last loop pass?`
        : `${answerPrefix}what value is used as the index in ${candidate.name}[${candidate.index}]?`,
      candidate.size
        ? `${answerPrefix}which indexes are valid for ${candidate.name} with size ${candidate.size}?`
        : `${answerPrefix}how does the index in ${candidate.name}[${candidate.index}] relate to the error?`,
    ];
    return questions[Math.min(candidate.questionCount, questions.length - 1)];
  }
  if (candidate.type === 'array-predicate') {
    return candidate.questionCount < 1
      ? `What does "${candidate.array}[${candidate.index}] ${candidate.operator} ${candidate.value}" check?`
      : `How does this condition affect the count of positive values?`;
  }
  if (candidate.type === 'extremum-comparison') {
    const questions = [
      `Does "${candidate.condition}" explain output "${shorten(output || 'the reported result', 24)}"?`,
      `${answerPrefix}which input satisfies "${candidate.condition}"?`,
      `${answerPrefix}which value does ${candidate.target} keep after "${candidate.condition}"?`,
    ];
    return questions[Math.min(candidate.questionCount, questions.length - 1)];
  }
  if (candidate.type === 'accumulator-initialization') {
    const questions = [
      `Could ${candidate.name} starting at ${candidate.value} explain output "${shorten(output || 'the incorrect result', 24)}"?`,
      `${answerPrefix}what value does ${candidate.name} contain before the calculation starts?`,
      `${answerPrefix}how does that starting value affect the final result?`,
    ];
    return questions[Math.min(candidate.questionCount, questions.length - 1)];
  }
  if (candidate.type === 'loop-boundary') {
    const questions = [
      `Does "${candidate.loop.condition}" explain ${candidate.accumulation.name} output "${shorten(output || 'the incorrect result', 24)}"?`,
      `${answerPrefix}which values satisfy "${candidate.loop.condition}"?`,
      `${answerPrefix}which value is skipped before ${candidate.accumulation.name} is printed?`,
    ];
    return questions[Math.min(candidate.questionCount, questions.length - 1)];
  }

  if (candidate.type === 'statement') {
    const questions = [
      `Could "${shorten(candidate.location.statement, 40)}" cause output "${shorten(output || 'the reported result', 24)}"?`,
      `${answerPrefix}what does "${shorten(candidate.location.statement, 40)}" do with these inputs?`,
      `${answerPrefix}how does "${shorten(candidate.location.statement, 40)}" affect the result?`,
    ];
    return questions[Math.min(candidate.questionCount, questions.length - 1)];
  }

  return `Could "${shorten(candidate.location.statement, 40)}" explain the reported result?`;
}

function publishQuestion(session) {
  const investigation = session.investigation;
  const candidate = currentCandidate(session);
  if (!candidate) {
    const fallbackQuestions = [
      `Which other calculation could affect output "${shorten(observedOutput(session.errorText ?? '') || 'the reported result', 24)}"?`,
      'Which remaining statement should we trace with these inputs?',
      'What evidence points to a code location we have not checked yet?',
    ];
    while (fallbackQuestions[investigation.fallbackQuestionCount]
      && investigation.questions.some((record) => record.question === fallbackQuestions[investigation.fallbackQuestionCount])) {
      investigation.fallbackQuestionCount += 1;
    }
    const question = fallbackQuestions[investigation.fallbackQuestionCount];
    if (!question) {
      investigation.activeQuestion = null;
      session.currentPrompt = '';
      return '';
    }
    investigation.fallbackQuestionCount += 1;
    investigation.activeQuestion = {
      candidateId: null,
      location: null,
      hypothesis: 'The current candidates have been ruled out; another calculation may explain the result.',
      question,
      phase: 'remaining-code',
    };
    session.currentPrompt = question;
    session.currentQuestion = question;
    session.activeBugLocation = null;
    session.activeHypothesis = investigation.activeQuestion.hypothesis;
    session.activeHypothesisConfirmed = false;
    session.currentBug = null;
    return session.currentPrompt;
  }

  investigation.currentCandidateId = candidate.id;
  const question = makeQuestion(session, candidate);
  if (investigation.questions.some((record) => record.question === question)) {
    const maxQuestions = candidate.type === 'average-divisor' ? 6 : 3;
    if (candidate.questionCount >= maxQuestions) {
      candidate.status = 'exhausted';
      refreshRemainingLocations(investigation);
      return publishQuestion(session);
    }
    candidate.questionCount += 1;
    return publishQuestion(session);
  }
  candidate.questionCount += 1;
  investigation.activeQuestion = {
    candidateId: candidate.id,
    location: candidate.location,
    hypothesis: candidate.hypothesis,
    question,
    phase: candidate.phase ?? 'diagnose',
  };
  session.currentPrompt = question;
  session.currentQuestion = question;
  session.activeBugLocation = { ...candidate.location };
  session.activeHypothesis = candidate.hypothesis;
  session.activeHypothesisConfirmed = false;
  session.currentBug = {
    type: candidate.type,
    location: { ...candidate.location },
    hypothesis: candidate.hypothesis,
  };
  return question;
}

export function startInvestigation(session) {
  if (!session.investigation) session.investigation = createInvestigation(session);
  return publishQuestion(session);
}

function parseSmallNumber(answer) {
  const match = answer.match(/\b\d+\b/);
  if (match) return Number(match[0]);
  const words = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  return Object.entries(words).find(([word]) => new RegExp(`\\b${word}\\b`, 'i').test(answer))?.[1] ?? null;
}

function isRulingOutCandidate(candidate, answer) {
  const normalized = answer.toLowerCase();
  const saysNotCause = /\b(not the issue|not causing|isn't causing|is not causing|is correct|looks correct|seems correct|is fine|is unrelated|cannot cause|can't cause)\b/.test(normalized);
  if (!saysNotCause) return false;

  const identifiers = candidate.location.statement.match(/[A-Za-z_]\w*/g) ?? [];
  return identifiers.some((identifier) => new RegExp(`\\b${identifier}\\b`, 'i').test(normalized));
}

function refreshRemainingLocations(investigation) {
  investigation.remainingLocations = investigation.candidates
    .filter((candidate) => !['ruled-out', 'confirmed', 'exhausted'].includes(candidate.status))
    .map((candidate) => candidate.location);
  if (investigation.currentCandidateId && !investigation.remainingLocations.some((location) => {
    const active = investigation.candidates.find((candidate) => candidate.id === investigation.currentCandidateId);
    return active && location.lineNumber === active.location.lineNumber;
  })) {
    investigation.currentCandidateId = investigation.candidates.find((candidate) => !['ruled-out', 'confirmed', 'exhausted'].includes(candidate.status))?.id ?? null;
  }
}

export function buildAdaptivePrompt(session) {
  if (!session.investigation) session.investigation = createInvestigation(session);
  return publishQuestion(session);
}

export function buildDryRun(session) {
  const { loop, arrayAccess, arrayPredicate, arrayLoopIsUnsafe, accumulation, focus } = analyzeCode(session.code);
  const activeType = session.investigation?.activeQuestion?.candidateId?.split(':')[0];

  if ((activeType === 'array-access' || focus === 'array-access') && arrayAccess && arrayLoopIsUnsafe) {
    const size = Number(arrayAccess.size);
    const start = Number(loop.start);
    const steps = arrayAccess.values
      ? arrayAccess.values.slice(0, size).map((value, index) => `i = ${index}: valid ${arrayAccess.name}[${index}] = ${value}.`)
      : Array.from({ length: size }, (_, index) => `i = ${index}: valid access ${arrayAccess.name}[${index}].`);
    const condition = loop.condition.match(new RegExp(`^\\s*${loop.iterator}\\s*(<=|<)\\s*(\\d+)\\s*$`));
    if (condition) {
      const [, operator, boundText] = condition;
      const bound = Number(boundText);
      const lastIndex = operator === '<' ? bound - 1 : bound;
      if (lastIndex >= size) {
        steps.push(`The loop reaches i = ${lastIndex}, so it tries ${arrayAccess.name}[${lastIndex}].`);
        steps.push(`${arrayAccess.name} has valid indexes 0 through ${size - 1}; ${arrayAccess.name}[${lastIndex}] is outside the array.`);
      }
    } else {
      steps.push(`The loop starts at ${loop.iterator} = ${start} and checks "${loop.condition}" before accessing ${arrayAccess.name}[${loop.iterator}].`);
      steps.push(`The array has valid indexes 0 through ${size - 1}; trace the first index at or beyond ${size}.`);
    }
    return { title: 'Dry run: array bounds in your code', steps };
  }

  if ((activeType === 'array-predicate' || focus === 'array-predicate') && arrayPredicate) {
    const values = arrayAccess?.values?.map((value, index) => {
      const number = Number(value);
      const matches = arrayPredicate.operator === '<' ? number < arrayPredicate.value
        : arrayPredicate.operator === '<=' ? number <= arrayPredicate.value
          : arrayPredicate.operator === '>' ? number > arrayPredicate.value
            : arrayPredicate.operator === '>=' ? number >= arrayPredicate.value
              : arrayPredicate.operator === '==' ? number === arrayPredicate.value
                : number !== arrayPredicate.value;
      return `${arrayPredicate.array}[${index}] = ${value}: ${matches ? 'counted' : 'skipped'}.`;
    }) ?? [];
    return {
      title: 'Dry run: current array condition',
      steps: [
        ...values,
        `The condition "${arrayPredicate.array}[${arrayPredicate.index}] ${arrayPredicate.operator} ${arrayPredicate.value}" adds matching values to ${arrayPredicate.counter}.`,
        `Compare the values it counts with the expected result: "${shorten(String(session.expectedOutput ?? 'not provided'))}".`,
      ],
    };
  }

  if (focus === 'loop-boundary') {
    return {
      title: 'Dry run: loop and accumulated value',
      steps: [
        `The loop begins with ${loop.iterator} = ${loop.start}.`,
        `Before each pass, it checks "${loop.condition}".`,
        `During each pass, ${accumulation.name} is updated using "${accumulation.expression}".`,
        `After each pass, the loop applies "${loop.update}".`,
        `Compare the values visited and the final ${accumulation.name} with the reported problem: "${shorten(session.errorText || 'No separate error description was provided.') }".`,
      ],
    };
  }

  return {
    title: 'Dry run: trace your submitted code',
    steps: [
      'Start with the values provided by the current input or problem description.',
      `Trace each line of the submitted code in order: "${shorten(session.code)}".`,
      `Compare the final behavior with the reported issue: "${shorten(session.errorText || 'No separate error description was provided.') }".`,
    ],
  };
}

export function demonstratesUnderstanding(session, answer, candidate = null) {
  const analysis = analyzeCode(session.code);
  const normalizedAnswer = answer.toLowerCase();

  if (candidate?.type === 'array-predicate') {
    return /\bnegative\b/.test(normalizedAnswer)
      && (/\b(check|checks|test|tests|less than|below|under)\b/.test(normalizedAnswer)
        || normalizedAnswer.includes(`${candidate.array}[${candidate.index}]`));
  }

  if (candidate?.type === 'array-access') {
    const escapedIndex = candidate.index.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionsArrayOrIndex = normalizedAnswer.includes(candidate.name.toLowerCase())
      || new RegExp(`\\b${escapedIndex}\\b`).test(normalizedAnswer)
      || /\bindex(?:es)?\b/.test(normalizedAnswer);
    const mentionsBounds = /\b(out of bounds|outside|invalid|past the end|past|beyond|too far|valid|size|length)\b/.test(normalizedAnswer);
    return mentionsArrayOrIndex && mentionsBounds;
  }

  const showsReasoning = /\b(because|since|means|false|true|stops|before|after|greater|larger|less|smaller|not|doesn't|does not|won't|will not|excludes|includes|outside|invalid|past|reaches)\b/.test(normalizedAnswer);
  if (!showsReasoning) return false;

  if (analysis.focus === 'extremum-comparison') {
    return normalizedAnswer.includes(analysis.extremum.target.toLowerCase())
      && normalizedAnswer.includes(analysis.extremum.candidate.toLowerCase());
  }

  if (analysis.focus === 'loop-boundary') {
    const [iterator, boundary] = analysis.loop.condition.match(/[A-Za-z_]\w*/g) ?? [];
    return Boolean(iterator && boundary)
      && normalizedAnswer.includes(iterator.toLowerCase())
      && normalizedAnswer.includes(boundary.toLowerCase())
      && /\b(before|stops|excludes|doesn't include|does not include|not include|less than|ends at|reach)\b/.test(normalizedAnswer);
  }

  if (analysis.focus === 'accumulator-initialization') {
    return normalizedAnswer.includes(analysis.accumulatorInitialization.name.toLowerCase())
      && normalizedAnswer.includes(analysis.accumulatorInitialization.value)
      && /\b(because|since|starts|starting|initial|should|instead|extra|already)\b/.test(normalizedAnswer);
  }

  return false;
}

export function recordMentorAnswer(session, answer) {
  const trimmedAnswer = answer.trim();
  session.latestStudentAnswer = trimmedAnswer;
  session.latestAnswerCorrect = false;
  const investigation = session.investigation ?? createInvestigation(session);
  session.investigation = investigation;
  if (!investigation.activeQuestion) publishQuestion(session);

  const activeQuestion = investigation.activeQuestion;
  const candidate = investigation.candidates.find((entry) => entry.id === activeQuestion.candidateId);
  session.mentorHistory.push({
    question: activeQuestion.question,
    answer: trimmedAnswer,
    location: activeQuestion.location,
    hypothesis: activeQuestion.hypothesis,
  });

  let verdict = 'needs-follow-up';
  let understood = false;

  if (candidate?.type === 'average-divisor') {
    const answerNumber = parseSmallNumber(trimmedAnswer);
    const normalized = trimmedAnswer.toLowerCase();
    const saysAverageIsCorrect = /\b(average|divide|divisor)\b/.test(normalized)
      && /\b(correct|fine|right|not the issue|not wrong)\b/.test(normalized);
    const mentionsNumerator = normalized.includes(candidate.numerator.toLowerCase())
      && /\b(correct|fine|right|not the issue|not wrong)\b/.test(normalized);

    candidate.lastAnswer = trimmedAnswer;
    if (saysAverageIsCorrect) {
      verdict = 'rejects-hypothesis';
      candidate.status = 'ruled-out';
      investigation.ruledOutLocations.push(candidate.location);
      if (!session.rejectedBugs.some((bug) => bug.location.statement === candidate.location.statement)) {
        session.rejectedBugs.push({
          type: candidate.type,
          location: { ...candidate.location },
          answer: trimmedAnswer,
        });
      }
    } else if (mentionsNumerator) {
      const numeratorLocation = { lineNumber: candidate.numeratorLineNumber, statement: candidate.numeratorStatement };
      if (!investigation.ruledOutLocations.some((location) => location.lineNumber === numeratorLocation.lineNumber)) {
        investigation.ruledOutLocations.push(numeratorLocation);
      }
      verdict = 'ruled-out-referenced-location';
      candidate.phase = candidate.phase === 'count'
        ? 'divisor'
        : candidate.phase === 'divisor'
          ? 'divisor-retry'
          : candidate.phase === 'divisor-retry'
            ? 'trace-result'
            : 'compare-result';
    } else if (candidate.phase === 'count' && answerNumber === candidate.count) {
      verdict = 'supports-hypothesis';
      candidate.status = 'supported';
      candidate.phase = 'divisor';
    } else if (candidate.phase === 'count') {
      verdict = 'count-not-established';
      candidate.phase = 'identify-terms';
    } else if ((candidate.phase === 'divisor' || candidate.phase === 'divisor-retry') && answerNumber === candidate.count) {
      verdict = 'confirms-hypothesis';
      candidate.status = 'confirmed';
      understood = true;
    } else if (candidate.phase === 'trace-result') {
      const actualValue = parseSmallNumber(observedOutput(session.errorText ?? ''));
      if (answerNumber !== null && answerNumber === actualValue) {
        verdict = 'traces-observed-output';
        candidate.phase = 'compare-result';
      } else {
        verdict = 'output-not-traced';
        candidate.phase = 'compare-result';
      }
    } else if (candidate.phase === 'compare-result') {
      const expectedValue = parseSmallNumber(String(session.expectedOutput ?? ''));
      const actualValue = parseSmallNumber(observedOutput(session.errorText ?? ''));
      const identifiesMismatch = expectedValue !== null && actualValue !== null
        && normalized.includes(String(expectedValue))
        && normalized.includes(String(actualValue))
        && /\b(expected|should|instead|different|not)\b/.test(normalized);
      if (identifiesMismatch) {
        verdict = 'confirms-hypothesis';
        candidate.status = 'confirmed';
        understood = true;
      } else {
        verdict = 'comparison-not-established';
        candidate.phase = 'identify-terms';
      }
    } else if (candidate.phase === 'identify-terms' && candidate.terms.every((term) => normalized.includes(term.toLowerCase()))) {
      verdict = 'supports-hypothesis';
      candidate.status = 'supported';
      candidate.phase = 'divisor';
    } else {
      verdict = 'hypothesis-not-confirmed';
      candidate.phase = 'divisor-retry';
    }
  } else if (candidate && demonstratesUnderstanding(session, trimmedAnswer, candidate)) {
    candidate.lastAnswer = trimmedAnswer;
    verdict = 'confirms-hypothesis';
    candidate.status = 'confirmed';
    understood = true;
  } else if (candidate && isRulingOutCandidate(candidate, trimmedAnswer)) {
    candidate.lastAnswer = trimmedAnswer;
    verdict = 'rejects-hypothesis';
    candidate.status = 'ruled-out';
    investigation.ruledOutLocations.push(candidate.location);
    if (!session.rejectedBugs.some((bug) => bug.location.statement === candidate.location.statement)) {
      session.rejectedBugs.push({
        type: candidate.type,
        location: { ...candidate.location },
        answer: trimmedAnswer,
      });
    }
    refreshRemainingLocations(investigation);
  } else if (candidate) {
    candidate.lastAnswer = trimmedAnswer;
    verdict = 'hypothesis-not-confirmed';
    if (candidate.type !== 'average-divisor') candidate.phase = 'follow-up';
    const maxQuestions = candidate.type === 'average-divisor' ? 6 : 3;
    if (candidate.questionCount >= maxQuestions) candidate.status = 'exhausted';
  } else {
    verdict = 'no-active-hypothesis';
  }

  if (understood) {
    session.understandsBug = true;
    session.latestAnswerCorrect = true;
    session.activeHypothesisConfirmed = true;
    session.studentDemonstratedUnderstanding = true;
    session.waitingForFix = true;
    session.pendingBugFix = candidate ? {
      type: candidate.type,
      location: { ...candidate.location },
      hypothesis: candidate.hypothesis,
    } : null;
    session.stage = 'fix';
    session.currentPrompt = '';
    session.currentQuestion = '';
    session.mentorAcknowledgment = "Correct! You've identified the issue. Now fix it and paste your corrected code so I can run it again.";
    refreshRemainingLocations(investigation);
  } else {
    session.stage = 'think';
    session.waitingForFix = false;
    session.pendingBugFix = null;
    refreshRemainingLocations(investigation);
    publishQuestion(session);
  }

  const questionRecord = {
    location: activeQuestion.location,
    hypothesis: activeQuestion.hypothesis,
    question: activeQuestion.question,
    phase: activeQuestion.phase,
    answer: trimmedAnswer,
    verdict,
    remainingLocations: investigation.remainingLocations.map((location) => ({ ...location })),
  };
  investigation.questions.push(questionRecord);
  investigation.lastVerdict = verdict;

  return session;
}

export function applyVerificationResult(session, correctedCode, validationResult) {
  session.correctedCode = correctedCode;
  session.code = correctedCode;
  session.latestSubmittedCode = correctedCode;
  session.validationResult = validationResult;
  session.latestActualOutput = validationResult.actualOutput ?? '';
  session.latestExecutionError = ['compile-error', 'runtime-error'].includes(validationResult.status)
    ? validationResult.compilerOutput || validationResult.message
    : '';
  session.isVerifying = false;
  session.verificationResults.push({
    revision: session.verificationResults.length + 1,
    code: correctedCode,
    ...validationResult,
  });

  if (validationResult.status === 'pass') {
    session.stage = 'verify';
    session.currentPrompt = '';
    session.currentQuestion = '';
    session.currentBug = null;
    session.waitingForFix = false;
    session.anotherBugRemains = false;
    session.isComplete = true;
    if (session.pendingBugFix && !session.fixedBugs.some((bug) =>
      bug.type === session.pendingBugFix.type
      && bug.location.statement === session.pendingBugFix.location.statement)) {
      session.fixedBugs.push(session.pendingBugFix);
    }
    session.pendingBugFix = null;
    session.mentorAcknowledgment = '';
    return session;
  }

  session.stage = 'think';
  session.understandsBug = false;
  session.studentDemonstratedUnderstanding = false;
  session.activeHypothesisConfirmed = false;
  session.waitingForFix = false;
  session.isComplete = false;
  session.dryRun = null;
  session.dryRunShown = false;
  session.mentorAcknowledgment = '';

  if (validationResult.status === 'compile-error') {
    session.errorText = `Compiler error in the revised code: ${validationResult.compilerOutput}`;
  } else if (validationResult.status === 'runtime-error') {
    session.errorText = `The revised program failed while running. Output: ${validationResult.actualOutput || '(no output)'}. ${validationResult.compilerOutput}`;
  } else if (validationResult.status === 'output-mismatch') {
    session.errorText = `For input ${session.testInput.trim().replace(/\n/g, ', ')}, expected output ${validationResult.expectedOutput}, but the revised program produced ${validationResult.actualOutput || '(no output)'}.`;
  } else {
    session.errorText = `The revised program ran and produced ${validationResult.actualOutput || '(no output)'}, but no expected output is available to verify it.`;
  }

  const previousQuestions = session.investigation?.questions ?? [];
  const previousRuledOutLocations = session.investigation?.ruledOutLocations ?? [];
  session.investigation = createInvestigation(session, previousQuestions, previousRuledOutLocations);
  const pendingBugFix = session.pendingBugFix;
  if (validationResult.status === 'output-mismatch' && pendingBugFix) {
    const sameBugRemains = session.investigation.candidates.some((candidate) =>
      candidate.type === pendingBugFix.type
      && candidate.location.statement === pendingBugFix.location.statement);
    if (!sameBugRemains && !session.fixedBugs.some((bug) =>
      bug.type === pendingBugFix.type
      && bug.location.statement === pendingBugFix.location.statement)) {
      session.fixedBugs.push(pendingBugFix);
      session.investigation = createInvestigation(session, previousQuestions, previousRuledOutLocations);
    }
  }
  session.pendingBugFix = null;
  session.anotherBugRemains = session.investigation.candidates.length > 0;
  session.currentPrompt = publishQuestion(session);
  return session;
}