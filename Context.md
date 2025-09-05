# BusinessCRM Project Context

## Backend
- Runtime: Node.js with TypeScript (via tsx runner)
- Framework: Express.js
- ORM: Drizzle ORM with drizzle-kit for migrations
- Database: Neon-hosted PostgreSQL
- Auth: passport-local, express-session, connect-pg-simple
- Date handling: Use UTC in DB; format as dd/MM/yyyy in UI
- Commands for schema changes:
  - `npx drizzle-kit generate`
  - `npx drizzle-kit migrate`
- Rule: Do not add or remove dependencies without explicit approval

## Frontend
- Framework: React 18 (with TypeScript)
- Build Tool: Vite
- Styling: TailwindCSS + shadcn/ui + Radix primitives
- Icons: lucide-react
- State/Data: React Query (@tanstack/react-query)
- Forms: react-hook-form + Zod
- Routing: wouter

## Shared Rules
- Dates: always format as **dd/MM/yyyy**
- Do NOT change authentication/session logic
- Do NOT touch package.json without approval
- Use Drizzle ORM for all DB access (no raw SQL unless explicitly approved)
- Keep changes **scoped to the files requested**
- Output unified diffs only when making changes

## Integrations
- Google OAuth already configured (used for Calendar)
- If adding Gmail: extend existing OAuth with `https://www.googleapis.com/auth/gmail.send`
- Never widen scopes without approval
