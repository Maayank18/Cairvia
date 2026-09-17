# Cairvia — Product Contract

**Codename:** Cairvia  
**Positioning:** The continuity layer for human work  
**Tagline:** Keep the thread. Continue the work.

This file is the product contract. Implementation follows it. When code and this document disagree, change the code unless this document is explicitly revised.

## What Cairvia is

A persistent, user-controlled Work Thread system that preserves the state required to continue work: intent, current state, blockers, pending decisions, and **one next action**.

Cairvia is not a to-do list, chatbot, task decomposer, calendar optimizer, surveillance assistant, or autonomous Jarvis.

## Surfaces

- **Orb (Electron):** execution surface. Low distraction.
- **Control Center (web):** understanding and control. Not a giant dashboard.
- **Chrome extension:** permitted context only (not Phase 1).

Rule: Orb for action. Control Center for understanding and control.

## Primary domain object

`WorkThread` is the aggregate root. Tasks may exist as children later. Do not build a generic task manager.

Required thread fields: id, intent, desiredOutcome, currentState, nextAction, blockers, decisions, evidenceRefs, lastValidatedAt, status, createdAt, updatedAt, confidence, recoveryCapsule, userPreferencesSnapshot.

Statuses: `DRAFT | ACTIVE | PAUSED | BLOCKED | INTERRUPTED | RECOVERABLE | COMPLETED | ARCHIVED`

Never encode core business state only with booleans.

## Phase 1 definition of done

The user can: open the Orb; see the current Thread; see the next action; click Resume/Start; open a relevant URL or local target; mark progress; stop work; create a recovery capsule.

Orb remains useful offline. Persistence survives restart. IPC is isolated. Only LOW local actions execute.

## Non-negotiable rules

1. One next action. Not a list.
2. AI handles ambiguity later. Code handles guarantees now.
3. Human-gated automation (Phase 1: empty automations screen).
4. Local-first. Never blank the Orb because the cloud is unreachable.
5. Neuroinclusive by preference, not diagnosis. No guilt copy.
6. Recovery is a resume protocol, not a generated summary.
7. Accessibility from day one.

## Local actions (Phase 1)

`open_url | open_file | open_app | copy_to_clipboard | start_focus`

MEDIUM/HIGH permission schema exists but execution is not activated.

## Domain operations (not generic CRUD)

`createThread, getThread, updateThread, pauseThread, resumeThread, captureRecovery, getRecovery, completeThread`

## Privacy

Show what is shared. Do not continuously upload a screen. Phase 1 context is the Work Thread and explicit user actions only.

## Out of scope for Phase 1

Agents, Bedrock, wake-word, Chrome capture, analytics charts, arbitrary shell, automations that run, cloud sync beyond a local queue.
