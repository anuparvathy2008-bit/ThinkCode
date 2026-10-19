# ThinkCode

> Most coding AI fixes the problem for you. ThinkCode makes you solve it.

ThinkCode is a local browser app that helps beginners debug C++ by reasoning through a problem, identifying a bug with mentor questions, and verifying their own code changes.

## Beginner debugging workflow

1. Paste a C++ program and describe the expected and observed behavior.
2. Explain what you think the program is doing in the concept check.
3. Answer a focused question about the active bug.
4. If needed, request a short dry run to trace the current code.
5. Paste a fix. ThinkCode compiles and runs the revised code, then either reports the result or asks about another remaining bug.

## Key features

- **Concept check:** Write an explanation of the code before debugging.
- **Socratic mentor questions:** Work through one active issue at a time.
- **Stuck support:** Request a code-specific dry run.
- **Corrected-code verification:** Compile and run revised C++ code, compare its output with the expected result, and continue if another issue remains.

## Tech stack

- React and Vite frontend
- Node.js and Express backend
- C++ verification using `g++`

## Run locally

Install Node.js and make `g++` available on your PATH. In two terminals, from the project root:

```powershell
cd server
npm install
npm start
```

```powershell
cd client
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The backend runs at `http://localhost:3001`.

## Hackathon MVP

ThinkCode is an MVP built for the **Build With AI: Basics** hackathon.

## License

Released under the [MIT License](./LICENSE).
