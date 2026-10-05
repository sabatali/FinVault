# FinVault

Personal and group finance management — one ledger for your real accounts, income, expenses, and shared group costs.

## Prerequisites

- **Node.js** 20 or later
- **MongoDB Community Server** running locally (default port `27017`) as a **replica set** (required for ledger transactions)

### MongoDB replica set (required for the ledger)

FinVault uses MongoDB multi-document transactions for the money ledger. A standalone `mongod` is **not** enough — initialize a single-node replica set.

**Windows**

1. Edit `mongod.cfg` (usually `C:\Program Files\MongoDB\Server\<ver>\bin\mongod.cfg`) and add:

   ```yaml
   replication:
     replSetName: rs0
   ```

2. Restart the MongoDB Windows service.

3. In `mongosh`:

   ```javascript
   rs.initiate()
   ```

4. Point `.env.local` at the replica set:

   ```
   MONGODB_URI=mongodb://127.0.0.1:27017/finvault?replicaSet=rs0&retryWrites=false
   ```

5. Run `npm run audit:ledger` to check existing data for drift.

If transactions are unavailable, ledger writes return `503 TRANSACTIONS_UNAVAILABLE` until replica set mode is enabled. Do not set `ALLOW_NON_TRANSACTIONAL_WRITES` except in local debugging.

## Local setup

1. Clone the repository and open the project root (`money-management/`, alongside `Docs/`).

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy environment variables:

   ```bash
   cp .env.example .env.local
   ```

   On Windows (PowerShell):

   ```powershell
   Copy-Item .env.example .env.local
   ```

4. Start MongoDB locally, then run the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) for the landing page.

6. Verify the database connection:

   ```bash
   curl http://localhost:3000/api/health
   ```

7. Set `JWT_SECRET` in `.env.local` (see `.env.example`). Auth routes require it.

8. Try signup and login at [http://localhost:3000/signup](http://localhost:3000/signup).

9. Optional email for guest invites: set `APP_URL`, `EMAIL_FROM`, and `SMTP_*` (see `.env.example`). Without SMTP, adding a guest still works — the invite URL is printed in the server console in development.

## Project structure

```text
money-management/
├── app/              # Next.js App Router (pages + API routes)
├── lib/              # Server utilities (db, auth, ledger, money)
├── models/           # Mongoose models (User, Account, Transaction)
├── Docs/             # Project documentation and implementation prompts
└── package.json
```

## Scripts

| Command              | Description                                      |
|----------------------|--------------------------------------------------|
| `npm run dev`        | Start development server                         |
| `npm run build`      | Production build                                 |
| `npm run start`      | Start production server                          |
| `npm run lint`       | Run ESLint                                       |
| `npm test`           | Run Vitest unit + integration suite              |
| `npm run test:watch` | Vitest watch mode                                |
| `npm run audit:ledger` | Print balance drift / orphans; exit 1 on fail |

## Tests & ledger audit

Unit and integration tests use **Vitest** with **mongodb-memory-server** (single-node replica set) so multi-document ledger transactions work without a local MongoDB.

```bash
npm test
```

To audit a real database pointed at by `MONGODB_URI` (e.g. from `.env.local`):

```bash
# PowerShell
$env:MONGODB_URI = (Get-Content .env.local | Where-Object { $_ -match '^MONGODB_URI=' }) -replace '^MONGODB_URI=',''
npm run audit:ledger
```

Optional **dev-only** HTTP audit: set `ENABLE_ADMIN_AUDIT=true` and `GET /api/admin/audit`. Always returns 404 in production.

## Documentation

See the `Docs/` folder for full project documentation, tech stack, and phase-by-phase implementation prompts.
