# Product Requirements Document (PRD)

## Product Title

White-Label Institutional Workflow Platform for Tokenized Products

## Working Positioning Statement

A privacy-preserving, multi-party workflow platform for regulated institutions that sits above HydraX’s tokenisation, trading, and custody rails, designed for issuers, distributors, investors, and operations teams.

---

## 1. Executive Summary

This product is a white-label institutional workflow platform built on top of HydraX’s regulated capital markets infrastructure and aligned with Canton’s privacy-preserving, multi-party architecture.

The platform is not a competing tokenisation engine, exchange, or custody solution. Instead, it is the operational and experience layer that enables institutions to launch, distribute, service, and manage tokenized financial products through controlled workflows, role-based access, selective data visibility, and institutional-grade operational tooling.

The product is designed for regulated institutions that need a usable front-end and workflow orchestration layer over tokenisation, trading, and custody rails. It supports the full lifecycle of institutional digital products, from issuer onboarding and product setup to investor access, distributor workflows, servicing, approvals, exception handling, and auditability.

The core architectural stance is that building on Canton should be approached as designing a privacy-preserving, multi-party workflow platform for regulated institutions, not as deploying a generic blockchain app. The ledger is the shared truth layer. The application is the controlled operating layer that institutions actually use.

---

## 2. Product Vision

To become the institutional operating layer for tokenized financial products by enabling banks, brokerages, asset managers, distributors, and regulated market operators to manage digital asset workflows through a secure, white-label, role-based platform.

---

## 3. Problem Statement

HydraX already provides regulated infrastructure for tokenisation, exchange, dealing, and custody. However, institutions do not operate purely at the rail level. They require workflow systems, operating dashboards, onboarding portals, servicing interfaces, approval chains, exception handling, and relationship management tools that fit their internal processes and client-facing needs.

Today, the gap is not primarily core infrastructure. The gap is the institutional workflow layer above the infrastructure.

Institutions face the following problems:

1. Fragmented onboarding across issuers, distributors, and investors
2. Manual coordination between front office, operations, compliance, and counterparties
3. Limited visibility into lifecycle state across subscriptions, allocations, servicing, and approvals
4. Poor integration between tokenized rails and existing Web2 operational systems
5. Lack of white-label experiences suitable for institutional branding and distribution models
6. Operational burden caused by exceptions, escalations, missing documents, and multi-party coordination
7. Difficulty translating privacy-preserving ledger infrastructure into usable day-to-day workflows

---

## 4. Product Goals

### Primary Goals

* Provide a white-label workflow platform above HydraX’s regulated rails
* Enable end-to-end lifecycle workflows for tokenized product issuance, distribution, access, and servicing
* Support privacy-preserving multi-party workflows aligned with Canton’s architecture
* Deliver role-based experiences for issuers, distributors, investors, and operations teams
* Reduce operational friction, reconciliation burden, and manual coordination
* Make institutional adoption of tokenized products operationally practical

### Secondary Goals

* Improve speed-to-launch for new institutional digital products
* Enable internal and external auditability through workflow history and approval traces
* Support configurable deployment across multiple institutional clients
* Create a reusable platform architecture instead of one-off custom builds

### Non-Goals

* Building a competing exchange engine
* Building a competing custody system
* Building a new tokenisation protocol
* Building a retail-first trading app
* Building a public-chain DeFi application

---

## 5. Target Users

### 5.1 Issuers

Examples: banks, asset managers, structured product issuers, fund operators, private market originators

Needs:

* onboard their institution and teams
* set up products and issuance workflows
* manage documents, approvals, and eligibility constraints
* monitor subscriptions, allocations, and lifecycle status
* coordinate with distributors, custody, and operations

### 5.2 Distributors

Examples: private banks, wealth platforms, placement agents, brokers

Needs:

* view eligible products
* manage distribution workflows
* onboard end investors or investor entities
* track document completeness and subscription status
* coordinate allocations and post-trade servicing

### 5.3 Investors

Examples: institutional investors, accredited/professional investors, treasury desks, family offices

Needs:

* receive role-based access to relevant products and documents
* submit subscriptions/redemptions/transfers requests
* view holdings, allocations, notices, and servicing events
* manage permissions and authorized personnel

### 5.4 Operations Teams

Examples: product operations, onboarding ops, compliance ops, client servicing, reconciliation teams

Needs:

* review and approve tasks
* resolve exceptions
* monitor process queues and workflow bottlenecks
* access audit trails and status dashboards
* coordinate internally and across counterparties

### 5.5 Platform Admins

Examples: HydraX operators, institutional super admins, implementation teams

Needs:

* configure tenants and white-label branding
* manage role mappings and workflow rules
* monitor system health and environment status
* manage integration settings and deployment controls

---

## 6. Product Positioning

### Core Positioning

A white-label institutional workflow OS for tokenized products.

### Market Positioning

The platform is positioned as the application and workflow layer above HydraX’s regulated infrastructure.

### Strategic Message

HydraX provides the regulated rails. This platform provides the operational layer institutions actually use.

### Why This Matters

Institutions do not buy raw infrastructure alone. They buy control, efficiency, auditability, operational visibility, and client-ready workflow systems.

---

## 7. Solution Overview

The platform provides a modular workflow environment across four primary user groups:

* issuers
* distributors
* investors
* operations teams

It enables institutions to:

* onboard participants
* configure product workflows
* manage subscriptions and allocations
* route approvals and tasks
* process servicing requests
* monitor exceptions and lifecycle progress
* expose selective information to relevant parties only
* white-label the experience for institutional distribution

The platform uses HydraX as the infrastructure provider for tokenisation, trading, and custody, while using Canton-compatible design principles for privacy-preserving, multi-party data sharing and workflow coordination.

---

## 8. Core Product Modules

### 8.1 White-Label Tenant Framework

Provides institution-specific branding, domain setup, theming, role policy templates, and modular feature enablement.

Key capabilities:

* branded portal per tenant
* institution-specific domain and navigation
* configurable modules by tenant
* tenant-level workflow settings
* tenant-level user and permission controls

### 8.2 Issuer Workbench

Primary workspace for issuers to create, manage, and monitor tokenized product lifecycles.

Key capabilities:

* product setup wizard
* issuance checklist
* document room and disclosure management
* internal approval routing
* distributor coordination view
* investor eligibility rules configuration
* issuance lifecycle dashboard

### 8.3 Distributor Portal

Workflow environment for distributors and placement entities.

Key capabilities:

* product access by entitlement
* investor onboarding queue
* subscription intake workflows
* status tracking and outstanding requirement management
* allocation and distribution coordination
* investor communication support

### 8.4 Investor Portal

Institutional-facing access layer for eligible investors and investor representatives.

Key capabilities:

* secure role-based access
* entity profile and authorized user management
* subscription, redemption, and transfer requests
* holdings dashboard
* product documents and notices
* workflow status tracking
* communication and servicing history

### 8.5 Operations Console

Internal control tower for operations, compliance, and servicing teams.

Key capabilities:

* queue management
* exception tracking
* approval routing
* missing document and outstanding task tracking
* escalation workflows
* reconciliation checkpoints
* full workflow history and audit logs

### 8.6 Product Servicing Module

Post-issuance servicing and operational lifecycle management.

Key capabilities:

* subscriptions and redemptions
* transfers and amendments
* notices and corporate action communications
* valuation and reporting support
* servicing ticket and request handling
* approval and status workflows

### 8.7 Relationship and Coverage Dashboard

Optional module for issuer coverage teams, client-facing teams, and distribution leads.

Key capabilities:

* client and account status view
* activity timeline
* outstanding issues tracker
* product interest and engagement pipeline
* internal notes and coordination status

### 8.8 Reporting and Audit Module

Institutional reporting and compliance support.

Key capabilities:

* exportable workflow history
* approval traceability
* user activity logs
* operational KPI dashboards
* exception analytics
* tenant-level audit views

---

## 9. Functional Requirements

### 9.1 Onboarding and Access

* support onboarding for issuer, distributor, investor, and operator entities
* support entity-level and user-level onboarding
* support multi-step document collection workflows
* support configurable eligibility logic by tenant and product
* support role-based permissions and delegated access
* support status transitions such as draft, submitted, under review, approved, rejected, pending information

### 9.2 Workflow Orchestration

* support configurable workflow stages by product type and tenant
* support task assignment across teams and counterparties
* support approval chains and escalation rules
* support event-driven status changes
* support exception capture and resolution states
* support SLA tracking for key workflow steps

### 9.3 Product Setup and Lifecycle

* create and manage product definitions
* assign product metadata, lifecycle stages, and participant roles
* manage distribution rules and investor eligibility constraints
* track issuance milestones and post-launch lifecycle events
* support amendment handling and controlled updates

### 9.4 Subscription and Servicing

* intake subscription requests
* manage review and approval status
* record allocations and confirmations
* support redemption and transfer workflows
* support servicing requests and ticket resolution
* expose status selectively based on user role and stakeholder scope

### 9.5 Notifications and Communications

* notify users about status changes, missing requirements, approvals, and exceptions
* provide structured communication history per workflow
* support internal notes vs external messages with visibility controls
* support alerts for stuck items, missed SLAs, and pending escalations

### 9.6 Audit and Traceability

* log all key actions with actor, role, timestamp, and affected object
* maintain immutable workflow history views where applicable
* provide evidence trail for approvals and changes
* support tenant-specific export and reporting requirements

### 9.7 White-Label Administration

* configure tenant branding
* configure feature flags and modules per tenant
* configure workflow templates by tenant
* configure role and permission maps
* manage tenant users and organization structure

---

## 10. Architecture Principles

### 10.1 Core Principle

This is not a generic blockchain app. It is a privacy-preserving, multi-party workflow platform for regulated institutions.

### 10.2 Architectural Stance

* HydraX is the regulated infrastructure and execution rail layer
* The product is the workflow, experience, and orchestration layer
* Canton-aligned design principles govern privacy, role visibility, and shared state boundaries
* Web2 services remain essential for authentication, integration, reporting, documents, and operational dashboards

### 10.3 Design Principles

* privacy by design
* role-based disclosure
* modular tenant architecture
* workflow-first product design
* integration-friendly service boundaries
* auditability from day one
* upgradeable smart contract and process model alignment
* institutional UX over crypto-native UX

---

## 11. High-Level Technical Architecture

### 11.1 Frontend Layer

* white-label web portal framework
* separate role-aware interfaces for issuers, distributors, investors, and ops teams
* responsive enterprise UI with configurable module visibility

### 11.2 Backend Application Layer

* authentication and session management
* business API layer
* workflow orchestration services
* notification services
* reporting and read-model services
* tenant configuration services

### 11.3 Ledger and Rail Integration Layer

* integrations with HydraX tokenisation, trading, and custody rails
* Canton/Daml integration services for shared business state where relevant
* workflow adapters for ledger event consumption and command submission
* mapping between ledger state and application read models

### 11.4 Data and Read Model Layer

* operational database for non-ledger metadata and workflow state projections
* document metadata and status store
* search and reporting indexes
* audit and activity log store

### 11.5 External Integration Layer

* identity and SSO providers
* CRM systems
* KYC/KYB vendors
* document management systems
* reporting and analytics tools
* email and messaging services

---

## 12. Privacy and Security Model

The privacy model should follow Canton’s institutional logic: only relevant stakeholders should see relevant data.

Requirements:

* role-based and party-based visibility boundaries
* separation of internal and external notes/messages
* selective disclosure of workflow state and documents
* least-privilege authorization model
* tenant isolation
* full audit logging of sensitive actions
* encryption in transit and at rest
* secret and key management aligned with institutional deployment standards

Security priorities:

* strong authentication and SSO support
* fine-grained entitlements
* environment segregation
* action-level auditability
* operational admin controls
* hardened deployment pipelines

---

## 13. Web2 vs Web3 Design Approach

The platform should avoid crypto-native assumptions.

### Web2 Responsibilities

* authentication
* user management
* workflow UI
* document management
* notifications
* reporting
* operational dashboards
* integrations with institutional systems

### Web3 / Shared Ledger Responsibilities

* shared business truth between parties
* controlled state transitions for relevant workflow objects
* verifiable multi-party lifecycle coordination
* asset-linked event consistency
* privacy-preserving synchronization where applicable

### Product Conclusion

The best implementation is hybrid. The ledger is the coordinated truth layer. The application is the institutional operating layer.

---

## 14. User Flows

### 14.1 Issuer Launch Flow

1. issuer admin onboarded
2. issuer creates product workspace
3. product metadata and distribution configuration entered
4. internal approvals initiated
5. documents uploaded and reviewed
6. distributors granted scoped access
7. investor intake opens
8. subscriptions tracked and processed
9. allocations confirmed
10. post-launch servicing begins

### 14.2 Distributor Intake Flow

1. distributor user accesses entitled products
2. distributor begins investor onboarding
3. documents and eligibility requirements collected
4. missing items and exceptions tracked
5. subscription request submitted
6. issuer/ops review and confirmation occurs
7. investor receives visibility into status and holdings

### 14.3 Operations Exception Flow

1. workflow item flagged as exception
2. assigned team receives task
3. missing requirement or mismatch investigated
4. internal note or external request issued
5. item escalated if SLA breached
6. final resolution recorded with audit trail

### 14.4 Investor Servicing Flow

1. investor logs into white-label portal
2. investor views holdings and product notices
3. investor requests redemption or transfer
4. request enters ops review workflow
5. approvals and confirmations processed
6. investor receives final status and history

---

## 15. Integration Requirements

### HydraX Integration Assumptions

* platform consumes product, issuance, holdings, and transaction-related data from HydraX rails through agreed APIs/services
* platform can trigger relevant workflow-linked actions via HydraX integration layer
* platform does not replace HydraX core infrastructure

### Canton / Daml Integration Assumptions

* shared multi-party state is modeled in Daml where coordination and verifiability matter
* application reads from ledger via backend services, not directly from browser clients by default
* single-domain or single-synchronizer design should be used initially unless a multi-domain requirement is justified

### Other Integration Requirements

* SSO and institutional identity systems
* KYC/KYB providers
* email and notification infrastructure
* CRM and distribution systems
* file and document systems
* analytics and reporting platforms

---

## 16. Operational Requirements

* high availability for institutional user-facing services
* complete audit logging for critical actions
* environment isolation across development, staging, and production
* observability for workflows, integrations, and system health
* runbooks for exceptions, failures, and release rollback
* release management for both application services and smart contract packages
* support model for tenant onboarding and configuration

---

## 17. Non-Functional Requirements

### Performance

* dashboard and workflow page loads should feel enterprise-grade and responsive
* key operational actions should complete within acceptable institutional workflow latency
* notifications and status updates should propagate in near real time where feasible

### Reliability

* no silent workflow failures
* idempotent handling of critical actions
* retry strategy for integration failures
* durable audit and activity records

### Scalability

* support multiple institutional tenants
* support expanding product types and workflow variants
* support increasing numbers of users, requests, and operational events without redesign

### Compliance and Auditability

* immutable or evidence-grade action history where required
* exportable logs and reports
* support for approval and review evidence

### Maintainability

* modular codebase and service boundaries
* configurable workflow templates
* versioned contract and API lifecycle
* controlled upgrade path

---

## 18. MVP Scope

### Included in MVP

* white-label tenant framework
* issuer workbench
* distributor portal
* investor portal
* operations console
* onboarding workflows
* product setup and launch tracking
* subscription workflow
* approval and exception management
* notifications and audit logging
* HydraX integration layer for core workflow state

### Excluded from MVP

* advanced secondary market trading UX
* complex portfolio analytics
* full RM dashboard suite
* advanced token economics tooling
* fully generalized multi-domain workflow engine
* public API marketplace

---

## 19. Post-MVP Roadmap

### Phase 2

* expanded servicing workflows
* relationship manager dashboard
* workflow analytics and SLA intelligence
* configurable tenant workflow builder
* deeper CRM and reporting integrations

### Phase 3

* multi-entity distribution networks
* advanced cross-domain or multi-synchronizer support where justified
* product template marketplace
* institution self-service configuration tools
* AI-assisted ops and exception summarization

---

## 20. Key Risks

1. institutional workflow variance across clients may cause scope creep
2. unclear boundaries between app-layer responsibility and rail-layer responsibility
3. privacy and role visibility requirements may become complex quickly
4. operational exceptions may be more important than nominal flows
5. integration dependencies with HydraX and enterprise systems may slow implementation
6. multi-party governance may be harder than pure technical delivery
7. smart contract and application upgrades require disciplined change management

---

## 21. Success Metrics

### Business Metrics

* number of onboarded institutional tenants
* number of launched products using the platform
* onboarding cycle time reduction
* servicing turnaround time reduction
* operational workload reduction
* increase in product launch efficiency

### Product Metrics

* time to complete issuer setup
* time to onboard investor/distributor entity
* approval SLA performance
* exception resolution time
* workflow completion rate
* user adoption by role type

### Platform Metrics

* integration success rate
* system uptime
* event processing latency
* audit log completeness
* release success and rollback frequency

---

## 22. Open Questions

1. what exact HydraX APIs/services are available for workflow-layer integration?
2. which workflow objects should live as Daml contracts versus off-ledger read models?
3. what is the first target product type: fund, structured product, private credit, treasury, or equity-linked issuance?
4. which tenant persona is the first design center: issuer, distributor, or market operator?
5. what deployment model is preferred: single managed platform, dedicated tenant instances, or hybrid?
6. what institutional identity and entitlement standards must be supported first?
7. when does multi-domain Canton architecture become necessary rather than optional?

---

## 23. Strategic Recommendation

Start with a narrow, high-friction institutional workflow where HydraX’s rails are already valuable and operational inefficiency is obvious.

Recommended first wedge:
**Institutional onboarding + issuance + subscription servicing workspace for tokenized products**

Reason:

* directly aligned with HydraX strengths
* high institutional pain point
* clear multi-party workflow complexity
* naturally benefits from privacy-preserving design
* expandable into a broader workflow platform over time

---

## 24. Final Product Thesis

The winning product is not another blockchain front end.

The winning product is a white-label institutional workflow platform that makes HydraX’s regulated tokenisation, trading, and custody rails operationally usable for issuers, distributors, investors, and operations teams.

Built correctly, it becomes the digital operating layer for tokenized financial products in regulated markets.
    