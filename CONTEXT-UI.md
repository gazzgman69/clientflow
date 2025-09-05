# BusinessCRM Frontend Context

## Frontend
- Framework: React 18 with TypeScript
- Build tool: Vite
- Styling: TailwindCSS + shadcn/ui (built on Radix UI primitives)
- Icons: lucide-react
- State/data: React Query (@tanstack/react-query)
- Forms: react-hook-form + Zod
- Routing: wouter
- Animations: framer-motion

## UI Rules
- Use Tailwind utility classes for styling (e.g. text-sm, text-xl, p-4, bg-gray-100).
- Use shadcn/ui components (Buttons, Cards, Tables) for consistency.
- Accessibility: follow Radix patterns, don’t strip aria-* props.
- Dates: always render as dd/MM/yyyy (use date-fns for formatting).
- Keep changes **scoped only to the files requested**.
- Do not add new UI libraries or dependencies without approval.

## Acceptance
- Mobile responsive (check at 360px width).
- Consistent styling with Tailwind/shadcn.
- Unified diffs only for files mentioned in the prompt.
