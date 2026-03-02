# Multi-Role Collaboration Patterns for KOLi

## Overview

While Claude Code can't run multiple roles truly simultaneously, you can use these patterns to get multi-perspective input efficiently.

---

## Pattern 1: Team Meeting (Best for Big Decisions)

**Use the team.md role:**

```
@team.md

Should we build exchange rate comparison feature?
- Free or premium?
- Now or later?
- API partners or build our own?
```

**You Get:**
- All perspectives in one response
- Conflicts identified
- Synthesized recommendation
- Action items assigned to roles

**Best For:**
- Strategic decisions
- Feature planning
- Conflicting priorities
- Resource allocation

---

## Pattern 2: Sequential Consultation

**Ask each role individually, then synthesize:**

```
Step 1: Strategy
@cto.md Should we add this feature?
[Get answer]

Step 2: Technical
@backend.md How would we implement this?
[Get answer]

Step 3: Operations
@devops.md What are the operational impacts?
[Get answer]

Step 4: Quality
@qa-support.md How do we test this?
[Get answer]

Step 5: You Decide
Based on all inputs, make final decision
```

**Best For:**
- Deep dive into each area
- Learning process
- When you need detailed expertise
- Building comprehensive understanding

---

## Pattern 3: Review Chain

**Have roles review each other's work:**

```
Step 1: Implementation
@junior-dev.md Build the login form component
[Get code]

Step 2: Code Review
@backend.md Review this code for:
- Security issues
- Performance problems
- Best practices
[Paste the code from step 1]

Step 3: Operations Review
@devops.md Review from security perspective
[Paste the code]

Step 4: Testing
@qa-support.md Create test cases for this
[Describe the component]
```

**Best For:**
- Code quality
- Comprehensive reviews
- Learning from feedback
- Catching different types of issues

---

## Pattern 4: Debate Format

**Create a debate between two perspectives:**

```
You are moderating a debate between the CTO and DevOps Engineer.

Read @cto.md and @devops.md

Topic: Should we optimize for speed or reliability?

CTO argues: Speed to market is critical
DevOps argues: Reliability is non-negotiable

Present both arguments, then recommend a balanced approach.
```

**Best For:**
- Resolving trade-offs
- Understanding tensions
- Finding middle ground
- Decision-making with competing priorities

---

## Pattern 5: Staged Implementation

**Use different roles at different project stages:**

```
WEEK 1 (Planning):
@cto.md Plan the feature roadmap
@team.md Validate the plan

WEEK 2 (Design):
@backend.md Design the architecture
@devops.md Review security implications

WEEK 3 (Build):
@junior-dev.md Implement the features
@backend.md Review the code

WEEK 4 (Test):
@qa-support.md Test everything
@devops.md Set up monitoring

WEEK 5 (Launch):
@team.md Final go/no-go decision
```

**Best For:**
- Feature development lifecycle
- Structured approach
- Clear phase gates
- Team coordination

---

## Pattern 6: Problem-Solving Workshop

**Tackle problems from all angles:**

```
@team.md

PROBLEM: App is slow on old Android devices

Analyze from each perspective:
- What's causing it? (Backend)
- How to fix it? (Junior Dev)
- How to prevent it? (DevOps)
- How to test improvements? (QA)
- Is it worth fixing now? (CTO)

Give me a complete problem-solving session.
```

**Best For:**
- Debugging complex issues
- Root cause analysis
- Solution brainstorming
- Holistic problem-solving

---


## Pattern 7: Role Handoff

**Pass work between roles like a relay:**

```
Round 1:
@cto.md Define requirements for wage calculator

Round 2:
@backend.md Design the implementation
[Based on CTO requirements]

Round 3:
@junior-dev.md Implement the calculator
[Based on backend design]

Round 4:
@qa-support.md Test the implementation
[Based on requirements]

Round 5:
@devops.md Deploy and monitor
[Based on implementation]
```

**Best For:**
- End-to-end feature development
- Clear handoffs
- Accountability at each stage
- Learning the full process

---

## Quick Reference: Which Pattern When?

```
NEED: Strategic decision
USE: Pattern 1 (Team Meeting)

NEED: Deep expertise
USE: Pattern 2 (Sequential Consultation)

NEED: Quality assurance
USE: Pattern 3 (Review Chain)

NEED: Resolve conflict
USE: Pattern 4 (Debate Format)

NEED: Full feature lifecycle
USE: Pattern 5 (Staged Implementation)

NEED: Solve complex problem
USE: Pattern 6 (Problem-Solving Workshop)

NEED: Build complete feature
USE: Pattern 7 (Role Handoff)
```

---

## Advanced: Custom Multi-Role Prompts

### Example: Feature Planning Session

```markdown
MULTI-ROLE FEATURE PLANNING

You have access to these roles:
@cto.md, @backend.md, @devops.md, @qa-support.md

Feature: Exchange Rate Comparison

Provide:

1. CTO Analysis:
   - Should we build this?
   - Priority vs other features?
   - Free or premium?

2. Backend Design:
   - Architecture approach
   - API integration strategy
   - Data model

3. DevOps Planning:
   - Infrastructure needs
   - Security considerations
   - Monitoring requirements

4. QA Strategy:
   - Test scenarios
   - Quality metrics
   - User acceptance criteria

5. INTEGRATED PLAN:
   - Timeline with milestones
   - Resource allocation
   - Risk mitigation
   - Success criteria
```

### Example: Monthly Review

```markdown
MONTHLY TEAM REVIEW

Consult all roles:
@cto.md, @backend.md, @devops.md, @qa-support.md

Last Month's Goals:
- Launch MVP ✅
- Get 100 users ✅
- Maintain 99% uptime ⚠️ (98.5%)
- Fix all P0 bugs ✅

Each role provides:
1. What went well
2. What needs improvement
3. Priorities for next month

Then synthesize into:
- Key achievements
- Action items
- Updated roadmap
```

---

## Tips for Effective Multi-Role Use

### DO:
✅ Use team meetings for decisions affecting multiple areas
✅ Use sequential consultation for learning
✅ Use review chains for quality
✅ Document the outputs
✅ Act on the recommendations

### DON'T:
❌ Use team meeting for simple questions
❌ Ignore role conflicts (they reveal important trade-offs)
❌ Use multiple roles for every tiny decision
❌ Forget you're still the final decision-maker

---

## Example Workflow: Complete Feature Development

```
DAY 1: Planning
@team.md Should we build dark mode?
[Get team decision]

DAY 2: Design
@backend.md Design dark mode implementation
[Get architecture]

DAY 3: Security
@devops.md Review security for dark mode
[Get security checklist]

DAY 4-7: Implementation
@junior-dev.md Implement dark mode
[Build the feature]

DAY 8: Code Review
@backend.md Review dark mode code
[Get feedback, make improvements]

DAY 9-10: Testing
@qa-support.md Create test plan and test dark mode
[Execute tests]

DAY 11: Monitoring Setup
@devops.md Set up monitoring for theme switching
[Add metrics]

DAY 12: Launch Review
@team.md Final go/no-go for dark mode launch
[Make launch decision]

DAY 13: Launch!
@devops.md Deploy dark mode to production
[Deploy and monitor]

DAY 14: Retrospective
@team.md Review dark mode launch
[Learn and improve]
```

---

## The Truth About "Simultaneous" Roles

**Reality:**
You're not getting 5 people working independently. You're getting one very smart AI that can:
- Think from multiple perspectives
- Identify conflicts between viewpoints
- Synthesize balanced recommendations
- Help you make better decisions

**This is valuable because:**
- Solo founders need diverse perspectives
- You avoid blind spots
- Decisions are more balanced
- You learn to think like each role

**But remember:**
- You're still the founder
- You make final decisions
- These are tools, not replacements for thinking
- Real user feedback > any role simulation

---

## Start Simple, Scale Up

**Week 1:** Just use individual roles
**Week 2:** Try sequential consultation
**Week 3:** Try team meeting for one big decision
**Week 4:** Experiment with different patterns

Find what works for your workflow!

---

Built for KOLi - Your AI-powered development team 🚀
