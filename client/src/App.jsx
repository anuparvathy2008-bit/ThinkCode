import { useRef, useState } from 'react'
import './App.css'

const flowSteps = ['Submit', 'Explain', 'Think', 'Fix', 'Verify']

function App() {
  const [code, setCode] = useState('')
  const [errorText, setErrorText] = useState('')
  const [session, setSession] = useState(null)
  const [activeStep, setActiveStep] = useState('submit')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState('')
  const [conceptExplanation, setConceptExplanation] = useState('')
  const [conceptError, setConceptError] = useState('')
  const [mentorAnswer, setMentorAnswer] = useState('')
  const [mentorError, setMentorError] = useState('')
  const [isSendingAnswer, setIsSendingAnswer] = useState(false)
  const [correctedCode, setCorrectedCode] = useState('')
  const [isValidating, setIsValidating] = useState(false)
  const [validationError, setValidationError] = useState('')
  const sessionGeneration = useRef(0)

  async function handleDryRunRequest() {
    if (!session || !session.sessionId) {
      return
    }

    const requestGeneration = sessionGeneration.current

    try {
      const response = await fetch(`http://localhost:3001/api/session/${session.sessionId}/dry-run`, {
        method: 'POST',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to show the dry run')
      }

      const data = await response.json()
      if (requestGeneration !== sessionGeneration.current) return
      setSession((currentSession) => ({ ...currentSession, ...data }))
    } catch (error) {
      console.error(error)
      if (requestGeneration === sessionGeneration.current) {
        setMentorError(error.message || 'The dry run is not available right now.')
      }
    }
  }

  async function handleValidation() {
    if (!session || !session.sessionId) {
      return
    }

    setValidationError('')
    setIsValidating(true)
    const requestGeneration = sessionGeneration.current

    try {
      const response = await fetch(`http://localhost:3001/api/session/${session.sessionId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedCode }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to validate the corrected code')
      }

      const data = await response.json()
      if (requestGeneration !== sessionGeneration.current) return
      setSession((currentSession) => ({ ...currentSession, ...data }))
      setActiveStep(data.validationResult?.status === 'pass' ? 'verify' : 'think')
    } catch (error) {
      console.error(error)
      if (requestGeneration === sessionGeneration.current) {
        setValidationError(error.message || 'The corrected code could not be validated.')
      }
    } finally {
      if (requestGeneration === sessionGeneration.current) setIsValidating(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (conceptWordCount < 15) {
      setConceptError('Please explain your thinking a little more. Add at least 15 words before continuing.')
      return
    }

    setSession(null)
    setActiveStep('submit')
    setConceptExplanation('')
    setConceptError('')
    setMentorAnswer('')
    setMentorError('')
    setCorrectedCode('')
    setValidationError('')
    setSubmissionError('')
    setIsSendingAnswer(false)
    setIsValidating(false)
    const requestGeneration = ++sessionGeneration.current
    setIsSubmitting(true)
    let requestStage = 'creating the session'

    try {
      const response = await fetch('http://localhost:3001/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, errorText }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || `Session creation failed with HTTP ${response.status}`)
      }

      const newSession = await response.json()
      if (requestGeneration !== sessionGeneration.current) return
      if (!newSession.sessionId) {
        throw new Error('The session endpoint returned no session ID.')
      }

      requestStage = 'saving your explanation'
      const conceptResponse = await fetch(`http://localhost:3001/api/session/${newSession.sessionId}/concept`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conceptExplanation: conceptExplanation.trim() }),
      })

      if (!conceptResponse.ok) {
        const payload = await conceptResponse.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to save concept explanation')
      }

      const completeSession = await conceptResponse.json()
      if (requestGeneration !== sessionGeneration.current) return
      setSession(completeSession)
      setActiveStep('think')
      setCode('')
      setErrorText('')
    } catch (error) {
      console.error(error)
      if (requestGeneration === sessionGeneration.current) {
        setSubmissionError(`Could not finish ${requestStage}: ${error.message}. Check the backend on port 3001, then retry.`)
      }
    } finally {
      if (requestGeneration === sessionGeneration.current) setIsSubmitting(false)
    }
  }

  async function handleMentorAnswerSubmit(event) {
    event.preventDefault()

    if (!session || !session.currentPrompt) {
      return
    }

    if (!mentorAnswer.trim()) {
      setMentorError('Please answer the mentor question before continuing.')
      return
    }

    setMentorError('')
    setIsSendingAnswer(true)
    const requestGeneration = sessionGeneration.current

    try {
      const response = await fetch(`http://localhost:3001/api/session/${session.sessionId}/mentor/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: mentorAnswer.trim() }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || 'Failed to submit the mentor answer')
      }

      const data = await response.json()
      if (requestGeneration !== sessionGeneration.current) return
      setSession((currentSession) => ({ ...currentSession, ...data }))
      setMentorAnswer('')
      if (data.stage === 'fix') setActiveStep('fix')
    } catch (error) {
      console.error(error)
      if (requestGeneration === sessionGeneration.current) {
        setMentorError(error.message || 'The answer could not be saved.')
      }
    } finally {
      if (requestGeneration === sessionGeneration.current) setIsSendingAnswer(false)
    }
  }

  function handleNewSession() {
    sessionGeneration.current += 1
    setSession(null)
    setActiveStep('submit')
    setCode('')
    setErrorText('')
    setConceptExplanation('')
    setConceptError('')
    setMentorAnswer('')
    setMentorError('')
    setCorrectedCode('')
    setValidationError('')
    setSubmissionError('')
    setIsSendingAnswer(false)
    setIsValidating(false)
    setIsSubmitting(false)
  }

  const conceptWordCount = conceptExplanation.trim().split(/\s+/).filter(Boolean).length
  const conceptGuidance = conceptWordCount < 15
    ? 'Add a little more detail before submitting. At least 15 words are needed.'
    : conceptWordCount < 50
      ? 'You can submit this now. Adding a little more detail may help your mentor guide you.'
      : conceptWordCount <= 100
        ? 'This is within the recommended 50–100 word range.'
        : 'You can submit this as is. The recommended range is 50–100 words, so consider tightening it if useful.'
  const verificationPassed = session?.validationResult?.status === 'pass'
  const currentProgressIndex = flowSteps.indexOf(
    activeStep === 'explain' ? 'Explain' : activeStep === 'think' ? 'Think' : activeStep === 'fix' ? 'Fix' : activeStep === 'verify' ? 'Verify' : 'Submit',
  )

  return (
    <div className="thinkcode-app">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">T</span>
          <div>
            <p className="eyebrow">ThinkCode</p>
            <h1>Debug by thinking it through.</h1>
            <p className="tagline">A guided C++ debugging session, one useful question at a time.</p>
          </div>
        </div>
        {session ? <button type="button" className="new-session-button" onClick={handleNewSession}>New session</button> : null}
      </header>

      <nav className="progress-track" aria-label="Debugging progress">
        {flowSteps.map((step, index) => {
          const isComplete = Boolean(session && (index < currentProgressIndex || (step === 'Verify' && verificationPassed)))
          const isCurrent = index === currentProgressIndex && !verificationPassed

          return (
            <div className={`progress-step ${isCurrent ? 'current' : ''} ${isComplete ? 'complete' : ''}`} key={step}>
              <span className="progress-number">{isComplete ? '✓' : `0${index + 1}`}</span>
              <span>{step}</span>
            </div>
          )
        })}
      </nav>

      <main className="workspace">
        {!session ? (
          <form className="submission-screen" onSubmit={handleSubmit}>
            <div className="section-heading">
              <div>
                <p className="section-kicker">Start with your problem</p>
                <h2>What is your code doing?</h2>
              </div>
              <span className="language-tag">C++</span>
            </div>

            <label className="field code-field">
              <span>Your code</span>
              <textarea
                value={code}
                onChange={(event) => setCode(event.target.value)}
                spellCheck={false}
                placeholder="Paste your C++ code here..."
                required
              />
            </label>

            <label className="field problem-field">
              <span>What went wrong?</span>
              <textarea
                value={errorText}
                onChange={(event) => setErrorText(event.target.value)}
                rows={3}
                placeholder="Paste an error message or describe the behavior you expected and what happened instead."
              />
            </label>

            <section className="submission-explanation" aria-labelledby="explanation-heading">
              <div className="explanation-heading">
                <div>
                  <p className="section-kicker">Step 2 · Explain</p>
                  <h3 id="explanation-heading">What do you think is happening?</h3>
                </div>
                <span className="word-counter">{conceptWordCount} words</span>
              </div>
              <p className="panel-intro">Describe the goal of the code and the C++ idea you think is involved.</p>
              <textarea
                value={conceptExplanation}
                onChange={(event) => {
                  setConceptExplanation(event.target.value)
                  setConceptError('')
                }}
                rows={5}
                placeholder="Explain your current understanding..."
                aria-label="Your explanation"
              />
              <p className={`concept-guidance ${conceptWordCount < 15 ? 'needs-detail' : 'encouragement'}`}>
                {conceptGuidance}
              </p>
              {conceptError ? <p className="error-copy" role="alert">{conceptError}</p> : null}
            </section>

            {submissionError ? <p className="error-copy" role="alert">{submissionError}</p> : null}
            <div className="submission-actions">
              <span>Your code stays in this local session.</span>
              <button type="submit" disabled={isSubmitting || !code.trim() || conceptWordCount < 15}>
                {isSubmitting ? 'Starting session...' : 'Start guided session'} <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        ) : (
          <>
            <section className="context-panel" aria-label="Current debugging context">
              <div className="context-problem">
                <span className="context-label">CURRENT PROBLEM</span>
                <p>{session.errorText || 'No error text provided. Use the code and your observations as context.'}</p>
              </div>
              <div className="context-code">
                <span className="context-label">SUBMITTED C++</span>
                <pre>{session.code}</pre>
              </div>
              {session.validationResult && session.validationResult.status !== 'pass' ? (
                <div className={`verification-feedback ${session.validationResult.status}`}>
                  <strong>{session.validationResult.message}</strong>
                  {session.validationResult.actualOutput ? <p>Actual output: <code>{session.validationResult.actualOutput}</code></p> : null}
                  {session.validationResult.expectedOutput ? <p>Expected output: <code>{session.validationResult.expectedOutput}</code></p> : null}
                  {session.validationResult.compilerOutput ? <pre>{session.validationResult.compilerOutput}</pre> : null}
                </div>
              ) : null}
            </section>

            {activeStep === 'think' ? (
              <section className="guided-panel mentor-panel">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Step 3 · Think</p>
                    <h2>Let’s reason it out.</h2>
                  </div>
                  <span className="mentor-badge"><span aria-hidden="true">✳</span> Your mentor</span>
                </div>

                <div className="explanation-context">
                  <span className="context-label">YOUR EXPLANATION</span>
                  <p>{session.conceptExplanation}</p>
                </div>

                <div className="active-question">
                  <span className="context-label">A QUESTION TO THINK ABOUT</span>
                  <p>{session.currentPrompt || 'Preparing a question from your code...'}</p>
                </div>

                {session.dryRunShown && session.dryRun ? (
                  <div className="dry-run-card">
                    <h3>{session.dryRun.title}</h3>
                    <ol>{session.dryRun.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}</ol>
                  </div>
                ) : null}

                <form className="mentor-form" onSubmit={handleMentorAnswerSubmit}>
                  <label className="field" htmlFor="mentor-answer"><span>Your thinking</span></label>
                  <textarea
                    id="mentor-answer"
                    value={mentorAnswer}
                    onChange={(event) => setMentorAnswer(event.target.value)}
                    rows={4}
                    placeholder="Work through the question in your own words..."
                    disabled={!session.currentPrompt}
                  />
                  <div className="mentor-actions">
                    <button type="button" className="stuck-button" onClick={handleDryRunRequest} disabled={session.dryRunShown}>
                      {session.dryRunShown ? 'Walk-through shown' : "I'm stuck"}
                    </button>
                    <button type="submit" disabled={isSendingAnswer || !mentorAnswer.trim()}>
                      {isSendingAnswer ? 'Sending...' : 'Send my thinking'} <span aria-hidden="true">→</span>
                    </button>
                  </div>
                  {mentorError ? <p className="error-copy" role="alert">{mentorError}</p> : null}
                </form>

                {session.mentorHistory?.length ? (
                  <details className="mentor-history">
                    <summary>Earlier questions and answers <span>{session.mentorHistory.length}</span></summary>
                    <ol>
                      {session.mentorHistory.map((entry, index) => (
                        <li key={`${entry.question}-${index}`}>
                          <p className="history-question">{entry.question}</p>
                          <p>{entry.answer}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                ) : null}

                <button type="button" className="text-action" onClick={() => setActiveStep('fix')}>I’m ready to try a fix <span aria-hidden="true">→</span></button>
              </section>
            ) : activeStep === 'fix' ? (
              <section className="guided-panel fix-panel">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Step 4 · Fix</p>
                    <h2>Submit your corrected code.</h2>
                  </div>
                </div>
                {session.mentorAcknowledgment ? (
                  <div className="mentor-acknowledgment" role="status">{session.mentorAcknowledgment}</div>
                ) : null}
                <p className="panel-intro">Paste the corrected code for the bug you just identified, then verify it against the expected result.</p>
                <textarea
                  className="corrected-editor"
                  value={correctedCode}
                  onChange={(event) => setCorrectedCode(event.target.value)}
                  rows={14}
                  spellCheck={false}
                  placeholder="Enter your corrected C++ code..."
                  aria-label="Corrected C++ code"
                />
                {validationError ? <p className="error-copy" role="alert">{validationError}</p> : null}
                <div className="mentor-actions">
                  <button type="button" className="stuck-button" onClick={() => setActiveStep('think')}>Back to question</button>
                  <button type="button" onClick={handleValidation} disabled={isValidating || !correctedCode.trim()}>
                    {isValidating ? 'Checking code...' : 'Verify my fix'} <span aria-hidden="true">→</span>
                  </button>
                </div>
              </section>
            ) : (
              <section className="guided-panel verify-panel">
                <div className="section-heading">
                  <div>
                    <p className="section-kicker">Step 5 · Verify</p>
                    <h2>{session.validationResult?.status === 'pass' ? 'Your code compiles.' : 'Check the result.'}</h2>
                  </div>
                </div>
                {verificationPassed ? (
                  <div className="success-banner" role="status">
                    <span aria-hidden="true">✓</span>
                    <strong>You've debugged successfully! 🎉</strong>
                  </div>
                ) : null}
                {session.validationResult ? (
                  <div className={`validation-panel ${session.validationResult.status}`}>
                    <h3>{session.validationResult.status === 'pass' ? 'Fix verified' : 'Still failing'}</h3>
                    <p>{session.validationResult.message}</p>
                    {session.validationResult.actualOutput ? <p>Actual output: <code>{session.validationResult.actualOutput}</code></p> : null}
                    {session.validationResult.expectedOutput ? <p>Expected output: <code>{session.validationResult.expectedOutput}</code></p> : null}
                    {session.validationResult.compilerOutput ? <pre>{session.validationResult.compilerOutput}</pre> : null}
                  </div>
                ) : null}
                <button type="button" className="text-action" onClick={() => setActiveStep('fix')}>Edit corrected code <span aria-hidden="true">→</span></button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
