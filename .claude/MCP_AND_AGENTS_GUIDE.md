# InfiniStar MCP and AI Agents Setup Guide

This guide explains how to use the Model Context Protocol (MCP) servers and custom AI agents configured for InfiniStar.

## 📋 Table of Contents

- [Custom AI Agents](#custom-ai-agents)
- [MCP Servers](#mcp-servers)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [Troubleshooting](#troubleshooting)

---

## 🤖 Custom AI Agents

InfiniStar includes 4 specialized AI agents for specific development tasks:

### 1. Security Auditor (`security-auditor`)

**Purpose**: Proactive security scanning and vulnerability detection

**When to Use**:

- After modifying API routes
- When adding authentication logic
- Before deploying to production
- When handling user input

**Example Usage**:

```
> Use the security-auditor agent to check my recent API changes

> Have the security-auditor review the new authentication flow

> Ask security-auditor to audit CSRF protection across all POST endpoints
```

**What It Checks**:

- ✓ CSRF protection on mutations
- ✓ Rate limiting configuration
- ✓ Input validation with Zod
- ✓ Input sanitization
- ✓ Authentication checks
- ✓ SQL injection prevention
- ✓ XSS vulnerabilities

### 2. Test Engineer (`test-engineer`)

**Purpose**: Automated testing, test generation, and coverage improvement

**When to Use**:

- After writing new features
- When tests fail
- To improve code coverage
- Before creating PRs

**Example Usage**:

```
> Use the test-engineer agent to run all tests and fix failures

> Have test-engineer generate unit tests for the new sanitization function

> Ask test-engineer to improve coverage for the auth module
```

**What It Does**:

- ✓ Runs Jest and Playwright tests
- ✓ Generates test cases
- ✓ Fixes failing tests
- ✓ Analyzes coverage gaps
- ✓ Creates E2E test scenarios

### 3. Database Engineer (`database-engineer`)

**Purpose**: Database schema management, migrations, and query optimization

**When to Use**:

- When modifying `prisma/schema.prisma`
- Creating database migrations
- Optimizing slow queries
- Adding new models or fields

**Example Usage**:

```
> Use the database-engineer agent to add a `preferences` field to the User model

> Have database-engineer optimize queries for the conversations page

> Ask database-engineer to create a migration for the new notification system
```

**What It Does**:

- ✓ Schema validation and formatting
- ✓ Migration creation and testing
- ✓ Query optimization
- ✓ Index recommendations
- ✓ Data seeding

### 4. AI Integration Specialist (`ai-integration-specialist`)

**Purpose**: Anthropic Claude API integration, streaming, and usage optimization

**When to Use**:

- Modifying AI chat endpoints
- Adding new personalities
- Optimizing AI costs
- Debugging streaming issues

**Example Usage**:

```
> Use the ai-integration-specialist to add a new "Code Review" personality

> Have ai-integration-specialist optimize token usage in chat responses

> Ask ai-integration-specialist to debug the streaming connection issue
```

**What It Does**:

- ✓ Model configuration
- ✓ Streaming implementation
- ✓ Usage tracking
- ✓ Cost optimization
- ✓ Personality management

---

## 🔌 MCP Servers

InfiniStar includes 3 pre-configured MCP servers in `.mcp.json`:

### 1. Stripe MCP Server

**Purpose**: Manage payments, subscriptions, and customer data

**Capabilities**:

- View and manage subscriptions
- Create checkout sessions
- Handle customer inquiries
- Generate invoices
- Track payment history

**Setup**:

```bash
# The server is pre-configured in .mcp.json
# Authenticate via OAuth when prompted
/mcp
```

**Example Usage**:

```
> Check the status of user@example.com's PRO subscription

> Create a checkout session for the PRO plan

> Show me all failed payments from the last 7 days
```

### 2. GitHub MCP Server

**Purpose**: Repository management, PR operations, and issue tracking

**Capabilities**:

- Create and manage PRs
- Review code changes
- Create and update issues
- Manage releases
- View repository statistics

**Setup**:

```bash
# Ensure GITHUB_ACCESS_TOKEN is in your environment
# The server will use the token from .env.template
```

**Example Usage**:

```
> Create a PR for the feature/user-preferences branch

> Show me all open issues labeled "bug"

> Review the changes in PR #42
```

### 3. Sentry MCP Server

**Purpose**: Error monitoring and debugging production issues

**Capabilities**:

- View error reports
- Analyze stack traces
- Track error trends
- Debug production issues
- Monitor performance

**Setup**:

```bash
# Authenticate via OAuth when prompted
/mcp
```

**Example Usage**:

```
> What are the most common errors in the last 24 hours?

> Show me the stack trace for error ID abc123

> Which deployment introduced the authentication errors?
```

---

## 🚀 Quick Start

### First Time Setup

1. **Accept Project MCP Servers**:

   ```bash
   # Claude Code will prompt for approval on first use
   # This only needs to be done once
   ```

2. **Authenticate Remote Servers**:

   ```bash
   # In Claude Code, run:
   /mcp

   # Follow OAuth flows for:
   # - Stripe
   # - Sentry
   ```

3. **Verify GitHub Token**:
   ```bash
   # Ensure GITHUB_ACCESS_TOKEN is set in your environment
   echo $GITHUB_ACCESS_TOKEN
   ```

### Verifying Everything Works

```bash
# Check agents are available
/agents

# Check MCP servers are connected
/mcp

# Test an agent
> Use the test-engineer agent to run all tests

# Test an MCP server
> Use Stripe to check my subscription status
```

---

## 📚 Usage Examples

### Example 1: Secure Feature Development

```
> I'm adding a new API endpoint for user preferences.
> Use security-auditor to review it when I'm done.

[Write the API route]

> Security-auditor, please audit the new /api/user/preferences endpoint

[Security auditor finds issues]

> Fix the CSRF protection issue

[Apply fix]

> Security-auditor, verify the fix is correct

> Now use test-engineer to generate tests for this endpoint
```

### Example 2: Database Schema Change

```
> Use database-engineer to add a `theme` field to the User model
> The field should be optional and default to "light"

[Database engineer modifies schema]

> Run the migration in development

[Migration applied]

> Use test-engineer to verify database operations still work
```

### Example 3: Production Debugging

```
> Use Sentry to show me the top 5 errors from today

[Reviews errors]

> Use security-auditor to check if error #1 is a security issue

[Security audit complete]

> Use GitHub to create an issue for this error with the details from Sentry
```

### Example 4: AI Chat Optimization

```
> Use ai-integration-specialist to analyze our AI usage costs

[Reviews usage data]

> Optimize the chat endpoint to use Haiku for simple questions

[Optimization implemented]

> Use test-engineer to verify streaming still works correctly
```

### Example 5: Payment Issue Resolution

```
> Use Stripe to find all failed payments from user@example.com

[Reviews payment history]

> Create a new checkout session for them with the PRO plan

[Checkout session created]

> Use GitHub to update issue #123 with the resolution
```

---

## 🔧 Troubleshooting

### Agents Not Working

**Symptom**: `/agents` doesn't show custom agents

**Solution**:

```bash
# Verify agents directory exists
ls .claude/agents/

# Check agent file format
cat .claude/agents/security-auditor.md

# Restart Claude Code
```

### MCP Server Connection Failed

**Symptom**: "Could not connect to MCP server"

**Solution**:

```bash
# Check .mcp.json syntax
cat .mcp.json | jq .

# For remote servers, authenticate:
/mcp

# For stdio servers, check environment variables:
env | grep GITHUB_ACCESS_TOKEN

# Reset project choices if needed:
claude mcp reset-project-choices
```

### GitHub Server Not Starting

**Symptom**: GitHub MCP server fails to start

**Solution**:

```bash
# Verify token is set
echo $GITHUB_ACCESS_TOKEN

# Test the MCP server manually
npx @modelcontextprotocol/server-github

# Check logs
claude mcp list
claude mcp get github
```

### OAuth Authentication Issues

**Symptom**: "OAuth flow failed" for Stripe/Sentry

**Solution**:

```bash
# Clear browser cookies for the OAuth provider
# Try authentication again:
/mcp

# Select the server and follow the OAuth flow
# Ensure popup blockers are disabled
```

### Agent Not Being Used Proactively

**Symptom**: Agent exists but isn't invoked automatically

**Solution**:

- Ensure `description` field includes "PROACTIVELY" or "MUST BE USED"
- Make descriptions specific about when to use
- Explicitly mention the agent in your request
- Check that required tools are available

---

## 🎯 Best Practices

### For Agents

1. **Be Specific**: Mention the agent name explicitly when you want to use it
2. **Chain Agents**: Use multiple agents in sequence for complex workflows
3. **Review Output**: Always review agent suggestions before applying
4. **Update Regularly**: Keep agent prompts updated with project patterns

### For MCP Servers

1. **Authenticate Once**: OAuth flows only need to be completed once
2. **Environment Variables**: Keep sensitive tokens in environment, not code
3. **Rate Limits**: Be aware of API rate limits (especially GitHub)
4. **Monitor Usage**: Track MCP server usage to optimize API calls

### General Workflow

1. **Security First**: Always run security-auditor before deploying
2. **Test Everything**: Use test-engineer after major changes
3. **Database Safety**: Use database-engineer for all schema modifications
4. **Monitor Production**: Regularly check Sentry for errors

---

## 📖 Additional Resources

- **MCP Documentation**: https://modelcontextprotocol.io/
- **Claude Code Docs**: https://docs.claude.com/en/docs/claude-code
- **Stripe MCP**: https://docs.stripe.com/mcp
- **Sentry MCP**: https://docs.sentry.io/product/sentry-mcp/
- **GitHub MCP**: https://github.com/modelcontextprotocol/servers

---

## 🆘 Getting Help

If you encounter issues:

1. Check this guide first
2. Run `/help` in Claude Code
3. Check MCP server status with `/mcp`
4. Review agent configurations in `.claude/agents/`
5. Create an issue in the InfiniStar repository

---

**Last Updated**: 2025-11-07
**InfiniStar Version**: 0.0.2
