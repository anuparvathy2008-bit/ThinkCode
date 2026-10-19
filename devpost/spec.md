---
doc: spec
status: draft
---

# ThinkCode — Technical Spec

## How This Works, In Plain Language

ThinkCode is a small local web app built for one purpose: help a beginner C++ student debug by asking them to think before handing out the answer.

The flow is simple:

1. The student opens the app in a browser.
2. They upload or paste a C++ code snippet and the error they saw.
3. The app shows the code and the error in one place.
4. The student writes a short explanation of what the code is trying to do and which C++ concept they are using.
5. The backend sends that explanation and the code to an LLM prompt tuned for a mentor voice.
6. The AI asks one focused question at a time and waits for the student’s response before asking the next one.
7. If the student is stuck, the app can show a simple visual dry run explaining how the code executes step by step.
8. After the guidance phase, the student submits the corrected code.
9. The backend runs a lightweight validation check using the C++ compiler and reports whether the fix worked.

This shape is intentionally small. We are proving the teaching loop, not building a full IDE or a large course platform.

## The Core Journey Through the System

The PRD’s core journey is traced through these pieces:

- Student submits code and error → Frontend stores the current session state and displays the submitted code and error.
- Student writes the concept check → Frontend sends the code and explanation to the backend.
- Backend creates a mentoring prompt → AI asks the first targeted debugging question.
- Student answers → Frontend sends the answer back to the backend, which chooses the next prompt based on the response.
- Student is stuck → Backend can trigger a dry-run explanation card or flashcard view in the frontend.
- Student submits corrected code → Backend validates the corrected code using a compiler.
- Result is shown → The app tells the student whether the code resolves the issue.

PRD ref: `prd.md > The Core Journey`.

## Stack

- Frontend: React + Vite
  - Why: quick local browser app, easy UI for a single guided workflow, good for a short hackathon build.
  - Tradeoff: slightly more setup than plain HTML, but much easier to structure than a full framework-free app.

- Backend: Node.js + Express
  - Why: simple local API, easy to run in development, easy to connect to an LLM and the compiler.
  - Tradeoff: adds a small server, but still far simpler than a full production stack.

- Data storage: local JSON file or in-memory session state
  - Why: this is a proof-of-concept app with no user accounts or persistent history required.
  - Tradeoff: no real multi-user support, but it keeps the app local and understandable.

- AI integration: one OpenAI-compatible LLM endpoint through the backend
  - Why: allows the mentor to ask targeted questions without building a custom model.
  - Tradeoff: requires an API key in development. The app remains local, but the AI reasoning is external.

- Validation: g++ compiler invoked from the backend via a child process
  - Why: verifies whether the corrected C++ code actually compiles and resolves the issue.
  - Tradeoff: compile checks are simple and reliable for the MVP, but they are not a complete semantic debugger.

- Styling: CSS modules or standard CSS in the React app
  - Why: keeps the interface clean and mentor-friendly without introducing a design system or UI framework.

## Where It Runs and How Someone Tries It

Runtime:
- Local browser app
- Local Node.js backend
- Local C++ compiler installed on the machine

How to run locally:
1. Open the project folder.
2. Install dependencies: `npm install`
3. Start the backend: `npm run server`
4. Start the frontend: `npm run dev`
5. Open the browser at `http://localhost:5173`

The required demo recording:
- Show the student uploading code
- Show the concept check prompt
- Show the first targeted mentor question
- Show the dry-run card when the student is stuck
- Show the corrected code submitted and the final verification result

This is enough to prove the flow without deployment.

## Look and Feel

- Visual tone: calm, clean, beginner-friendly
- Density: open spacing, simple layout, no clutter
- Typography: readable monospace for code blocks, clear sans-serif for mentor messages
- Color direction: light background, subtle accent colors, strong contrast for code and errors
- Feel: encouraging, patient, and tutorial-like instead of generic chatbot-style or harsh debugging UI
- The interface should present code and guidance side by side without feeling like a full IDE

## Components

### App Shell
What it does: holds the overall layout, navigation state, and current debugging session state.
PRD ref: `prd.md > Screens and Layout`.

### Submission Panel
What it does: allows the student to paste code or upload a code image/screenshot, then shows the code and the detected error text.
PRD ref: `prd.md > Code Submission and Error Review`.

### Concept Check Form
What it does: captures the 50–100 word explanation describing the code’s purpose and the concept in use.
PRD ref: `prd.md > Concept Check`.

### Mentor Prompt Panel
What it does: shows exactly one targeted mentor question at a time, waits for the student response, and then chooses the next prompt. The mentor must maintain the current debugging session and use the student’s prior answers and code context when generating each next question so the flow feels genuinely adaptive rather than like a fixed list.
PRD ref: `prd.md > Guided Debugging Flow`.

### Dry-Run Card
What it does: presents a simple visual execution walkthrough when the learner is stuck or the concept is unclear.
PRD ref: `prd.md > Visual Dry Run Support`.

### Corrected Code Form
What it does: lets the learner submit a revised version of the code after the mentorship loop.
PRD ref: `prd.md > Corrected Code Submission and Verification`.

### Verification Result Panel
What it does: shows whether the corrected code compiles or still fails, and summarizes the result in simple language.
PRD ref: `prd.md > Corrected Code Submission and Verification`.

## Data Model

Core session data:

- sessionId: unique key for one debugging flow
- submittedCode: original code as text
- errorText: original compiler/runtime error message
- conceptExplanation: 50–100 word learner explanation
- mentorHistory: array of question/answer pairs
- dryRunShown: boolean
- correctedCode: revised learner submission
- validationResult: { status, message, compilerOutput }

Local storage approach:
- Session data is kept in browser memory for the active flow.
- A small JSON file on the backend can save a single session record if needed for debugging or replay.
- No user account or persistent student profile is required for MVP.

## File Structure

```text
project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── SubmissionPanel.jsx
│   │   │   ├── ConceptCheckForm.jsx
│   │   │   ├── MentorPromptPanel.jsx
│   │   │   ├── DryRunCard.jsx
│   │   │   └── VerificationResult.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.js
├── server/                 # Express backend
│   ├── routes/
│   │   └── debug.js
│   ├── services/
│   │   ├── llmMentor.js
│   │   ├── compilerValidator.js
│   │   └── sessionStore.js
│   ├── index.js
│   └── package.json
├── devpost/                # planning docs
├── README.md
└── .env.example
```

This is intentionally simple and directly supports the debugging loop without extra infrastructure.

## External Services and Dependencies

- LLM provider: OpenAI-compatible API or similar
  - Purpose: generate the adaptive mentor prompts and optional dry-run explanations.
  - Required config: API key in environment variables.
  - Cost: dependent on usage volume; minimal for a demo.

- C++ compiler: g++ installed locally
  - Purpose: compile the student’s corrected code.
  - Required config: compiler available on the machine running the app.

No database, auth, or hosted service is required for the MVP.

## Important Failure Modes

- **The code cannot be compiled** → show the compiler output and ask the student to review the exact issue before continuing.
- **The AI prompt produces a direct answer instead of a mentor question** → keep the prompt instruction strict: “ask one guiding question, do not reveal the fix.”
- **The student is stuck for too long** → present the dry-run explanation card and allow the learner to continue with context.
- **The corrected code still fails** → present a clear “not yet fixed” result and invite another reasoning pass rather than exposing the final answer.

## What Was Simplified and Why

- **Single-user local session** instead of user accounts or saved profiles — because the proof of concept is one guided debugging flow, not a course platform.
- **In-memory or local JSON session state** instead of a database — because the product does not need persistent multi-user records.
- **Single-language support (C++)** instead of multi-language support — because the scope is intentionally limited to beginner C++ debugging.
- **Compile-based verification** instead of full semantic code analysis — because the MVP needs a practical check that the corrected code works, not a full IDE-like debugger.

## Decisions and Open Issues

Decisions made:
- Local browser app architecture was accepted.
- Lightweight backend is included for LLM conversation and validation logic.
- The app remains single-user and local for the MVP.
- No deployment is required for this proof of concept.

One genuine unresolved choice carried into build:
- The exact validation strategy for corrected-code checking should be decided before implementation: compile-only validation, a small rule-based check for common beginner mistakes, or both.

This is a consequential implementation decision and should be resolved early during the build so the verification flow is reliable and easy to demonstrate.
