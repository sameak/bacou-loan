# KOLi Claude Code Role Files

## Overview

These role definition files allow you to give Claude Code specific expertise and perspectives when working on different aspects of your KOLi project. Each role represents a different team member with unique skills and responsibilities.

## Files Included

1. **cto.md** - CTO & Co-founder (Strategic thinking, product direction)
2. **backend.md** - Senior Backend Engineer (APIs, database, integrations)
3. **devops.md** - DevOps Engineer (Reliability, security, monitoring)
4. **qa-support.md** - QA & Support Engineer (Testing, bug tracking, user support)
5. **junior-dev.md** - Junior Developer (Feature implementation, learning mindset)
6. **frontend.md** - Senior Frontend Engineer (React Native, UI/UX, performance)

## Setup

### Option 1: Project Directory (Recommended)

Create a `.claude/roles/` folder in your KOLi project:

```bash
cd /path/to/KOLi
mkdir -p .claude/roles
# Copy all .md files to .claude/roles/
```

### Option 2: Global Directory

Store roles globally for use across projects:

```bash
mkdir -p ~/.claude/roles
# Copy all .md files to ~/.claude/roles/
```

## How to Use

### Method 1: Direct Reference in VS Code

In Claude Code (VS Code), reference a role file directly:

```
@cto.md Should we add dark mode now or after launch?

@backend.md Create a Cloud Function to calculate monthly wages

@devops.md Set up Firebase monitoring and alerting

@qa-support.md Create test cases for wage verification

@junior-dev.md Implement the notes field for work sessions
```

### Method 2: Explicit Role Adoption

Ask Claude to adopt a specific role:

```
Please read .claude/roles/cto.md and adopt that role.

Now help me decide: should we build exchange rate comparison 
as a free or premium feature?
```

### Method 3: Role Switching

Switch between roles during a conversation:

```
// Start as CTO
"Claude, adopt the CTO role from .claude/roles/cto.md"
[Discuss strategy and priorities]

// Switch to backend engineer
"Now switch to senior-backend.md role"
[Implement the technical solution]

// Switch to QA
"Now switch to qa-support.md role"
[Test the implementation]
```

## When to Use Each Role

### Use **CTO** (@cto.md) for:
- Product strategy and roadmap
- Feature prioritization decisions
- Technology stack choices
- Build vs buy decisions
- Timeline and resource planning
- "Should we...?" questions

**Example prompts:**
```
@cto.md Should we add remittance features now or later?
@cto.md What should our tech stack be for KOLi?
@cto.md Help me prioritize these 10 feature requests
```

### Use **Senior Backend** (@backend.md) for:
- API design and implementation
- Database schema design
- Firebase Cloud Functions
- External API integrations
- Performance optimization
- Complex backend logic

**Example prompts:**
```
@backend.md Design the database schema for work sessions
@backend.md Create a Cloud Function for wage calculation
@backend.md How should we integrate with remittance APIs?
```

### Use **DevOps** (@devops.md) for:
- Deployment and CI/CD setup
- Monitoring and alerting
- Security configuration
- Firebase rules and permissions
- Cost optimization
- Disaster recovery planning

**Example prompts:**
```
@devops.md Set up Firebase Security Rules for KOLi
@devops.md Configure monitoring and alerts
@devops.md Create a deployment pipeline with GitHub Actions
```

### Use **QA/Support** (@qa-support.md) for:
- Test plan creation
- Bug documentation
- User support scenarios
- Release management
- Quality metrics
- Documentation writing

**Example prompts:**
```
@qa-support.md Create test cases for the monthly report feature
@qa-support.md Write a bug report for this crash
@qa-support.md How should we handle this user support request?
```

### Use **Junior Dev** (@junior-dev.md) for:
- Learning-focused explanations
- Step-by-step implementation
- Code with detailed comments
- Understanding user perspective
- Following existing patterns
- Simple feature implementation

**Example prompts:**
```
@junior-dev.md Explain how to add a new field to Firestore
@junior-dev.md Implement this UI component step-by-step
@junior-dev.md Help me understand this error message
```

## Best Practices

### 1. Choose the Right Role

Match the role to your task:
- Strategy question? → CTO
- Implementation question? → Backend Engineer
- Testing question? → QA Engineer
- Learning question? → Junior Developer

### 2. Provide Context

Even with roles, give context:
```
@backend.md 

Context: KOLi uses Firebase, React Native
We have 10K users, need to add exchange rate feature
Budget: $200/month

Question: Should we build our own rate aggregation 
or use a third-party service?
```

### 3. Combine Roles When Needed

Use multiple roles for complex decisions:
```
@cto.md First, help me decide if we should build this feature

[After decision]

@backend.md Now help me implement it

[After implementation]

@qa-support.md Now help me test it
```

### 4. Update Roles as You Grow

These roles reflect KOLi's current stage (pre-launch, solo founder).
As your project grows, update the role files to match your new context.

## Example Workflows

### Workflow 1: New Feature Development

```
Step 1: Strategy (CTO)
@cto.md Should we add dark mode? When? Free or premium?

Step 2: Design (Backend Engineer)
@backend.md Design the implementation for dark mode

Step 3: Security (DevOps)
@devops.md Any security considerations for this feature?

Step 4: Testing (QA)
@qa-support.md Create test cases for dark mode

Step 5: Implementation (Junior Dev)
@junior-dev.md Implement the dark mode toggle step-by-step
```

### Workflow 2: Bug Investigation

```
Step 1: Report (QA)
@qa-support.md Help me write a proper bug report for this crash

Step 2: Investigation (Backend)
@backend.md Analyze this error log and find root cause

Step 3: Fix (Junior Dev)
@junior-dev.md Implement the fix for this bug

Step 4: Prevention (DevOps)
@devops.md Add monitoring to prevent this bug in future
```

### Workflow 3: Architecture Decision

```
Step 1: Options (CTO)
@cto.md What are our options for implementing remittance?

Step 2: Technical Analysis (Backend)
@backend.md Analyze each option technically

Step 3: Operations Impact (DevOps)
@devops.md What are the operational implications?

Step 4: Testing Impact (QA)
@qa-support.md How would we test each option?

Final: Decision (CTO)
@cto.md Based on all inputs, what should we do?
```

## Tips for Success

1. **Be Specific**: The more context you provide, the better the response
2. **One Role at a Time**: Don't mix roles in a single prompt
3. **Trust the Expertise**: Each role has specific knowledge - use it!
4. **Iterate**: Roles can have back-and-forth conversations
5. **Learn**: Junior dev role is great for understanding concepts

## Customization

Feel free to customize these roles for your needs:

- Add your specific technologies
- Update priorities as they change
- Add project-specific guidelines
- Include your coding standards
- Reflect your current stage

## Questions?

If you're unsure which role to use:
- **Strategic/business question?** → CTO
- **How to build something?** → Senior Backend
- **Infrastructure/deployment?** → DevOps
- **Testing/quality?** → QA/Support
- **Learning/understanding?** → Junior Dev

---

**Remember**: These roles are tools to help you build KOLi faster and better. Use them to get the expertise you need, when you need it!

Built with ❤️ for KOLi - Your Korea Life Platform
