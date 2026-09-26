<!--
Sync Impact Report - 2025-11-12
═══════════════════════════════════════════════════════════════════════
Version Change: 1.0.0 → 1.0.1

Action: Patch update - Clarifications and consistency improvements

Modified Principles: None (wording improvements only)
Added Sections: None
Removed Sections: None

Changes:
  - Clarified TDD workflow with explicit Red-Green-Refactor cycle
  - Enhanced complexity justification guidelines
  - Improved browser support specifications
  - Clarified template compliance verification process
  - Minor wording improvements for consistency
  - Updated last amended date

Templates Status:
  ✅ plan-template.md - Aligned with constitution principles
  ✅ spec-template.md - Aligned with user story and testing requirements
  ✅ tasks-template.md - Aligned with test-first and phase-based approach
  ✅ checklist-template.md - Verified alignment with quality gates
  ✅ agent-file-template.md - Verified alignment with principles

Follow-up TODOs: None
═══════════════════════════════════════════════════════════════════════
-->

# Ammoura Constitution

## Core Principles

### I. Component-First Architecture

Every feature MUST be built as a modular, reusable component:

- Components MUST be self-contained with clear boundaries
- Each component MUST have a single, well-defined responsibility
- Components MUST be independently testable without external dependencies
- No organizational-only components - each must serve a concrete user or
  technical need

**Rationale**: Component-first architecture ensures scalability,
maintainability, and reusability across the eCommerce platform. This principle
prevents monolithic code and enables parallel development.

### II. Type Safety & Developer Experience

Strong typing and excellent developer experience are NON-NEGOTIABLE:

- All code MUST use TypeScript with strict mode enabled
- Type definitions MUST be explicit - no implicit `any` types
- SvelteKit's App namespace types MUST be leveraged for platform integration
- IDE support MUST be maintained through proper type exports and JSDoc
  annotations

**Rationale**: Type safety catches errors at compile time, improves code
documentation, enables better refactoring, and enhances developer productivity
through IntelliSense and autocomplete.

### III. Test-First Development (NON-NEGOTIABLE)

TDD is mandatory for all feature development following the Red-Green-Refactor
cycle:

- Tests MUST be written BEFORE implementation (commit tests first)
- Tests MUST fail initially - RED phase (verify test is valid)
- Implementation MUST make tests pass - GREEN phase (minimal code)
- Code MUST be refactored for quality - REFACTOR phase (improve while tests
  pass)
- Coverage MUST exceed 80% for new code (run `npm run test:coverage`)
- Test independence MUST be maintained (no shared mutable state)

**Rationale**: Test-first development ensures code meets requirements, prevents
regressions, improves design through testability constraints, provides living
documentation of system behavior, and enables confident refactoring.

### IV. User Story Driven Development

All features MUST be defined through prioritized, independently testable user
stories:

- Each user story MUST be assigned a priority (P1, P2, P3, etc.)
- User stories MUST be independently implementable and deliverable
- Each story MUST provide standalone value (MVP slice)
- Acceptance criteria MUST use Given-When-Then format
- User stories MUST be testable in isolation

**Rationale**: User story driven development ensures customer value delivery,
enables incremental releases, supports parallel development, and maintains focus
on user needs over technical preferences.

### V. Edge-First Performance

The platform MUST leverage Cloudflare's edge network for optimal performance:

- Edge-side rendering MUST be used where appropriate
- Static assets MUST be optimized for edge caching
- API responses MUST be cacheable at edge when possible
- Platform-specific features (Workers, KV, R2) MUST be used judiciously
- Performance budgets MUST be defined and monitored

**Rationale**: Edge-first architecture delivers global performance, reduces
latency, improves user experience, and leverages Cloudflare's infrastructure
investment efficiently.

### VI. Code Quality & Consistency

Consistent code quality is enforced through automated tooling:

- ESLint MUST pass for all code
- Prettier MUST format all code (2 spaces, semicolons, single quotes)
- SvelteKit conventions MUST be followed (routes/, lib/, stores/, types/)
- Naming conventions MUST be consistent: camelCase for variables/functions,
  PascalCase for components/stores, UPPER_SNAKE_CASE for constants
- All public APIs MUST have JSDoc documentation

**Rationale**: Automated quality enforcement reduces cognitive load, prevents
style debates, improves code readability, and ensures maintainability across
team members.

### VII. Simplicity & Pragmatism

Start simple, add complexity only when justified:

- YAGNI (You Aren't Gonna Need It) principle MUST be applied
- Premature optimization MUST be avoided
- New dependencies MUST be justified by clear need
- Complex patterns MUST document why simpler alternatives were rejected
- Technical debt MUST be tracked and addressed incrementally

**Rationale**: Simplicity reduces maintenance burden, accelerates development,
lowers onboarding time, and prevents over-engineering. Complexity is a liability
that must earn its place.

## Technical Standards

### Technology Stack

**REQUIRED** technologies for the Ammoura platform:

- **Framework**: SvelteKit 2.0+ with TypeScript 5.0+
- **Deployment**: Cloudflare Pages with adapter-cloudflare
- **Package Manager**: npm (lockfile MUST be committed)
- **Node Version**: 18+ (specified in package.json engines field)
- **Testing**: Vitest for unit/integration tests
- **Linting**: ESLint 9+ with Prettier integration
- **Version Control**: Git with conventional commit messages

### Browser & Platform Support

- **Modern Browsers**: Last 2 versions of Chrome, Firefox, Safari, Edge
- **Mobile**: iOS 15+, Android Chrome (last 2 major versions)
- **Responsive Breakpoints**: Mobile (<768px), Tablet (768-1024px), Desktop
  (>1024px)
- **Progressive Enhancement**: Core functionality MUST work without JavaScript
  where feasible
- **Accessibility**: WCAG 2.1 AA compliance REQUIRED for all user-facing
  features

### Security Requirements

- **Authentication**: MUST use secure, industry-standard protocols
- **Data Validation**: All user inputs MUST be validated server-side
- **Secrets**: MUST never be committed to version control
- **Dependencies**: MUST be regularly audited for vulnerabilities
- **HTTPS**: MUST be enforced in production

### Performance Standards

- **Time to Interactive**: < 3 seconds on 3G network
- **First Contentful Paint**: < 1.5 seconds
- **Bundle Size**: Monitor and justify increases
- **Lighthouse Score**: Target 90+ for Performance, Accessibility, Best
  Practices, SEO

## Development Workflow

### Feature Development Process

1. **Specification**: Create spec.md with user stories (use spec-template.md)
2. **Planning**: Generate plan.md with technical approach (use plan-template.md)
3. **Constitution Check**: Verify compliance with all principles BEFORE coding
4. **Test Creation**: Write failing tests for first user story
5. **Implementation**: Make tests pass with minimal code
6. **Refactor**: Improve code quality while keeping tests green
7. **Review**: Code review MUST verify constitution compliance
8. **Iterate**: Repeat for each user story in priority order

### Pull Request Requirements

All PRs MUST include:

- **Description**: What changes and why
- **Constitution Check**: Which principles apply and how compliance is achieved
- **Tests**: Evidence of test-first development (tests committed before
  implementation)
- **Documentation**: Updated docs if public API changes
- **No Violations**: ESLint and type check MUST pass
- **Review**: At least one approving review required

### Branching Strategy

- **Main Branch**: `main` - always deployable
- **Feature Branches**: `###-feature-name` format (number from spec)
- **Hotfixes**: `hotfix-description` for production issues
- **No Direct Commits**: Main branch MUST be protected

### Quality Gates

Before merge, ALL of the following MUST pass:

1. ✅ All tests pass (`npm test`)
2. ✅ Type checking passes (`npm run check`)
3. ✅ Linting passes (`npm run lint`)
4. ✅ Build succeeds (`npm run build`)
5. ✅ Constitution compliance verified
6. ✅ Code review approved

## Governance

### Constitutional Authority

This constitution supersedes all other development practices, guidelines, and
conventions. In case of conflict between this document and other guidance:

1. Constitution takes precedence
2. Conflict MUST be documented
3. Either constitution is amended OR conflicting practice is updated
4. Migration plan MUST be created for existing code if needed

### Amendment Process

To amend this constitution:

1. **Proposal**: Document proposed change with rationale
2. **Impact Analysis**: Identify affected code, templates, and workflows
3. **Review**: Technical leadership MUST review and approve
4. **Version Bump**: Follow semantic versioning (see below)
5. **Propagation**: Update all dependent templates and documentation
6. **Communication**: Announce changes to all team members
7. **Migration**: Create plan for bringing existing code into compliance

### Versioning Policy

Constitution version follows semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Backward-incompatible governance changes, principle removals, or
  redefinitions that require code changes
- **MINOR**: New principles added, sections expanded, or new requirements that
  don't break existing compliant code
- **PATCH**: Clarifications, wording improvements, typo fixes, formatting
  changes

### Compliance Review

- **Every PR**: Constitution check REQUIRED in PR description
- **Quarterly**: Review constitution for needed updates based on team feedback
- **Post-Mortem**: Review constitution after incidents or significant issues
- **Onboarding**: New team members MUST read and acknowledge constitution

### Complexity Justification

When violating YAGNI or Simplicity principles, justification MUST include:

- **What**: Specific complexity being added (concrete implementation details)
- **Why**: Problem that simpler solution cannot solve (with evidence)
- **Alternatives**: Simpler approaches considered and why rejected (minimum 2
  alternatives)
- **Cost**: Maintenance burden being accepted (explicit trade-offs)
- **Mitigation**: How complexity is contained and documented
- **Review**: Complexity MUST be reviewed and approved (documented in PR)

**Documentation Location**: Document in plan.md under "Complexity Tracking"
section or in PR description under "Constitution Check".

### Guidance Files

For runtime development guidance not covered in this constitution, refer to:

- **AGENTS.md**: AI assistant guidelines and code style conventions
- **README.md**: Project setup and deployment instructions
- **.github/copilot-instructions.md**: Comprehensive development guidelines and
  patterns
- **.specify/templates/**: Feature specification and planning templates
- **docs/**: Detailed technical documentation for core features

### Hierarchy of Authority

When guidance conflicts between documents, follow this priority order:

1. This Constitution (highest authority)
2. .github/copilot-instructions.md (comprehensive technical guidance)
3. AGENTS.md (AI assistant specific patterns)
4. README.md (project overview)
5. docs/ folder (feature-specific documentation)

**Version**: 1.0.1 | **Ratified**: 2025-10-20 | **Last Amended**: 2025-11-12
