# Delegated Administration & Support App

A modern Next.js 14 application for managing organization members with Auth0 authentication, Auth0 FGA authorization, and ChatGPT-powered assistance.

## Features

- **Auth0 Authentication**: Secure user authentication with Auth0
- **Auth0 FGA Authorization**: Fine-grained role-based access control (super_admin, admin, support)
- **Member Management**: Invite, add, update roles, remove members, and reset MFA
- **AI Chatbot**: ChatGPT 4.o mini integration for intelligent assistance
- **CIBA**: Guardian Push notifications for sensitive operations
- **Split UI**: 60/40 layout (Admin Panel / Chatbot)

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Auth0 (Authentication & Management API)
- Auth0 FGA (Authorization)
- OpenAI GPT-4o mini
- React Hot Toast

## Prerequisites

- Node.js 18+ and npm
- Auth0 account with configured application
- Auth0 FGA store with authorization model
- OpenAI API key

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
Create a `.env.local` file with the following variables:

```env
# Generate with: openssl rand -hex 32
AUTH0_SECRET='your-secret-here'
AUTH0_BASE_URL='http://localhost:3005'
AUTH0_ISSUER_BASE_URL='https://YOUR_TENANT.us.auth0.com'
AUTH0_CLIENT_ID='your-auth0-client-id'
AUTH0_CLIENT_SECRET='your-auth0-client-secret'
AUTH0_AUDIENCE='https://YOUR_TENANT.us.auth0.com/api/v2/'
AUTH0_SCOPE='openid profile email read:users read:organizations read:organization_members create:organization_invitations create:organization_members update:organization_members delete:organization_members'

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

3. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3005`

## Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── dashboard/         # Main dashboard
│   └── profile/           # User profile
├── components/            # React components
│   ├── admin/            # Member management UI
│   ├── chat/             # Chatbot interface
│   ├── fga/              # FGA visualizer
│   └── ui/               # Reusable UI components
├── lib/                   # Utility libraries
│   ├── auth0/            # Auth0 clients
│   ├── fga/              # FGA helpers
│   ├── openai/           # OpenAI client
│   └── ciba/             # CIBA implementation
├── types/                 # TypeScript types
└── hooks/                 # Custom React hooks
```

## Roles & Permissions

- **super_admin**: Full control (all operations including delete)
- **admin**: All operations except delete
- **support**: View members and reset MFA only

## Development

```bash
# Install dependencies
npm install

# Run development server (port 3005)
npm run dev

# Build for production
npm build

# Start production server
npm start

# Lint code
npm run lint
```

## License

Private - All rights reserved
