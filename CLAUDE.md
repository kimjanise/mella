# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mella is an AI-powered scam-baiting platform that deploys voice agent honeypots, extracts intelligence from scammer calls, and generates law enforcement reports. This is a hackathon project.

## Architecture

Four core components:

1. **Voice bots** — AI personas via Vapi + Claude + ElevenLabs that answer honeypot numbers and engage scammers
2. **Intelligence extraction pipeline** — Post-call Claude API pipeline parsing transcripts into structured JSON (phone numbers, payment details, scam type, etc.)
3. **Report generator** — Auto-populates .docx intel reports for FTC/IC3 submission
4. **Operator dashboard** — Web UI with two screens: Traces (main/landing) and Personas

## Tech Stack

- **Voice/telephony:** Vapi (provides trial phone number), ElevenLabs (voice models via Vapi integration)
- **AI:** Claude API with tool use for intel extraction (`@anthropic-ai/sdk`)
- **Database:** Supabase (hosted Postgres, auto REST API, no RLS)
- **Backend:** Hono (TypeScript) — thin server for Vapi webhooks, Claude extraction, .docx report generation (`docx` npm), Vapi assistant deploy
- **Frontend:** React + Vite (TypeScript) — talks directly to Supabase for reads/persona CRUD; calls backend only for reports and deploy

## Development

```bash
# Backend (port 3001)
cd backend && npm install && npm run dev

# Frontend (port 5173)
cd frontend && npm install && npm run dev

# Run tests
cd backend && npm test

# Seed demo data into Supabase
cd backend && npm run seed          # idempotent
cd backend && npm run seed -- --force  # re-seed

# Frontend mock mode (no Supabase needed)
VITE_USE_MOCK=true npm run dev
```

## Key Design Decisions

- Traces page is the landing page — chronological call log with clickable detail panel (right-side slide-in, ~40% viewport)
- Detail panel uses `transform: translateX` CSS transition, URL updates with `?call=<id>` for deep linking
- No live streaming — calls appear on dashboard only after completion (single end-of-call webhook from Vapi)
- Intel extraction uses Claude tool use to enforce structured schema
- Cap Claude voice responses at 2 sentences to manage Vapi latency
- Frontend buildable on mock data independently (`VITE_USE_MOCK=true`)

## Backend Routes

- `POST /webhooks/vapi` — end-of-call webhook ingestion (persists call + transcript + extraction)
- `POST /personas/:id/deploy` — creates/updates Vapi assistant, assigns to phone number
- `GET /calls/:id/report` — generates and returns .docx intel report

## Database

Supabase (Postgres). Schema in `supabase/migrations/001_init.sql`. Five tables: `personas`, `calls`, `transcripts`, `intel_items`, `honeypot_numbers`. RLS disabled.
