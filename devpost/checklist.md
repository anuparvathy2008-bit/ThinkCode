---
doc: checklist
status: draft
---

# Build Checklist

Build mode: learn

## Slices

- [ ] **1. Submit code and see the error in a working app shell**
  Becomes usable: A running local app where a student can paste or upload C++ code and the app displays the submitted code plus the error message in a single screen.
  Why now: This proves the core entry flow and gives every later slice a real place to attach behavior. It also validates the basic frontend/backend wiring before the mentor workflow is added.
  PRD ref: `prd.md > The Core Journey` (steps 1-3), `prd.md > Code Submission and Error Review`
  Spec ref: `spec.md > App Shell`, `spec.md > Submission Panel`, `spec.md > The Core Journey Through the System`
  Build: Scaffold the frontend and backend as planned in the spec, create the app shell, add the code input form and error display, and store the active session state in memory or a local JSON file.
  Verify (mechanical): Start the app, submit sample C++ code with an error, and confirm the screen displays the code and the compiler/runtime error without crashing.
  Learner check: Open the app, paste a snippet with an error, and confirm it feels like the start of a guided debugging flow rather than a blank form.
  Commit: `Add submission screen and error review`

- [ ] **2. Capture the concept explanation and keep it attached to the debugging session**
  Becomes usable: The student writes a 50–100 word explanation of what the code is trying to do and which concept it uses, and that explanation is saved with the session for the mentor to reference.
  Why now: The concept check is the first meaningful teaching gate. It separates the product from a generic answer bot and gives the AI real context before any question flow starts.
  PRD ref: `prd.md > Concept Check`, `prd.md > The Core Journey` (steps 4-5)
  Spec ref: `spec.md > Concept Check Form`, `spec.md > Data Model`
  Build: Add the concept-check text area, validate the response length, save the explanation to the active session, and show the next step in the flow only after it is submitted.
  Verify (mechanical): Submit a sample concept explanation and confirm it is stored in the session and shown in the next state without losing the original code or error.
  Learner check: Write a short explanation of a simple C++ task and confirm the app still remembers the code, the error, and the concept note when the next prompt appears.
  Commit: `Add concept check and session persistence`

- [ ] **3. Run the short adaptive mentor prompt loop**
  Becomes usable: The app asks exactly one targeted question at a time based on the concept explanation and the student’s previous answers, while keeping the current debugging session state and code context in view so the next question feels adaptive and specific rather than like a fixed question list.
  Why now: This is the heart of the product. It turns the tool into a mentor, not a code generator.
  PRD ref: `prd.md > Guided Debugging Flow`, `prd.md > The Core Journey` (steps 5-8)
  Spec ref: `spec.md > Mentor Prompt Panel`, `spec.md > External Services and Dependencies`, `spec.md > Data Model`
  Build: Add the first mentor prompt state, maintain the active session history and code context, send that full context to the LLM with a strict instruction to ask one guiding question only, and show the next prompt after the student replies.
  Verify (mechanical): Submit a concept explanation and answer the first prompt, then confirm the app advances to a second prompt only after a new response is received and that the follow-up references the student’s prior answer and code context.
  Learner check: Try the mentor flow with one sample bug and confirm the questions are guiding, short, and adaptive rather than reading like a canned list.
  Commit: `Add adaptive mentor prompt loop`

- [ ] **4. Offer the visual dry-run explanation when the learner is stuck**
  Becomes usable: If the student answers poorly or clearly stalls, the app offers a simple flashcard-style dry run that shows how the code executes step by step.
  Why now: This is the fallback that preserves learning when the student gets stuck, without bypassing the reasoning process.
  PRD ref: `prd.md > Visual Dry Run Support`, `prd.md > The Core Journey` (step 8)
  Spec ref: `spec.md > Dry-Run Card`, `spec.md > Important Failure Modes`
  Build: Add the dry-run trigger logic, create a simple visual explanation card for a beginner-friendly example, and let the student continue the flow after viewing it.
  Verify (mechanical): Force a stuck state in testing or a sample scenario and confirm the dry-run card appears and the learner can continue the conversation after it.
  Learner check: Try a sample scenario where the concept is unclear and confirm the dry run makes the code execution easier to understand without giving away the final fix.
  Commit: `Add visual dry-run support`

- [ ] **5. Validate the corrected code and show a final result**
  Becomes usable: After the student submits a corrected C++ version, the app runs a simple compile-based verification and shows whether the fix worked.
  Why now: This closes the learning loop and demonstrates that the student’s understanding, not just the AI’s answer, is what leads to a fix.
  PRD ref: `prd.md > Corrected Code Submission and Verification`, `prd.md > The Core Journey` (steps 9-10)
  Spec ref: `spec.md > Corrected Code Form`, `spec.md > Verification Result Panel`, `spec.md > Important Failure Modes`
  Build: Add the corrected-code submission area, run `g++` through the backend, capture the compiler output, and show clear pass/fail feedback in the result panel.
  Verify (mechanical): Submit a known fixed snippet and a known broken snippet to confirm the backend distinguishes success from failure and reports the compiler output clearly.
  Learner check: Submit a corrected version of their sample problem and confirm the outcome is understandable and tied to actual code behavior rather than a vague result.
  Commit: `Add corrected-code validation`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — submission, concept check, and the first mentor prompt are all working in a single session
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: to be filled in after the build is complete and the learner has validated the app.
Route and stops: to be filled in after the build is complete and the learner has validated the app.
Edit outcome: to be filled in after the build is complete and the learner has validated the app.
Reflection: to be filled in after the build is complete and the learner has validated the app.
Activity mode: to be filled in after the build is complete and the learner has validated the app.

## Revisions

