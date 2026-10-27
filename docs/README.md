# Funklix Documentation

The `docs` folder is the stable documentation foundation for Funklix. It gives future product, design, architecture, engineering, audit, decision, roadmap, feature-spec, and design-system work a shared reference point before implementation begins.

## Core Constitutions

The Constitution documents are stable references and should only change intentionally. They define the durable product, architecture, engineering, and design principles for the project:

- [Product Constitution](./constitution/product-constitution.md)
- [Product Architecture](./constitution/product-architecture.md)
- [Engineering Constitution](./constitution/engineering-constitution.md)
- [Design Constitution](./constitution/design-constitution.md)

## Documentation Workflow

Use this workflow for future Codex and human-led work:

1. **Product Check** — confirm the requested work aligns with the relevant Constitution documents.
2. **Audit** — inspect current behavior, files, risks, and blast radius before changing implementation.
3. **ADR if needed** — document architectural, product, or engineering decisions that affect future work.
4. **Implementation** — make the smallest safe change consistent with the audit and decisions.
5. **Test** — run appropriate checks and record results.
6. **Docs Update** — update relevant docs, feature specs, audits, or ADRs so future work has context.

## Documentation Rules

- Major features require an audit before implementation.
- Architectural decisions should be documented as ADRs.
- Constitution documents are stable references and should only change intentionally.

## Product Audits

- [BW-37.1C-3 — Contextual Canvas Actions Audit](./audits/bw37-1c3-contextual-canvas-actions-audit.md) — current Content security boundaries, eight-type Canvas inventory, contextual preview design and phased implementation prompt; documentation only.
- [BW-37.1C — AI Brain Action Handoffs Audit](./audits/bw37-1c-ai-brain-action-handoffs-audit.md) — verified handoff inventory, six action contracts and proposed one-field Profile MVP; documentation only, with no change to unrelated roadmap priorities.
- [BW-37.1B — Strategic Answer Quality & Context Intelligence Audit](./audits/bw37-1b-strategic-answer-quality-audit.md) — verified context provenance, evidence and formatting limitations, proposed minimal package, evaluation matrix and copyable implementation prompt; documentation only.
- [BW-37 — AI Brain 2.0 Strategic Advisor Audit](./audits/bw37-ai-brain-2-strategic-advisor-audit.md) — approved audit reference with verified implementation findings, proposed BW-37.1A MVP, deferred recommendations and the complete implementation prompt.

## Implementation Records

- [BW-37.1C-3B — Content Eligibility and Editable Preview](./implementations/bw37-1c-3b-content-eligibility-editable-preview.md) — exact asset selection, disclosed preparation, editable Content fields and read-only remote Create preflight.
- [BW-37.1C-3A — Content Proposal Hardening](./implementations/bw37-1c-3a-content-proposal-hardening.md) — persisted authorization, exact browser source scope, provider privacy and bounded transport; Content-only workflow preserved.
