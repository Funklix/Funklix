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
