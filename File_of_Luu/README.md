# MFU Voting System

A small Express + MySQL voting app with three role-based dashboards:

- `login.html`: sign in and redirect by role
- `admin_dashboard.html`: live system overview
- `voter_dashboard.html`: ballot page for active-term candidates
- `candidate_dashboard.html`: manifesto editor and results board

## Backend

- [index.js](/Users/ludevicepie/Downloads/Web%20Dev%20Group%20Project%20/index.js): API routes and server startup
- [db.js](/Users/ludevicepie/Downloads/Web%20Dev%20Group%20Project%20/db.js): shared MySQL connection pool

## Frontend

- `assets/js/theme.js`: shared Tailwind theme
- `assets/js/app.js`: shared browser helpers
- `assets/js/*.js`: page-specific dashboard logic
- Candidate profile pictures are uploaded through the API and stored under `uploads/profile-pictures/`

## Run

1. Copy `.env.example` to `.env` if you need custom database settings.
2. Run `npm install`.
3. Run `npm run db:check` to verify MySQL access.
4. Run `npm run dev` while developing or `npm start` for a normal start.
5. Open `http://127.0.0.1:3000/login.html` for the cleanest local workflow.
6. Live Server also works now. Keep `node server.js` running, then use your Live Server page normally while the API keeps talking to `http://127.0.0.1:3000`.

## Current Data Flow

- Login reads from `users`
- Active term comes from `terms.is_active = 1`
- Candidate manifesto data comes from `candidates.policies`
- Votes are stored in `votes`
