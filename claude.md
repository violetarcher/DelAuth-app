# VibeC0derzz Delegated Administration App - Project Context

## Project Overview
Modern Next.js 14 application for delegated administration and support with Auth0 authentication, Auth0 FGA authorization, and ChatGPT 4.o mini chatbot integration.

**Created**: February 6, 2026
**Port**: 3005
**Stack**: Next.js 14, TypeScript, Tailwind CSS, Auth0, Auth0 FGA, OpenAI

---

## Configuration Details

### Auth0 Tenant
- **Domain**: archfaktor.us.auth0.com
- **Client ID**: (stored in .env.local)
- **Client Secret**: (stored in .env.local)
- **Audience**: https://archfaktor.us.auth0.com/api/v2/

### Auth0 FGA
- **Store ID**: 01KGT7WXSB62KX8W76HA2BSYWG
- **API URL**: https://api.us1.fga.dev
- **Client ID**: (stored in .env.local)
- **Client Secret**: (stored in .env.local)
- **Token Issuer**: auth.fga.dev
- **API Audience**: https://api.us1.fga.dev/

### OpenAI
- **Model**: GPT-4o mini
- **API Key**: (stored in .env.local)

### CIBA
- **Mode**: Guardian Push with Email OTP fallback

---

## FGA Authorization Model

### Type Definitions
```
model
  schema 1.1

type user

type organization
  relations
    define super_admin: [user]
    define admin: [user]
    define support: [user]
    define member: [user]

    # Computed permissions based on roles
    # Note: 'member' role has NO permissions - members are managed, not managers
    define can_view: super_admin or admin or support
    define can_reset_mfa: super_admin or admin or support
    define can_invite: super_admin or admin
    define can_add_member: super_admin or admin
    define can_update_roles: super_admin or admin
    define can_remove_member: super_admin or admin
    define can_delete: super_admin
```

**Important**: Roles are assigned directly via write operations. Permissions are computed from roles and should only be checked, never written directly.

### Roles & Permissions Matrix

| Operation | super_admin | admin | support | member |
|-----------|-------------|-------|---------|--------|
| View members | ✓ | ✓ | ✓ | ✗ |
| Reset MFA | ✓ | ✓ | ✓ | ✗ |
| Invite member | ✓ | ✓ | ✗ | ✗ |
| Add member | ✓ | ✓ | ✗ | ✗ |
| Update roles | ✓ | ✓ | ✗ | ✗ |
| Remove member | ✓ | ✓ | ✗ | ✗ |
| Delete member | ✓ | ✗ | ✗ | ✗ |

**Note**: Only super_admin, admin, and support roles can log into this app. The `member` role represents regular users in the organization who are being managed - they have no app permissions.

---

## Architecture

### Layout Design
- **Split UI**: 60% Admin Panel (left) / 40% Chatbot (right)
- **Responsive**: Mobile-friendly with collapsible panels
- **Theme**: Professional blues and grays

### Key Features
1. **Authentication**: Auth0 with OIDC
2. **Authorization**: FGA-based role checks on every operation
3. **Member Management**: Full CRUD with role updates
4. **AI Assistant**: User-scoped agent with OpenAI function calling (See AI-AGENT-AUTH.md)
5. **Security**: CIBA verification for sensitive operations
6. **Visualization**: FGA relationship viewer

### AI Agent Authentication
The chatbot operates as a secure, user-scoped agent:
- **User Context**: Uses logged-in user's session and access token
- **FGA Checks**: Verifies permissions before every operation
- **Function Calling**: OpenAI tools execute real operations (list members, invite, update roles, etc.)
- **CIBA Verification**: Sensitive operations require Guardian Push approval
- **Audit Trail**: All operations logged with user identity

See **AI-AGENT-AUTH.md** for complete documentation.

Available Tools:
- `list_members` - Show organization members (requires can_view)
- `invite_member` - Send email invitation (requires can_invite)
- `add_member` - Add existing user (requires can_add_member)
- `update_member_roles` - Change roles (requires can_update_roles + CIBA)
- `remove_member` - Remove from org (requires can_remove_member + CIBA)
- `delete_member` - Delete user (requires can_delete + CIBA)
- `reset_member_mfa` - Reset MFA (requires can_reset_mfa + CIBA)
- `check_my_permissions` - Show current user's permissions

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with Auth0 provider
│   ├── page.tsx                # Landing page
│   ├── dashboard/
│   │   └── page.tsx            # Main dashboard (split UI)
│   ├── profile/
│   │   └── page.tsx            # User profile with tokens
│   └── api/
│       ├── auth/
│       │   └── [...auth0]/route.ts    # Auth0 handler
│       ├── management/         # Member CRUD operations
│       ├── fga/                # FGA checks and writes
│       ├── ciba/               # CIBA requests
│       └── chat/               # OpenAI proxy
├── components/
│   ├── dashboard/              # Split layout components
│   ├── admin/                  # Member management UI
│   ├── chat/                   # Chatbot interface
│   ├── fga/                    # FGA visualizer
│   └── ui/                     # Reusable components
├── lib/
│   ├── auth0/                  # Auth0 clients & helpers
│   ├── fga/                    # FGA client & permission logic
│   ├── openai/                 # OpenAI client
│   └── ciba/                   # CIBA implementation
├── types/                      # TypeScript definitions
└── hooks/                      # Custom React hooks
```

---

## Implementation Status

### ✅ Completed
- [x] Project initialization with Next.js 14
- [x] TypeScript and Tailwind CSS configuration
- [x] Package dependencies installed
- [x] Environment variables configured
- [x] Basic project structure created
- [x] Landing page with Auth0 links
- [x] Root layout with UserProvider
- [x] Auth0 authentication setup
- [x] Auth0 route handlers
- [x] Management API client
- [x] Auth0 FGA integration with corrected model
- [x] FGA model (fga-model.fga) following best practices
- [x] Core UI components (Button, Input, Modal, Card, Badge)
- [x] Dashboard with 60/40 split layout
- [x] Member management UI (List, Card, Search, Modals)
- [x] All management API routes
- [x] ChatGPT integration with streaming
- [x] CIBA Guardian Push implementation
- [x] Profile page with token display
- [x] Custom React hooks (useAuth, useMembers, useFGA, useChat)
- [x] Error handling and validation utilities
- [x] FGA deployment script and documentation

### 🚧 In Progress
- [ ] Testing and final verification

### ⏳ Pending
- [ ] Mobile responsive design refinements
- [ ] Production deployment configuration

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Start development server (port 3005)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

---

## API Routes

### Authentication
- `GET /api/auth/login` - Initiate Auth0 login
- `GET /api/auth/logout` - Logout user
- `GET /api/auth/callback` - Auth0 callback
- `GET /api/auth/me` - Get current user

### Member Management
- `GET /api/management/members` - List organization members
- `POST /api/management/invite` - Invite new member
- `POST /api/management/add` - Add existing user to org
- `PATCH /api/management/update-roles` - Update member roles
- `DELETE /api/management/remove` - Remove member from org
- `POST /api/management/reset-mfa` - Reset user's MFA

### FGA
- `POST /api/fga/check` - Check user permission
- `POST /api/fga/write` - Write FGA tuple

### CIBA
- `POST /api/ciba/request` - Initiate CIBA authentication request

### Chat
- `POST /api/chat` - Send message to ChatGPT (streaming)

---

## Security Considerations

1. **Server-Side FGA Checks**: Every operation must verify permissions via FGA before execution
2. **CIBA for Sensitive Ops**: Update/delete operations require Guardian Push approval
3. **Token Security**: Access tokens never fully exposed in UI (truncated display)
4. **Input Validation**: All inputs validated with Zod schemas
5. **Environment Variables**: Never commit .env.local (in .gitignore)

---

## Testing Checklist

- [ ] Auth0 login/logout flow
- [ ] FGA permission checks for all roles
- [ ] Member list display
- [ ] Invite member operation
- [ ] Add existing member operation
- [ ] Update member roles
- [ ] Remove member
- [ ] Delete member (super_admin only)
- [ ] Reset MFA
- [ ] Chatbot message handling
- [ ] Chatbot action triggers
- [ ] CIBA Guardian Push flow
- [ ] Organization switching
- [ ] FGA visualizer updates
- [ ] Mobile responsive design
- [ ] Error handling and toasts

---

## Dependencies

### Core
- `next` ^14.2.25 - React framework
- `react` ^18.2.0 - UI library
- `typescript` ^5 - Type safety

### Auth & Security
- `@auth0/nextjs-auth0` ^3.5.0 - Auth0 SDK
- `@openfga/sdk` ^0.3.5 - FGA client
- `zod` ^3.22.4 - Schema validation

### AI & APIs
- `openai` ^4.28.0 - ChatGPT integration
- `axios` ^1.6.7 - HTTP client

### UI
- `tailwindcss` ^3.3.0 - Styling
- `@headlessui/react` ^1.7.18 - Accessible components
- `@heroicons/react` ^2.1.1 - Icons
- `lucide-react` ^0.323.0 - Additional icons
- `react-hot-toast` ^2.4.1 - Notifications

---

## Notes

- Organizations already exist in Auth0 tenant
- FGA authorization model needs to be configured in FGA dashboard
- Initial role tuples must be created for users
- Guardian app required for CIBA testing
- Port 3005 is configured to avoid conflicts with other projects

---

## Recent Updates (February 6, 2026)

### Member Management & FGA Sync Fix
- **Fixed critical bug**: Members now properly added to BOTH Auth0 organizations AND FGA
- **Root cause**: `addMember` function was only writing FGA tuples, not adding to Auth0 org
- **Solution**: Updated both AI agent tools and API routes to:
  - Add member to Auth0 organization
  - Map role names to Auth0 role IDs
  - Assign roles in Auth0
  - Write corresponding FGA tuples for each role
- **Impact**: Member additions now properly sync between Auth0 and FGA authorization

### Complete Auth0 ↔ FGA Synchronization
- **Fixed**: All member operations now sync FGA tuples correctly
- **Operations fixed**:
  - **Add Member**: Creates FGA tuples for assigned roles ✅
  - **Update Roles**: Reads existing tuples, adds new roles, removes old roles ✅
  - **Remove Member**: Deletes ALL FGA tuples for user in organization ✅
- **Smart deletion**: Only deletes tuples that actually exist (prevents FGA validation errors)
- **Activity logging**: All write/delete operations now appear in FGA Activity Monitor
- **Result**: Zero orphaned tuples, complete Auth0/FGA consistency

### MFA Reset Enhancement
- **Fixed**: MFA reset now uses correct Auth0 Management API endpoints
- **Updated endpoints**:
  - `GET /api/v2/users/{id}/authentication-methods` - List all MFA methods
  - `DELETE /api/v2/users/{id}/authentication-methods/{id}` - Delete specific method
- **Improvements**:
  - Works with ALL MFA types (SMS, TOTP, Guardian, Email OTP)
  - No pre-check before CIBA (simpler flow)
  - Clear feedback on what was removed
  - Proper error messages for users with no MFA
- **Result**: Successfully resets MFA for all authentication methods, not just Guardian

### UI/UX Improvements

#### Compact Member Cards
- **Reduced size**: 17% smaller avatars (12x12 → 10x10)
- **Tighter spacing**: Cards use `gap-2` instead of `gap-4`
- **Inline layout**: Roles displayed next to name (not separate row)
- **User ID display**: Shows full user ID in monospace font below email
- **Searchable**: Can search by name, email, OR user ID
- **Result**: Fits more members on screen, easier to scan

#### Pinned FGA Inspector
- **Layout restructure**: FGA Activity Panel always visible at top
- **Scrollable area**: Only member list scrolls, not FGA inspector
- **Fixed sections**:
  1. Header (fixed)
  2. FGA Inspector (pinned)
  3. Search bar (pinned)
  4. Member list (scrollable)
- **Benefit**: Monitor FGA activity while scrolling through long member lists

#### Enhanced FGA Activity Feed
- **Stronger feedback**: Shows detailed tuple operations
  - **Created**: `Created tuple: user123 → admin → org:abc`
  - **Deleted**: `Deleted tuple: user456 → support → org:abc`
  - **Checked**: `Checked: user789 can_view org:abc ✓ granted`
- **Visual improvements**:
  - Green checkmark icon for tuple creation
  - Red trash icon for tuple deletion
  - Descriptive text in Recent Activity feed
  - Shortened user/org IDs for readability
- **Result**: Clear visibility into authorization changes

### Favicon Addition
- **Design**: Blue shield with user icon
- **Format**: SVG (scales perfectly)
- **Colors**: Professional blue (#2563eb) matching app theme
- **Location**: `src/app/icon.svg`
- **Auto-generated**: Next.js creates all required sizes
- **Visible in**: Browser tabs, bookmarks, mobile home screen

### AI Agent Enhancements
- **New tool**: `get_member_info` - Get detailed profile for any member
- **Uniform output**: Same profile format as "who am I" command
- **Better MFA handling**: No unnecessary Guardian Push for users without MFA
- **Improved error messages**: Clear feedback on what operations succeeded/failed

### Code Quality
- **Exported**: `getManagementToken()` for reuse across modules
- **Consistent**: Role name/ID handling throughout codebase
- **Validated**: All changes compile without errors
- **Tested**: MFA reset, member addition, FGA sync all working

---

## Future Enhancements

- Dark mode support
- Audit log visualization
- Bulk member operations
- CSV import/export
- Advanced FGA query builder
- Real-time member activity feed
- Custom role definitions
- Email notification preferences
