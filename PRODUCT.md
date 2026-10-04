# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Fijians abroad, first: adults in the diaspora reconnecting with Fijian language and culture, often on phones and often on slower connections. The site is open to all, including Learners of Fijian generally and families using it together through a caregiver (CONTEXT.md). Staff (editors, educators, reviewers, the safeguarding lead, the privacy contact and administrators) work on a separate admin host.

## Product Purpose

A digital connection and learning platform for Fijians abroad, open to all. It connects people with cultural stories, media, existing learning providers, creators and optional video-based language learning. Success is a visitor finding trustworthy, reviewed cultural and language material and knowing exactly what it was reviewed for.

## Positioning

Every public claim of review is generated from the Review Approvals that actually exist on the exact Revision shown (ADR-0003, ADR-0006), and nothing is served unless its rights are current (ADR-0007). Cultural material that needs it carries a Knowledge Holder Approval.

## Operating Context

Six primary areas: Learn, Voices, Discover, Connect, E-zine and Resources (docs/phase-1a-defaults.md §5). Canonical URLs are `/{area}/{slug}`. Content is written and reviewed on the admin site, then published; public pages are server-rendered on Cloudflare Workers and edge-cached for at most five minutes.

## Capabilities and Constraints

- Public pages ship no client JavaScript unless a page needs interaction, and run under a strict content security policy: no inline scripts or styles.
- Services not live yet (Learning Layers, provider listings, forms, the newsletter) say so plainly (PUB-01) instead of looking broken or being hidden.
- The product name is written **Na iSema**.
- Partners appear only where a Partnership Agreement exists (docs/phase-1a-defaults.md §5; recorded from the docs, not re-confirmed).

## Brand Commitments

- PRD §28 direction, binding: clean typography, off-white and deep teal, restrained tapa-inspired depth (docs/phase-1a-defaults.md §6).
- No generic "verified" badge anywhere; only Review Labels generated from real approvals (PUB-02).
- Placeholder imagery is labelled as placeholder until commissioned, culturally reviewed artwork arrives. No fabricated cultural imagery.

## Evidence on Hand

No commissioned imagery, testimonials, partners or statistics exist yet; none may be invented. Real content arrives through the admin site.

## Product Principles

1. Say exactly what was reviewed, never more.
2. Be honest about what isn't available yet.
3. Respect cultural knowledge and the people who hold it.
4. Work well on a phone on a slow connection.

## Accessibility & Inclusion

WCAG 2.2 AA (A11Y-01–04): keyboard use, 200% zoom and 320 px reflow; axe runs in CI. Manual screen-reader passes before release (docs/phase-1a-defaults.md §6).
