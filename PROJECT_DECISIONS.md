# Yundor Market Intelligence Project Decisions

This document records important architectural and business decisions.

Before changing existing systems, AI agents must review this file.

These decisions represent intentional choices made during project development.

---

# Decision 001

## Separate Technical Qualification and Commercial Fit

Date:

Sprint 14.19

Decision:

Buyer evaluation must separate:

1. Technical Qualification

and

2. Commercial Fit

Reason:

Large importers are not always suitable Yundor customers.

A company may have:

- high shipment volume
- strong import activity

but still have low OEM/ODM potential.

Therefore:

Business suitability must be evaluated separately from import scale.

Status:

Active

---

# Decision 002

## ImportYeti Capture First, Production Later

Date:

Sprint 14.11

Decision:

New ImportYeti data must go through:

Capture → Validation → Production

Do not directly write paid API results into production database.

Reason:

Trade data quality needs verification before becoming permanent business data.

Benefits:

- Prevent bad data pollution
- Validate API response
- Reduce unnecessary credit usage

Status:

Active

---

# Decision 003

## Protect ImportYeti Credit Budget

Date:

Sprint 14.8

Decision:

Maintain strict ImportYeti credit management.

Rules:

- Total budget: 100 credits
- Keep reserve whenever possible
- Report credit usage after every paid operation

Reason:

Paid trade data should only be used when it creates clear business value.

Status:

Active

---

# Decision 004

## Preserve External Data and Never Destroy Better Data

Date:

Sprint 14.x

Decision:

External data enrichment must not overwrite richer existing data.

Rules:

Never:

- replace full address with incomplete address
- replace existing website with NULL
- remove existing supplier information

Use:

- source tracking
- verification status
- enrichment layers

Reason:

Trade intelligence data improves over time.

Historical information must be preserved.

Status:

Active

---

# Decision 005

## Qualification Model Should Rank Customers, Not Find All Companies

Date:

Sprint 14.16-14.17

Decision:

The scoring engine exists to prioritize sales effort.

It should not simply rank:

"largest importers"

It should identify:

"most valuable Yundor prospects"

Evaluation factors include:

- shipment volume
- buyer type
- product relevance
- company size
- commercial fit

Status:

Active

---

# Decision 006

## Large Company Does Not Equal Best Customer

Date:

Sprint 14.19

Decision:

Company size alone cannot determine priority.

Example:

Large brands may have:

- established supply chains
- internal sourcing teams
- low OEM requirements

Therefore:

Commercial Fit is required.

Status:

Active

---

# Decision 007

## Avoid Endless Model Optimization Before Business Validation

Date:

Sprint 14.20+

Decision:

Do not continuously add scoring factors without business validation.

Current goal:

Move from:

Customer discovery

to:

Customer outreach and validation.

Reason:

A working sales workflow creates more value than theoretical scoring improvement.

Status:

Active

---

# Decision 008

## AI Development Workflow

Date:

AI Agent Integration

Decision:

Development roles are separated:

ChatGPT:

- Architecture
- Planning
- Sprint design
- Review
- Acceptance

OpenCode:

- Execution environment
- Agent management
- Code operations

DeepSeek:

- Implementation
- Refactoring
- Debugging

Reason:

Separate strategic decisions from repetitive coding work.

Status:

Active

---

# Decision 009

## Incremental Development Over Large Rewrites

Date:

Project foundation

Decision:

Prefer:

- small changes
- backward compatibility
- existing architecture reuse

Avoid:

- unnecessary rewrites
- replacing working systems
- adding duplicate pipelines

Reason:

The system contains validated business logic that should be preserved.

Status:

Active

---

# Decision 010

## Current Strategic Direction

Date:

Sprint 15

Decision:

The project is moving from:

Buyer Intelligence System

towards:

Sales Intelligence System

Future development priority:

1. Contact discovery
2. CRM workflow
3. Outreach execution
4. Customer feedback loop

Reason:

The goal is not only finding companies.

The goal is helping Yundor acquire customers.

Status:

Active
