import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { applyVerificationResult, buildDryRun, createSession, getConceptExplanationError, recordMentorAnswer, startInvestigation } from './debugLogic.js';
import { verifyCpp } from './codeRunner.js';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const sessions = new Map();

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/session', (req, res) => {
  const { code, errorText } = req.body ?? {};
  const sessionId = `session-${randomUUID()}`;
  const session = createSession(sessionId, code ?? '', errorText ?? '');

  sessions.clear();
  sessions.set(sessionId, session);

  res.json(session);
});

app.put('/api/session/:sessionId/concept', (req, res) => {
  const { sessionId } = req.params;
  const { conceptExplanation } = req.body ?? {};
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const trimmed = (conceptExplanation ?? '').trim();
  const explanationError = getConceptExplanationError(trimmed);

  if (explanationError) {
    return res.status(400).json({
      error: explanationError,
    });
  }

  session.conceptExplanation = trimmed;
  session.currentPrompt = startInvestigation(session);
  session.stage = 'think';
  return res.json(session);
});

app.post('/api/session/:sessionId/mentor/answer', (req, res) => {
  const { sessionId } = req.params;
  const { answer } = req.body ?? {};
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  const trimmedAnswer = (answer ?? '').trim();
  if (!trimmedAnswer) {
    return res.status(400).json({ error: 'A mentor answer is required.' });
  }

  if (session.stage !== 'think') {
    return res.status(409).json({ error: 'The session is not waiting for a mentor answer.' });
  }

  return res.json(recordMentorAnswer(session, trimmedAnswer));
});

app.post('/api/session/:sessionId/dry-run', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  session.dryRun = buildDryRun(session);
  session.dryRunShown = true;
  return res.json(session);
});

app.post('/api/session/:sessionId/validate', async (req, res) => {
  const { sessionId } = req.params;
  const { correctedCode } = req.body ?? {};
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (!correctedCode || !correctedCode.trim()) {
    return res.status(400).json({ error: 'A corrected C++ version is required.' });
  }

  if (session.isVerifying) {
    return res.status(409).json({ error: 'This code revision is already being verified.' });
  }

  session.latestSubmittedCode = correctedCode;
  session.isVerifying = true;

  try {
    const validationResult = await verifyCpp({
      code: correctedCode,
      input: session.testInput,
      expectedOutput: session.expectedOutput,
    });

    return res.json(applyVerificationResult(session, correctedCode, validationResult));
  } catch (error) {
    session.isVerifying = false;
    session.latestExecutionError = error.message;
    return res.status(500).json({ error: `Code verification could not run: ${error.message}` });
  }
});

app.listen(port, () => {
  console.log(`ThinkCode server running on http://localhost:${port}`);
});
