# Topish Platform API

Backend API for a job and social platform that combines authentication, user profiles, resumes, companies, messaging, statistics, GPT-assisted flows, and Telegram-related features in a single Express service.

## What This Repo Shows
- large Express API organization across multiple business domains
- JWT-based auth and refresh-token flows
- Swagger-backed route documentation
- Mongoose models for user, company, jobs, resume, messaging, and content workflows
- integration points for OpenAI, Telegram, SMS providers, and object storage

## Why This Stack
- **Express** keeps the HTTP layer flexible for a broad monolith-style API
- **MongoDB + Mongoose** fit the platform’s document-heavy data model
- **Socket.IO** supports messaging and real-time platform events
- **Swagger** gives a usable API reference surface for a large route set
- **JWT auth** supports mobile/client session flows without server-side session coupling

## Current Scope
This repository is a multi-domain platform backend with these main areas:
- authentication and token management
- jobs and quick jobs
- resumes and profile data
- companies and offices
- messaging and chat rooms
- discover, stories, gallery, banners
- GPT and Telegram integrations

## Quick Start
```bash
npm install
cp .env.example .env
npm start
```

Default local URL:
- `http://127.0.0.1:8080`

Key local requirements:
- MongoDB running locally or a reachable MongoDB URI
- JWT secrets in `.env`
- object storage settings for upload-related routes
- `serviceAccountKey.json` for Firebase notification features

## Environment
Minimum required values for local development:
- `PORT`
- `MONGO_URI`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SWAGGERT_URL`

Optional integrations:
- OpenAI
- Telegram bot
- SMS providers
- DigitalOcean Spaces / S3-compatible object storage
- Twilio
- Firebase Admin service account JSON

See [.env.example](/Users/Kodirovdev/Desktop/project/ENGINEERING-WORKSPACE/topish-platform-api/.env.example) for the current contract.

## Developer Workflow
```bash
npm install
npm test
npm start
```

Available scripts:
- `npm start` starts the API
- `npm run dev` starts the API in watch mode
- `npm test` runs smoke tests against the minimal bootable HTTP surface

## Useful Endpoints
- `GET /health`
- `GET /swagger-spec.json`
- `GET /api-docs`
- `GET /`

## Test Coverage
Current smoke tests verify:
- the minimal app boots without forcing MongoDB, S3, or Firebase imports
- the health endpoint responds correctly
- swagger JSON is served
- the root status page responds correctly

## Runtime Notes
- `npm test` validates a minimal boot mode designed for onboarding and CI smoke checks
- `npm start` still loads the full platform route graph and expects MongoDB, object storage configuration, and `serviceAccountKey.json` for notification-related modules
- this split is intentional so new contributors can verify the HTTP surface before wiring every external integration

## Recruiter Notes
This repo is strongest as a platform-backend case study, not as a lightweight starter. The main engineering signal is handling a wide API surface with consistent routing, auth boundaries, and external-service integration points.

## Next Technical Improvements
- [x] add request validation coverage to the most important routes (Auth routes integrated)
- [x] split duplicate and legacy route/controller files out of the main code path (Removed copy files)
- [ ] add database-backed integration tests for auth and jobs flows
- [ ] separate infrastructure-heavy integrations behind clearer service boundaries
