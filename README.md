# PulsePath

PulsePath is a full-stack symptom-to-doctor smart routing app built for hackathon demos. It includes:

- A mobile-first React PWA
- A Node.js + Express backend
- Symptom chat, urgency routing, doctor recommendation, and nearby care suggestions
- Camera/photo uploads for visible symptoms
- Optional DeepSeek, Gemini, or OpenRouter analysis with a safe local heuristic fallback

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- PWA: Web manifest + service worker
- AI: NVIDIA DeepSeek, Gemini, or OpenRouter when the matching server key is configured

## Project Structure

```text
client/   React PWA
server/   Express API
```

## Quick Start

```bash
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API calls to `http://localhost:4000`.

## Environment

Create `server/.env` from `server/.env.example`.

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
NVIDIA_DEEPSEEK_API_KEY=
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=deepseek-ai/deepseek-v3.2
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-3n-e4b-it:free
OPENROUTER_REFERER=http://localhost:5173
OPENROUTER_TITLE=PulsePath
```

For text triage, the backend prefers NVIDIA DeepSeek first, then Gemini, then OpenRouter, and finally a conservative rule-based fallback suitable for demos. Image uploads continue to prefer Gemini-compatible vision models unless you add an NVIDIA vision model explicitly.
Once you add a real key to `server/.env`, restart `npm run dev` and the UI status chip will switch from local fallback to the active live provider.

## Important Disclaimer

PulsePath is a decision-support demo and not a medical diagnosis system. It should always encourage professional consultation for urgent or uncertain symptoms.
