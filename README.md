# VibeC0derzz Delegated Administration App

Modern Next.js 14 application for delegated administration and support with Auth0 authentication, Auth0 FGA authorization, and ChatGPT-powered AI assistant.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server (port 3005)
npm run dev
```

Visit `http://localhost:3005`

## Features

- **Auth0 Authentication** - Secure OIDC-based authentication
- **Auth0 FGA Authorization** - Fine-grained role-based access control
- **AI Assistant** - ChatGPT 4.o mini chatbot with function calling
- **Member Management** - Full CRUD operations with role management
- **Guardian Push (CIBA)** - Two-factor verification for sensitive operations
- **FGA Activity Monitor** - Real-time authorization event visualization
- **Split UI** - 60/40 admin panel and chatbot layout

## Tech Stack

- **Framework**: Next.js 14 (App Router), TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: Auth0 (@auth0/nextjs-auth0)
- **Authorization**: Auth0 FGA (@openfga/sdk)
- **AI**: OpenAI GPT-4o mini
- **UI**: React Hot Toast, Headless UI, Heroicons

## Roles & Permissions

| Role | can_view | can_reset_mfa | can_invite | can_add_member | can_update_roles | can_remove_member | can_delete |
|------|----------|---------------|------------|----------------|------------------|-------------------|------------|
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| support | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |

## Documentation

### Setup Guides
- **[FGA Setup](docs/setup/fga-setup.md)** - Deploy FGA model and configure authorization
- **[CIBA Setup](docs/setup/ciba-setup.md)** - Configure Guardian Push notifications
- **[Auth0 RBAC Setup](docs/setup/auth0-rbac-setup.md)** *(Optional/Legacy)* - Alternative RBAC approach

### Features
- **[AI Agent](docs/features/ai-agent.md)** - How the AI assistant works and security model
- **[FGA Monitoring](docs/features/fga-monitoring.md)** - Real-time authorization visualization
- **[Email Resolution](docs/features/email-resolution.md)** - Email → User ID resolution

### Reference
- **[Demo Users](docs/reference/demo-users.md)** - Test account credentials
- **[CLAUDE.md](CLAUDE.md)** - Complete project context (for AI assistants)

## Environment Variables

Create `.env.local`:

```env
# Auth0 Configuration
AUTH0_SECRET='generate-with-openssl-rand-hex-32'
AUTH0_BASE_URL='http://localhost:3005'
AUTH0_ISSUER_BASE_URL='https://YOUR_TENANT.us.auth0.com'
AUTH0_CLIENT_ID='your-client-id'
AUTH0_CLIENT_SECRET='your-client-secret'
AUTH0_AUDIENCE='https://YOUR_TENANT.us.auth0.com/api/v2/'
AUTH0_SCOPE='openid profile email read:users read:organizations...'

# Auth0 FGA
FGA_API_URL='https://api.us1.fga.dev'
FGA_STORE_ID='your-fga-store-id'
FGA_CLIENT_ID='your-fga-client-id'
FGA_CLIENT_SECRET='your-fga-client-secret'
FGA_API_TOKEN_ISSUER='auth.fga.dev'
FGA_API_AUDIENCE='https://api.us1.fga.dev/'

# OpenAI
OPENAI_API_KEY='your-openai-key'

# CIBA Configuration
CIBA_MODE='guardian_push'
```

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (chat, management, fga, ciba)
│   ├── dashboard/        # Main dashboard page
│   └── profile/          # User profile page
├── components/
│   ├── admin/            # Member management UI
│   ├── chat/             # AI chatbot interface
│   ├── fga/              # FGA activity monitor
│   └── ui/               # Reusable components
├── lib/
│   ├── agent/            # AI agent tools
│   ├── auth0/            # Auth0 clients
│   ├── fga/              # FGA helpers
│   ├── openai/           # OpenAI client
│   └── ciba/             # CIBA implementation
└── types/                # TypeScript definitions
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Security

- **User-scoped operations** - AI agent acts on behalf of authenticated users
- **FGA permission checks** - Every operation verified before execution
- **Guardian Push (CIBA)** - Two-factor approval for sensitive operations
- **Audit trail** - All operations logged with user identity

## License

Private - All rights reserved
