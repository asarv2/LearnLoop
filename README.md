<p align="center">
  <img src="docs/logo.png" alt="LearnLoop" width="200" />
</p>

<h1 align="center">LearnLoop</h1>

<p align="center">
  <em>The next generation of AI simulations.</em>
</p>

LearnLoop is an AI-driven learning platform built around interactive,
voice-enabled simulations. Students work through scenarios with AI
agents that grade, hint, and adapt in real time; instructors author
rubrics and review outcomes.

[**▶ Watch the demo**](docs/demo.mp4) (click to play)


https://github.com/user-attachments/assets/db03379a-c3fd-4f3e-baad-04ab7f9a7b62


## What's in here

- **`client/`** — Next.js 15 + TypeScript frontend (App Router). Supabase
  for auth & DB, Stripe for billing, MUI / Ant Design / Radix for UI.
- **`server/`** — FastAPI (Python 3.11) backend. Houses the agent
  pipeline (`grade`, `hint`, `rubric`, `scenario`, `document`, `voice/*`),
  WebRTC room logic, and the message bus.
- **`model/`** — model service (separate runtime).
- **`docker-compose.yml`** — orchestrates `client` (3000), `server`
  (8000), `model` (8001), `documents` (8002), and Redis (6379).

## Quick start

```bash
# server (FastAPI, Python 3.11)
make dev          # creates .venv, installs deps
make run          # http://localhost:8000

# client (Next.js)
cd client
yarn
yarn dev          # http://localhost:3000
```

Or bring up the whole stack with `docker compose up`.

You'll need a `.env` (template not yet committed — ping the maintainer).
Required services: Supabase project, OpenAI key (for the agent runtime),
Google Gemini key, Stripe (for billing flows), and Twilio (optional).

## Status

This repo is the **original LearnLoop website + app** — the codebase
that powered the first generation of the product. Active development
has moved to a set of newer service-oriented repos under the
[`learnloopllc`](https://github.com/learnloopllc) GitHub org. This repo
is preserved for reference and history.

## Authors

Built by [@asarv2 / Ashok Saravanan](https://github.com/asarv2) and
collaborators (see `git log`).
