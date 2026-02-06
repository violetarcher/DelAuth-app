# FGA Authorization Guide - Simplified Approach

## Overview
This app uses **Auth0 FGA as the single source of truth** for all authorization decisions. This is simpler and cleaner than managing Auth0 RBAC scopes.

## Architecture

### Authentication vs Authorization
- **Auth0**: Handles user authentication only (login/logout via OIDC)
- **FGA**: Handles all authorization decisions (what users can do)
- **Management API**: Uses M2M (machine-to-machine) token with full permissions

### Authorization Flow

```
User Request → Agent Tool
              ↓
         FGA Check: "Can user:{userId} perform {action} on organization:{orgId}?"
              ↓
         YES → Use M2M token → Call Management API → Return result
              ↓
         NO → Return "Insufficient permissions"
```

## How It Works

### 1. User Logs In
- User authenticates with Auth0
- Gets standard OIDC tokens (ID token + basic access token)
- Session contains: `userId`, `email`, `name`
- No special scopes needed

### 2. User Asks Agent to Do Something
Example: "Show me the members of my organization"

### 3. Agent Makes FGA Check
```typescript
// Check if user has permission
const hasPermission = await checkPermission(
  'user:auth0|123...',           // User ID from session
  'organization:org_xyz',         // Organization ID
  'can_view'                      // Permission to check
)
```

### 4. Agent Uses M2M Token
If FGA says "yes":
- Agent gets M2M token (client_credentials with full Management API scopes)
- Makes Management API call on behalf of the user
- Returns results

If FGA says "no":
- Returns error: "You do not have permission to view members"

## FGA Authorization Model

The FGA model defines roles and permissions:

```
type organization
  relations
    define super_admin: [user]
    define admin: [user]
    define support: [user]
    define member: [user]

    define can_view: super_admin or admin or support
    define can_reset_mfa: super_admin or admin or support
    define can_invite: super_admin or admin
    define can_add_member: super_admin or admin
    define can_update_roles: super_admin or admin
    define can_remove_member: super_admin or admin
    define can_delete: super_admin
```

## Assigning Roles in FGA

To give a user permissions, write FGA tuples:

```typescript
// Make user an admin
{
  user: "user:auth0|abc123",
  relation: "admin",
  object: "organization:org_xyz"
}

// Make user support staff
{
  user: "user:auth0|def456",
  relation: "support",
  object: "organization:org_xyz"
}

// Make user a super admin
{
  user: "user:auth0|ghi789",
  relation: "super_admin",
  object: "organization:org_xyz"
}
```

## Agent Tools

The agent has access to these tools (with FGA checks):

### Information Tools
- **`get_my_info`** - Returns current user's ID, email, name, organization
- **`check_my_permissions`** - Shows which permissions user has

### Read Operations
- **`list_members`** - Requires `can_view`

### Write Operations
- **`invite_member`** - Requires `can_invite`
- **`add_member`** - Requires `can_add_member`

### Sensitive Operations (require CIBA + FGA)
- **`update_member_roles`** - Requires `can_update_roles` + Guardian Push
- **`remove_member`** - Requires `can_remove_member` + Guardian Push
- **`delete_member`** - Requires `can_delete` (super_admin only) + Guardian Push
- **`reset_member_mfa`** - Requires `can_reset_mfa` + Guardian Push

## Setup Instructions

### 1. Configure Auth0 Application for M2M

In the Auth0 Dashboard:

1. Go to **Applications** → **APIs** → **Auth0 Management API**
2. Go to the **Machine to Machine Applications** tab
3. Find your application: `VibeC0derzz Delegated Administration`
4. Toggle it to **Authorized**
5. Select these scopes:
   - ✓ `read:users`
   - ✓ `update:users`
   - ✓ `delete:users`
   - ✓ `read:organizations`
   - ✓ `read:organization_members`
   - ✓ `create:organization_members`
   - ✓ `update:organization_members`
   - ✓ `delete:organization_members`
   - ✓ `create:organization_invitations`
   - ✓ `read:roles`
   - ✓ `update:users_app_metadata`

6. Click **Update**

### 2. Deploy FGA Model

The model is already defined in `fga-model.fga`. Deploy it:

```bash
# If not already deployed
fga model write --store-id 01KGT7WXSB62KX8W76HA2BSYWG --file fga-model.fga
```

### 3. Assign FGA Roles to Users

For each user who should have access to the app:

```bash
# Example: Make user an admin
fga tuple write \
  --store-id 01KGT7WXSB62KX8W76HA2BSYWG \
  user:auth0|YOUR_USER_ID admin organization:org_0EgXDHCsaAtl5uhG

# Example: Make user support staff
fga tuple write \
  --store-id 01KGT7WXSB62KX8W76HA2BSYWG \
  user:auth0|YOUR_USER_ID support organization:org_0EgXDHCsaAtl5uhG

# Example: Make user super admin
fga tuple write \
  --store-id 01KGT7WXSB62KX8W76HA2BSYWG \
  user:auth0|YOUR_USER_ID super_admin organization:org_0EgXDHCsaAtl5uhG
```

Or use the FGA API directly (see `src/lib/fga/client.ts`).

### 4. Test the Setup

1. **Logout** and clear cookies
2. **Login** to the app
3. Open the chat and ask: `"who am I?"` or `"get my info"`
4. Agent should return your user ID, email, and name
5. Ask: `"show me my permissions"`
6. Agent should list which operations you can perform
7. Ask: `"list members"`
8. Should return organization members (if you have `can_view`)

## Benefits of This Approach

### ✅ Simpler Setup
- No Auth0 Actions needed
- No custom scope management
- No role-to-scope mapping logic

### ✅ Single Source of Truth
- All authorization logic in FGA
- Easier to audit and understand
- Consistent across all operations

### ✅ Flexible
- Easy to add new permissions
- Can create complex relationships
- Fine-grained access control

### ✅ Scalable
- FGA handles millions of checks per second
- Cached authorization decisions
- No token size limitations

### ✅ Secure
- Authorization checked on every operation
- M2M token never exposed to frontend
- User can't elevate their own permissions

## Code Structure

```
src/
├── lib/
│   ├── agent/
│   │   └── tools.ts           # Agent tools with FGA checks
│   ├── fga/
│   │   ├── client.ts          # FGA client setup
│   │   └── checks.ts          # Permission check utilities
│   └── auth0/
│       └── management.ts      # M2M token management (legacy)
├── app/
│   └── api/
│       └── chat/
│           └── route.ts       # Agent endpoint
```

## Troubleshooting

### Issue: "Insufficient scope" errors
**Cause**: M2M application not authorized for Management API

**Solution**: Follow step 1 in Setup Instructions above

### Issue: "You do not have permission" errors
**Cause**: User doesn't have FGA role assigned

**Solution**: Assign appropriate FGA role (admin, support, or super_admin)

### Issue: Can't see organization members
**Cause**: User doesn't have `can_view` permission

**Solution**: Assign admin, support, or super_admin role in FGA

### Issue: Agent doesn't know who I am
**Cause**: Session not properly initialized

**Solution**:
1. Check that you're logged in
2. Try refreshing the page
3. Check browser console for errors

## Security Considerations

1. **M2M Token Security**
   - M2M token stored server-side only
   - Never exposed to client
   - Automatically refreshed with caching

2. **FGA Authorization**
   - Every operation checks FGA first
   - No bypassing authorization
   - Audit trail in FGA logs

3. **CIBA for Sensitive Operations**
   - Destructive operations require Guardian Push
   - Even with FGA permission, user must approve
   - Prevents accidental or malicious actions

4. **Organization Context**
   - Operations scoped to user's organization
   - Cross-organization access prevented
   - Organization ID validated on every request

## Comparison: RBAC vs FGA-Only

| Aspect | Auth0 RBAC | FGA-Only (This App) |
|--------|------------|---------------------|
| Setup Complexity | High - Actions, scopes, roles | Low - Just FGA tuples |
| Authorization Logic | Split between Auth0 & code | Centralized in FGA |
| Token Size | Large (many scopes) | Small (standard OIDC) |
| Flexibility | Limited by scopes | Highly flexible |
| Audit Trail | Auth0 logs + app logs | FGA logs |
| Performance | Token validation | Fast FGA checks |

## Next Steps

1. ✅ Configure M2M application (Step 1)
2. ✅ Assign yourself an FGA role
3. ✅ Test with agent: "who am I?"
4. ✅ Test with agent: "list members"
5. Document role assignment process for admins
6. Set up FGA monitoring

---

**Last Updated**: February 6, 2026
**Version**: 1.0 (FGA-Only Architecture)
