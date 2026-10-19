---
doc: prd
status: approved
---

# ThinkCode — Product Requirements

ThinkCode is a beginner-focused C++ debugging mentor that turns code errors into a guided learning loop instead of a direct answer machine.
Source: `scope.md > The Unique Kernel`, `The Core Loop`, and `What "Working" Looks Like`.

## The Core Journey

1. The student opens ThinkCode and uploads or pastes a C++ code snippet along with the error they encountered.
2. The app shows the submitted code and the reported error in a simple review screen.
3. ThinkCode welcomes the student as a mentor and explains that it will guide them to find the mistake rather than immediately giving the fix.
4. The student completes a Concept Check: they explain in 50–100 words what the code is trying to do and which C++ concept they are using.
5. ThinkCode uses that explanation as the starting point for a short, adaptive debugging conversation.
6. The mentor asks one targeted question at a time, waits for the student’s response, and then decides the next question based on their answer.
7. If the student shows understanding, the conversation moves toward helping them correct the code themselves.
8. If the student is clearly stuck, ThinkCode offers a simple visual dry run or flashcard-style explanation to make the execution logic clear.
9. The student then submits the corrected code.
10. ThinkCode checks whether the corrected code actually resolves the issue and tells the student whether the fix worked.

## Screens and Layout

ThinkCode is a single focused workflow with one core screen and one interaction panel:

- Top bar: app title, simple mentor reminder, and the current step label
- Left panel: submitted C++ code and the visible compiler or runtime error
- Right panel: mentor conversation and guidance
- Concept Check area: text box for the student’s 50–100 word explanation
- Prompt area: one question at a time, with a response field for the student
- Dry-run card: collapsible or modal explanation when the student is stuck
- Final correction area: student submits revised code for validation
- Result panel: simplified pass/fail check showing whether the fix addressed the issue

## Look and Feel

The app should feel calm, supportive, and beginner-friendly. It should not feel like a generic chatbot or a technical debugger UI. The tone should be encouraging and mentor-like, with clean spacing, readable code formatting, and simple visual hierarchy that makes the lesson feel guided rather than pressured.

## Features and Behavior

### Code Submission and Error Review

- The student can paste code or upload an image/screenshot of C++ code with an error.
- The app displays the submitted code and the error message in a clear, readable format.
- The interface explains that the goal is to help the student learn by reasoning, not by jumping directly to the answer.

### Concept Check

- The student must explain in 50–100 words what the code is trying to do and which C++ concept they are using.
- The explanation is treated as context for the debugging conversation.
- ThinkCode does not reveal the correction immediately after this step.

### Guided Debugging Flow

- The mentor starts with one targeted question based on the student’s concept explanation.
- Each question is shown one at a time.
- The system waits for the answer before deciding the next prompt.
- The conversation remains short and focused: around 2–4 questions in the standard flow.
- The prompts are adaptive: they become more direct only if the student is confused, and they move toward solving the bug only when the student demonstrates understanding.

### Visual Dry Run Support

- If the student is clearly stuck or the concept explanation is weak, ThinkCode offers a simple visual dry run or flashcard-style explanation.
- The explanation should show the execution sequence step by step in a clear, beginner-friendly format.
- The learner can continue the debugging flow after the explanation.

### Corrected Code Submission and Verification

- After the guidance phase, the student submits their corrected code.
- ThinkCode checks whether the fix resolves the issue.
- The app gives a simple outcome: fixed, still failing, or needs another check.
- The verification is framed as learning feedback, not as a hidden answer key.

## States and Boundaries

- **Ready to debug** — student has submitted code and error information.
- **Concept check pending** — student is writing their 50–100 word explanation.
- **Mentor guidance active** — the AI has started the short question loop.
- **Dry run available** — the learner is stuck and receives the visual explanation.
- **Correction submitted** — the student has attempted the fix.
- **Verification result** — the app tells them whether the code resolved the issue.

## Product Decisions

- The MVP will focus only on beginner C++ debugging.
- The product will support one complete guided debugging flow: code submission → concept check → adaptive mentor questions → correction → verification.
- The app will not expand into multiple languages, user accounts, long-term course libraries, or analytics.
- The debugging loop will remain intentionally short and focused to fit the hackathon proof of concept.

## What We're Building

- A simple web interface for code submission and error review
- A concept-check stage that asks the learner to explain the code in their own words
- A short adaptive AI mentor loop with 2–4 targeted questions
- Optional visual dry-run explanation if the learner is stuck
- Corrected-code verification that checks whether the issue was actually fixed

## Deferred From the POC

- User accounts and saved sessions
- Multiple languages beyond beginner C++
- Long course content libraries or lessons
- Student progress analytics or dashboards
- Full IDE integration or real-time code editing

## Possible Later Enhancements

- More C++ debugging patterns and common beginner misconceptions
- More sophisticated visual execution traces
- Wider topic coverage, such as pointers, recursion, and STL basics
- Progress tracking across multiple debugging sessions

## Non-Goals

- Supporting a broad range of languages
- Providing instant corrected code as the default workflow
- Building a large educational platform beyond the core debugging flow
- Creating a full interactive coding environment instead of a focused mentor app

## Open Questions

- Before `4-spec`, we need to decide the exact validation method for corrected-code verification: a compile check, a simple pattern-based check, or a targeted rule engine for known beginner C++ errors.
- This is a consequential design choice for the build and should be resolved before implementation.
