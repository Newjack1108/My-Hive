# My Hive - Beekeeping Inspection & Management Platform

Production-ready web application for beekeeping inspections and management with offline-first capabilities, NFC deep-linking, and mobile-first design.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript + PostgreSQL
- **Frontend**: React + TypeScript + Vite + PWA
- **Database**: PostgreSQL
- **Hosting**: Railway
- **Offline Storage**: IndexedDB (Dexie.js)
- **Validation**: Zod

## Project Structure

```
├── apps/
│   ├── api/          # Backend API server
│   └── web/          # Frontend React app
├── packages/
│   ├── db/           # Database schema, migrations, seed scripts
│   └── shared/       # Shared TypeScript types and utilities
└── package.json      # Monorepo root
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### Development Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# In apps/api/.env
DATABASE_URL=postgresql://user:password@localhost:5432/myhive
JWT_SECRET=your-secret-key
PORT=3001

# In apps/web/.env
VITE_API_URL=http://localhost:3001
```

3. Run database migrations:
```bash
npm run db:migrate
```

4. Seed the database:
```bash
npm run db:seed
```

5. Start development servers:
```bash
npm run dev
```

- API: http://localhost:3001
- Web: http://localhost:5173

## Deployment to Railway

1. Create a Railway project and add PostgreSQL service
2. Set environment variables in Railway dashboard
3. Configure build command: `npm run build`
4. Configure start command: `npm run db:migrate && node apps/api/dist/index.js`
5. Add custom domain for NFC deep-linking

### Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `PORT` - API server port (default: 3001)
- `NODE_ENV` - Environment (production/development)

## Features

### Phase 1 (MVP)
- ✅ Multi-user authentication with RBAC
- ✅ Admin panel for user management
- ✅ Organisation, Apiary, and Hive management
- ✅ Offline-first inspection wizard
- ✅ NFC deep-linking for hives
- ✅ Photo upload with automatic resize/compression
- ✅ Location stamping
- ✅ Audit trail and activity logs
- ✅ Task management

### Phase 2+ (Planned)
- Map with feeding radius overlaps
- Queen breeding plans
- Shop/ecommerce module
- Honey production records
- Pest control knowledge base
- Advanced maintenance scheduling

## License

Private
