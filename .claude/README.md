# Claude Code Configuration for InfiniStar

This directory contains Claude Code configuration files for the InfiniStar project.

## 📁 Directory Structure

```
.claude/
├── README.md                      # This file
├── MCP_AND_AGENTS_GUIDE.md       # Comprehensive usage guide
└── agents/                        # Custom AI agents
    ├── security-auditor.md        # Security vulnerability scanning
    ├── test-engineer.md           # Test automation and generation
    ├── database-engineer.md       # Database schema and migrations
    └── ai-integration-specialist.md  # AI/Claude integration expert
```

## 🚀 Quick Start

### View Available Agents

```
/agents
```

### Use an Agent

```
> Use the security-auditor agent to review my API changes
> Have test-engineer run all tests
> Ask database-engineer to create a migration
```

### Check MCP Server Status

```
/mcp
```

## 📚 Documentation

- **Full Guide**: See [MCP_AND_AGENTS_GUIDE.md](MCP_AND_AGENTS_GUIDE.md)
- **Project Docs**: See [../CLAUDE.md](../CLAUDE.md)
- **MCP Servers**: See [../.mcp.json](../.mcp.json)

## 🤖 Available Agents

| Agent                         | Use For                                 | Invocation                                     |
| ----------------------------- | --------------------------------------- | ---------------------------------------------- |
| **security-auditor**          | Security scans, CSRF, validation        | `Use security-auditor to audit...`             |
| **test-engineer**             | Run tests, generate tests, fix failures | `Use test-engineer to test...`                 |
| **database-engineer**         | Schema changes, migrations, queries     | `Use database-engineer to migrate...`          |
| **ai-integration-specialist** | AI features, streaming, usage tracking  | `Use ai-integration-specialist to optimize...` |

## 🔌 MCP Servers

| Server     | Purpose                  | Authentication                    |
| ---------- | ------------------------ | --------------------------------- |
| **Stripe** | Payments & subscriptions | OAuth (via `/mcp`)                |
| **GitHub** | PRs, issues, releases    | Token (via `GITHUB_ACCESS_TOKEN`) |
| **Sentry** | Error monitoring         | OAuth (via `/mcp`)                |

## ⚡ Common Workflows

### Before Deploying

```
> Use security-auditor to review all changes
> Use test-engineer to run the full test suite
> Check Sentry for any new production errors
```

### Adding a Feature

```
> Use database-engineer to add the necessary schema changes
> Write the feature code
> Use test-engineer to generate tests
> Use security-auditor to verify security
> Use GitHub to create a PR
```

### Debugging Production

```
> Use Sentry to find the error details
> Use security-auditor to check if it's a security issue
> Use GitHub to create an issue
> Use test-engineer to add a regression test
```

## 🔧 Customization

To modify an agent:

1. Edit the markdown file in `.claude/agents/`
2. Update the `description` (when it should be used)
3. Update the system prompt (how it should behave)
4. Adjust `tools` if needed (Read, Edit, Bash, Grep, Glob)
5. Save the file (changes take effect immediately)

## 📖 Resources

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [InfiniStar Project Docs](../CLAUDE.md)

---

For detailed usage instructions, see [MCP_AND_AGENTS_GUIDE.md](MCP_AND_AGENTS_GUIDE.md).
