# AGENTS.md
Guidance for coding agents working in `SankeyDrawer`.
Primary app lives in `app/` and uses Next.js + TypeScript.

## Repository Shape
- Main web app: `app/`
- Source code: `app/src/`
- App Router entrypoints: `app/src/app/`
- Shared types: `app/src/types/`
- Business/data logic: `app/src/lib/`
- React context state: `app/src/context/`
- UI components: `app/src/components/`
- Unit tests live next to source files as `*.test.ts`

## Tooling and Runtime
- Package manager: `npm` (lockfile: `app/package-lock.json`)
- Framework: Next.js 16 (App Router)
- Language: TypeScript (`strict: true` in `app/tsconfig.json`)
- Linting: ESLint 9 + `eslint-config-next` (core-web-vitals + typescript)
- Testing: Jest 30 + `ts-jest` + `jsdom` + Testing Library
- Styling: Tailwind CSS v4 + global CSS variables
- Deployment: Netlify (`netlify.toml`, base dir `app`)
- Deploy Node version: `20.9.0`

## Working Directory Rules
- Run Node/npm commands from `app/`.
- Root helper scripts (`run_local.bat`, `run-local.bat`) just change into `app/` and run npm.
- From repo root, use `npm --prefix app <command>`.

## Build/Lint/Test Commands
Run all commands in `app/` unless stated otherwise.

### Install + Local Dev
```bash
npm install
npm run dev
```

### Production Build + Start
```bash
npm run build
npm run start
```

### Linting
```bash
npm run lint
npm run lint -- src/lib/dsl-parser.ts
```

### Type-check (no npm script currently)
```bash
npx tsc --noEmit
```

### Tests
```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Single Test Commands (important)
```bash
npm run test -- src/lib/dsl-parser.test.ts
npm run test -- -t "parseCSV"
npm run test -- src/lib/dsl-parser.test.ts -t "should parse CSV with header"
```

### Equivalent Commands from Repo Root
```bash
npm --prefix app run build
npm --prefix app run lint
npm --prefix app run test -- src/lib/dsl-parser.test.ts
```

## Code Style Guidelines
These conventions are inferred from current source and config.
Keep edits focused and avoid unrelated formatting churn.

### Imports
- Prefer alias imports from `@/` for app modules (configured in `tsconfig.json`).
- Use relative imports only for very local same-folder modules.
- Keep groups ordered: external packages -> internal alias modules -> relative modules.
- Use explicit type imports when useful (`import type { Metadata } from "next"`).

### Formatting
- Use semicolons.
- Preserve the existing quote style in the file you touch (repo has mixed single/double quotes).
- Keep multiline trailing commas when surrounding code uses them.
- Prefer small functions with guard clauses and early returns.
- Do not reformat untouched files just for style.

### TypeScript and Types
- Respect strict typing; avoid new `any` unless truly unavoidable.
- Reuse shared interfaces from `app/src/types/sankey.ts`.
- Prefer `interface` for object shapes and `type` for unions/compositions.
- Model nullable values explicitly (`string | null`, `number | null`).
- Keep reducer actions narrow/discriminated when possible.

### Naming Conventions
- Components: PascalCase (`SankeyCanvas.tsx`, `BalanceIndicator.tsx`).
- Hooks: `use` prefix + camelCase (`useKeyboardShortcuts`).
- Context providers: `XProvider`; context hooks: `useX`.
- Utility files in `lib`: kebab-case (`dsl-parser.ts`, `colorPalettes.ts`).
- Constants: UPPER_SNAKE_CASE (`STORAGE_KEY`, `DEFAULT_PALETTE`).
- Data model IDs: lowercase snake_case.

### React and Next.js
- Add `'use client';` in components/hooks/contexts that use client APIs.
- Keep global providers wired via `app/src/app/layout.tsx`.
- Use dynamic import with `ssr: false` only for browser-only dependencies (e.g., D3 canvas).
- Prefer function components; class components are only used for error boundaries.

### State Management
- Preserve immutable reducer updates.
- Keep action payloads serializable and focused.
- Cap history arrays when relevant (undo/redo patterns already exist).
- Persist only intended slices to `localStorage`.

### Error Handling and Logging
- Wrap risky parse/storage/network operations with `try/catch`.
- Return structured service results for recoverable errors (`{ success, content, error }`).
- Throw explicit errors for missing provider contexts (`useX must be used within XProvider`).
- Log contextual failures with `console.error` where recovery/fallback exists.
- Do not silently swallow errors unless fallback behavior is explicit.

### Testing Conventions
- Keep tests adjacent to source as `*.test.ts`.
- Use `describe` + `it` with behavior-oriented test names.
- Prefer AAA structure (Arrange, Act, Assert).
- Cover parser edge cases and invalid input handling.
- For bug fixes, add or update a focused regression test.

### Styling Conventions
- Prefer Tailwind utility classes for component-level styling.
- Keep design tokens in `app/src/app/globals.css` CSS variables.
- Reuse existing variables (`--color-primary`, `--border`, etc.) before adding new ones.
- Preserve accessibility support (`prefers-reduced-motion`, visible focus styles).

## Cursor/Copilot Rule Files
No Cursor/Copilot instruction files were found at time of writing:
- No `.cursor/rules/` directory
- No `.cursorrules`
- No `.github/copilot-instructions.md`
If added later, treat them as high-priority instructions and update this file.

## Agent Completion Checklist
- Run `npm run lint` in `app/`.
- Run targeted tests for touched modules (at least one single-file Jest command).
- Run `npm run build` for production-impacting changes.
- Keep edits scoped; avoid unrelated refactors.
