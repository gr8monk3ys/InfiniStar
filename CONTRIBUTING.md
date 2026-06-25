# Contributing to InfiniStar

Thank you for your interest in contributing to InfiniStar! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Feature Requests](#feature-requests)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors.

### Expected Behavior

- Be respectful and considerate
- Welcome newcomers and help them get started
- Provide constructive feedback
- Focus on what is best for the community

### Unacceptable Behavior

- Harassment or discrimination of any kind
- Trolling, insulting, or derogatory comments
- Publishing others' private information
- Any conduct that could reasonably be considered inappropriate

---

## Getting Started

### Prerequisites

- Node.js 18.x or 20.x
- Bun
- Postgres (Neon recommended)
- Git

### Initial Setup

1. **Fork the repository** on GitHub

2. **Clone your fork**:

   ```bash
   git clone https://github.com/YOUR_USERNAME/InfiniStar.git
   cd InfiniStar
   ```

3. **Add upstream remote**:

   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/InfiniStar.git
   ```

4. **Install dependencies**:

   ```bash
   bun install
   ```

5. **Set up environment**:

   ```bash
   cp .env.template .env.local
   # Fill in your environment variables
   ```

6. **Set up database**:

   ```bash
   npx prisma generate
   npx prisma db push
   bun run seed  # Optional: Add test data
   ```

7. **Start development server**:
   ```bash
   bun run dev
   ```

---

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

**Branch naming conventions:**

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

### 2. Make Changes

- Write clear, concise commit messages
- Keep commits focused and atomic
- Follow the coding standards (see below)
- Add tests for new functionality
- Update documentation as needed

### 3. Commit Your Changes

```bash
git add .
git commit -m "feat: add user profile editing"
```

**Commit message format:**

```
type: subject

body (optional)

footer (optional)
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

### 4. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 5. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 6. Create a Pull Request

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and branch
4. Fill in the PR template
5. Submit for review

---

## Coding Standards

### TypeScript

- **Use TypeScript** for all new code
- **Define proper types** - avoid `any` when possible
- **Use interfaces** for object shapes
- **Enable strict mode** checks

**Example:**

```typescript
// Good
interface UserProfile {
  id: string
  name: string
  email: string
}

function updateProfile(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
  // Implementation
}

// Bad
function updateProfile(userId: any, data: any): any {
  // Implementation
}
```

### React Components

- **Use functional components** with hooks
- **Prefer client components** only when necessary
- **Extract reusable logic** into custom hooks
- **Keep components focused** (single responsibility)

**Example:**

```typescript
// Good
'use client';

import { useState } from 'react';

interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// Bad
export function Button(props: any) {
  return <button {...props} />;
}
```

### API Routes

- **Use proper HTTP methods** (GET, POST, PUT, DELETE)
- **Validate input** with Zod schemas
- **Handle errors** gracefully
- **Use consistent error responses** (see app/lib/errors.ts)
- **Add rate limiting** for sensitive endpoints

**Example:**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { ApiError } from "@/app/lib/errors"

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = schema.parse(body)

    // Process request
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.validation("Invalid input", { errors: error.errors })
    }
    return ApiError.internal()
  }
}
```

### File Naming

- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **API routes**: lowercase (e.g., `route.ts`)
- **Types**: PascalCase (e.g., `UserTypes.ts`)

### Imports

- **Group imports** by type:
  1. External packages
  2. Internal modules
  3. Relative imports
  4. Types
- **Use absolute imports** with `@/` prefix

**Example:**

```typescript
// External
import { useEffect, useState } from "react"
import { z } from "zod"

// Internal
import { ApiError } from "@/app/lib/errors"
import { Button } from "@/app/components/ui/button"
// Types
import type { User } from "@/app/types"

// Relative
import { UserProfile } from "./UserProfile"
```

---

## Testing

### Unit Tests

Run unit tests with Jest:

```bash
bun run test                # Run all tests
bun run test:watch      # Watch mode
bun run test:coverage   # Coverage report
```

### E2E Tests

Run E2E tests with Playwright:

```bash
bun run test:e2e         # Run E2E tests
bun run test:e2e:ui      # Run with UI
bun run test:e2e:headed  # Run in headed mode
```

### Writing Tests

- **Test behavior, not implementation**
- **Use descriptive test names**
- **Follow AAA pattern**: Arrange, Act, Assert
- **Mock external dependencies**

**Example:**

```typescript
import { render, screen } from "@testing-library/react"

import { Button } from "./Button"

describe("Button", () => {
  it("should call onClick when clicked", () => {
    const onClick = jest.fn()
    render(<Button label="Click me" onClick={onClick} />)

    screen.getByText("Click me").click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("should be disabled when disabled prop is true", () => {
    render(<Button label="Click me" onClick={() => {}} disabled />)

    expect(screen.getByText("Click me")).toBeDisabled()
  })
})
```

---

## Pull Request Process

### Before Submitting

1. **Run all checks**:

   ```bash
   bun run typecheck
   bun run lint
   bun run test
   bun run build
   ```

2. **Update documentation** if needed

3. **Add tests** for new features

4. **Update CHANGELOG** (if applicable)

### PR Template

When creating a PR, include:

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing

- [ ] Unit tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing performed

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests passing
```

### Review Process

1. **Automated checks** must pass (CI/CD)
2. **At least one approval** from maintainers
3. **All comments addressed**
4. **No merge conflicts**

### After Approval

- **Squash commits** if requested
- **Maintainers will merge** your PR
- **Your branch will be deleted** automatically

---

## Reporting Bugs

### Before Reporting

1. **Check existing issues** to avoid duplicates
2. **Try the latest version** to see if it's fixed
3. **Gather information** about your environment

### Bug Report Template

```markdown
## Bug Description

Clear description of the bug

## Steps to Reproduce

1. Step one
2. Step two
3. Expected vs actual behavior

## Environment

- OS: [e.g., macOS 14.0]
- Node version: [e.g., 20.10.0]
- Browser: [e.g., Chrome 120]

## Additional Context

Screenshots, logs, or other relevant info
```

---

## Feature Requests

### Before Requesting

1. **Check existing feature requests**
2. **Search discussions** for similar ideas
3. **Consider if it fits** the project scope

### Feature Request Template

```markdown
## Feature Description

Clear description of the feature

## Problem It Solves

What problem does this solve?

## Proposed Solution

How should it work?

## Alternatives Considered

Other approaches you've thought about

## Additional Context

Mockups, examples, or references
```

---

## Style Guide

### Code Formatting

We use Prettier for code formatting:

```bash
bun run format:write  # Format all files
bun run format:check  # Check formatting
```

### Linting

We use ESLint for code linting:

```bash
bun run lint      # Check for issues
bun run lint:fix  # Fix auto-fixable issues
```

### Naming Conventions

- **Variables**: camelCase (`userName`, `isActive`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRY`, `API_URL`)
- **Components**: PascalCase (`UserProfile`, `MessageList`)
- **Functions**: camelCase (`getUserData`, `formatDate`)
- **Types/Interfaces**: PascalCase (`User`, `MessageData`)

---

## Questions?

- **Documentation**: Check [README.md](README.md), [SETUP.md](SETUP.md)
- **Discussions**: Use GitHub Discussions
- **Chat**: Join our community (if available)

---

## License

By contributing, you agree that your contributions will be licensed under the same license as the project (see [LICENSE](LICENSE)).

---

**Thank you for contributing to InfiniStar! 🎉**
