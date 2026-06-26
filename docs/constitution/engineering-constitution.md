---
last_updated: 2026-06-26
owner: Engineering
status: Approved
title: Funklix Engineering Constitution
version: 1.0
---

# Funklix Engineering Constitution

## Purpose

This document defines how software is built inside Funklix.

It exists to preserve stability, reduce technical debt, and ensure every
implementation strengthens the product instead of introducing
unnecessary risk.

Whenever implementation speed conflicts with product stability,
stability wins.

------------------------------------------------------------------------

# Engineering Principles

## 1. Stability Over Speed

Working software is always more valuable than fast software.

Prefer one safe change over multiple risky changes.

Never rush changes that affect the core product.

------------------------------------------------------------------------

## 2. Audit Before Implementation

Every significant implementation starts with an audit.

The audit should answer:

-   What exists today?
-   Which files are involved?
-   What depends on this?
-   What could break?
-   What is the smallest safe change?

Never implement based on assumptions.

------------------------------------------------------------------------

## 3. Additive Changes Only

Whenever possible:

-   extend existing systems
-   add new capabilities
-   preserve working behavior

Avoid unnecessary rewrites and large refactors.

------------------------------------------------------------------------

## 4. Protect Campaign Canvas

Campaign Canvas is the heart of Funklix.

Any change affecting Canvas must evaluate impact on:

-   node rendering
-   edge rendering
-   layout
-   save/load
-   autosave
-   inspector
-   collaboration
-   ownership
-   generation pipeline

------------------------------------------------------------------------

## 5. Respect Existing Contracts

DOM IDs, event flows, data contracts and public interfaces are part of
the system.

Do not remove or rename them without proving they are unused.

Visual removal is preferred over structural removal.

------------------------------------------------------------------------

## 6. Scope Discipline

One Pull Request should solve one problem.

Avoid mixing:

-   UI redesign
-   architecture
-   authentication
-   storage
-   canvas logic
-   AI generation

Small focused changes are easier to review, test and revert.

------------------------------------------------------------------------

## 7. Understand the Blast Radius

Before changing code identify:

-   direct dependencies
-   indirect dependencies
-   shared utilities
-   rendering paths
-   persistence paths
-   AI pipeline impact

Document the blast radius before implementation.

------------------------------------------------------------------------

## 8. Test Every Change

Every implementation should verify:

-   expected behavior
-   existing behavior
-   regressions
-   console errors
-   save/load
-   UI integrity

Never assume a change is safe because it compiles.

------------------------------------------------------------------------

## 9. Document Important Decisions

If an implementation changes architecture, ownership or engineering
direction:

-   update documentation
-   create an ADR when appropriate
-   explain the reasoning

Future developers should understand why a decision was made.

------------------------------------------------------------------------

## 10. Optimize Last

Correctness.

Reliability.

Maintainability.

Performance.

Optimize only after the system is correct and stable.

------------------------------------------------------------------------

# Campaign V3 Rules

Campaign V3 follows additional engineering principles:

-   Quality Gate validates before commit.
-   Repair loops should target only affected nodes.
-   Never overwrite good AI output with fallback content.
-   Prefer repairing over regenerating entire campaigns.
-   Structural validation comes before optimization.
-   Strategic diagnostics should remain deterministic unless
    intentionally AI-powered.

------------------------------------------------------------------------

# Definition of Done

A feature is complete when:

-   implementation works
-   existing behavior is preserved
-   no known regressions exist
-   audit findings are addressed
-   tests pass
-   documentation is updated where necessary

Code is not finished when it merely compiles.

------------------------------------------------------------------------

# Decision Checklist

Before merging ask:

1.  Is the implementation the smallest safe change?
2.  Was an audit completed?
3.  Was the blast radius understood?
4.  Were existing systems protected?
5.  Are tests sufficient?
6.  Is documentation still accurate?

If any answer is "No", do not merge yet.

------------------------------------------------------------------------

# Closing Principle

Engineering excellence at Funklix is measured by confidence, not speed.

The best implementation is the one users never notice because everything
simply continues to work.
