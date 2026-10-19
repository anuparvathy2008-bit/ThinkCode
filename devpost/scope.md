---
doc: scope
status: approved
---

# ThinkCode

ThinkCode is a web app that helps beginner C++ learners debug by making them reason through the concept before they get the fix.

## The Unique Kernel

ThinkCode is not a code-fixer. It is a guided debugging mentor. Instead of instantly returning corrected code, it asks the learner to explain the concept in their own words, asks targeted questions that surface the mistake, can provide a simple visual dry run when they are stuck, and only then checks whether the corrected code actually solves the issue. The distinctive value is helping students think instead of copying an answer.

## Who It's For

The main users are beginner programming students learning C++, especially students struggling with arrays, loops, recursion, and basic data structures. They are usually trying to finish assignments or debug code from class exercises, and they often turn to AI for quick fixes without understanding why the bug happened.

## The Core Loop

A student uploads or pastes a screenshot or snippet of their C++ code and the error they are seeing. ThinkCode asks them to explain the concept they were trying to implement in 50–100 words. It then asks one or two probing follow-up questions to get the student to inspect their own code and identify the issue. If the student is stuck, the system provides a simple dry run or flashcard-style explanation showing how the code executes step by step. The student then submits the corrected code, and ThinkCode verifies whether the fix actually resolved the problem.

## Inspiration & Identity

The product should feel like a patient, encouraging coding mentor rather than a replacement answer bot. The tone should be calm, supportive, and educational. The experience should be simple and focused: upload code, think, get guided feedback, fix, and verify.

## Why This Matters to the Learner

I want an AI that teaches rather than shortcuts learning. The goal is not just to fix a bug, but to help students understand what went wrong and why their fix works. That makes debugging feel like learning instead of copying.

## What "Working" Looks Like

The completed proof of concept is a simple web interface where a student can upload or paste a C++ code snippet, explain their understanding, interact with the AI mentor, see a dry run explanation if needed, and submit a corrected version of the code. The app then checks whether the fix resolves the issue and gives a clear result.

## The POC Boundary

In scope for this hackathon:
- one focused C++ debugging flow
- screenshot or pasted code input
- conceptual explanation prompt
- mentor-style guided questions
- optional visual dry run explanation
- final corrected-code verification

Out of scope for now:
- full IDE integration
- multiple programming languages
- long-term student tracking or accounts
- broad curriculum features or gamification
- full compiler-style analysis for every edge case

## Later

Later versions could add more C++ topics, richer explanations, progress tracking, multi-step lesson flows, and a broader library of debugging patterns.

## Explicitly Cut

- Full IDE-style debugging workspace: too large and not necessary to prove the concept.
- Multi-language support: the initial product is intentionally focused on C++.
- Direct answer generation as the default mode: that would undermine the educational goal.
- Large student dashboard or analytics: valuable later, but not needed for the core proof of concept.
