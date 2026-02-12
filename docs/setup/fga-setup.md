# Auth0 FGA Setup & Authorization Guide

This guide explains how to set up and configure Auth0 Fine-Grained Authorization (FGA) for the Delegated Administration application.

## Overview

This app uses **Auth0 FGA as the single source of truth** for all authorization decisions. FGA provides fine-grained, relationship-based access control that is:
- ✅ Simpler than managing Auth0 RBAC scopes
- ✅ More flexible and scalable
- ✅ Centralized authorization logic
- ✅ Fast and cached

## Authorization Model

The application uses FGA to manage permissions based on user roles within organizations.

### Roles

**Admin Roles** (assigned to app users):
- `super_admin` - Full system access (can delete users)
- `admin` - Administrative privileges (all except delete)
- `support` - Limited support privileges (view, reset MFA)

**Member Role** (for users being managed):
- `member` - No app permissions. These are regular organization users being managed by admins/support.

### Permissions

**Computed from admin roles:**
- `can_view` - View organization members (super_admin, admin, support)
- `can_reset_mfa` - Reset user MFA (super_admin, admin, support)
- `can_invite` - Invite new members (super_admin, admin)
- `can_add_member` - Add existing users (super_admin, admin)
- `can_update_roles` - Update member roles (super_admin, admin)
- `can_remove_member` - Remove members (super_admin, admin)
- `can_delete` - Delete user accounts (super_admin only)

### Model Structure

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
    define can_view: super_admin or admin or support
    define can_reset_mfa: super_admin or admin or support
    define can_invite: super_admin or admin
    define can_add_member: super_admin or admin
    define can_update_roles: super_admin or admin
    define can_remove_member: super_admin or admin
    define can_delete: super_admin
```

### Permissions Matrix

| Role | can_view | can_reset_mfa | can_invite | can_add_member | can_update_roles | can_remove_member | can_delete |
|------|----------|---------------|------------|----------------|------------------|-------------------|------------|
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| support | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| member | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Note**: Members are regular users in the organization being managed. They don't log into this admin app.

## How It Works

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

### Example Flow

1. **User Logs In**
   - User authenticates with Auth0
   - Gets standard OIDC tokens (ID token + basic access token)
   - Session contains: `userId`, `email`, `name`

2. **User Asks Agent to Do Something**
   - Example: "Show me the members of my organization"

3. **Agent Makes FGA Check**
   ```typescript
   const hasPermission = await checkPermission(
     'user:auth0|123...',         // User ID from session
     'organization:org_xyz',       // Organization ID
     'can_view'                    // Permission to check
   )
   ```

4. **Agent Executes Operation**
   - If FGA says "yes": Agent gets M2M token and makes Management API call
   - If FGA says "no": Returns error: "You do not have permission to view members"

## Deploying the FGA Model

### Option 1: Using the Auth0 FGA Dashboard

1. Go to [Auth0 FGA Dashboard](https://dashboard.fga.dev/)
2. Log in with your credentials
3. Select your store: `01KGT7WXSB62KX8W76HA2BSYWG`
4. Navigate to "Authorization Model"
5. Click "Create New Model"
6. Copy the contents of `fga-model.fga` from the project root
7. Paste into the editor
8. Click "Save & Deploy"

### Option 2: Using the FGA CLI

1. Install the FGA CLI:
```bash
npm install -g @openfga/cli
```

2. Configure your store:
```bash
fga store config set \
  --api-url https://api.us1.fga.dev \
  --store-id 01KGT7WXSB62KX8W76HA2BSYWG
```

3. Deploy the model:
```bash
fga model write --file fga-model.fga
```

### Option 3: Using the API

Use the deployment script included in the project:

```bash
npm run deploy-fga-model
```

Or manually:

```bash
curl -X POST https://api.us1.fga.dev/stores/01KGT7WXSB62KX8W76HA2BSYWG/authorization-models \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @fga-model.json
```

## Assigning Roles

After deploying the model, you need to assign roles to users.

### Using the Application API

Once the app is running, use the API to assign roles:

```bash
# Assign super_admin role
curl -X POST http://localhost:3005/api/fga/write \
  -H "Content-Type: application/json" \
  -d '{
    "action": "write",
    "userId": "auth0|user123",
    "organizationId": "org_abc123",
    "relation": "super_admin"
  }'
```

### Using the FGA API Directly

```bash
curl -X POST https://api.us1.fga.dev/stores/01KGT7WXSB62KX8W76HA2BSYWG/write \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "writes": {
      "tuple_keys": [
        {
          "user": "user:auth0|YOUR_USER_ID",
          "relation": "super_admin",
          "object": "organization:org_0EgXDHCsaAtl5uhG"
        }
      ]
    }
  }'
```

### Using the FGA CLI

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

## Testing the Setup

### Test Permission Checks

You can test that permissions are working correctly:

```bash
# Check if user can delete
curl -X POST http://localhost:3005/api/fga/check \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "auth0|user123",
    "organizationId": "org_abc123",
    "relation": "can_delete"
  }'
```

### Test with the Application

1. **Logout** and clear cookies
2. **Login** to the app
3. Open the chat and ask: `"who am I?"` or `"get my info"`
4. Agent should return your user ID, email, and name
5. Ask: `"show me my permissions"`
6. Agent should list which operations you can perform
7. Ask: `"list members"`
8. Should return organization members (if you have `can_view`)

## Auth0 Configuration

### Configure M2M Application

The app uses a Machine-to-Machine (M2M) token for Management API operations:

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

## Benefits of FGA-Only Architecture

### Comparison: RBAC vs FGA-Only

| Aspect | Auth0 RBAC | FGA-Only (This App) |
|--------|------------|---------------------|
| Setup Complexity | High - Actions, scopes, roles | Low - Just FGA tuples |
| Authorization Logic | Split between Auth0 & code | Centralized in FGA |
| Token Size | Large (many scopes) | Small (standard OIDC) |
| Flexibility | Limited by scopes | Highly flexible |
| Audit Trail | Auth0 logs + app logs | FGA logs |
| Performance | Token validation | Fast FGA checks |

### Advantages

✅ **Simpler Setup**
- No Auth0 Actions needed
- No custom scope management
- No role-to-scope mapping logic

✅ **Single Source of Truth**
- All authorization logic in FGA
- Easier to audit and understand
- Consistent across all operations

✅ **Flexible**
- Easy to add new permissions
- Can create complex relationships
- Fine-grained access control

✅ **Scalable**
- FGA handles millions of checks per second
- Cached authorization decisions
- No token size limitations

✅ **Secure**
- Authorization checked on every operation
- M2M token never exposed to frontend
- User can't elevate their own permissions

## Best Practices

1. **Use Roles for Assignment**: Always assign roles (super_admin, admin, etc.), not permissions
2. **Check Permissions**: Always check permissions (can_view, can_delete, etc.) before operations
3. **Single Role per User**: Typically assign one primary role per user per organization
4. **Audit Changes**: Log all role assignments and changes
5. **Test Thoroughly**: Verify permission checks work as expected before production

## Important Notes

### Roles vs Permissions

- **Roles** are assigned directly to users (write operations)
- **Permissions** are computed from roles (check operations only)
- Never write permission tuples directly - they are derived from role assignments

## Troubleshooting

### Permission Check Returns False

1. Verify the FGA model is deployed:
```bash
fga model list
```

2. Check if role tuple exists:
```bash
fga tuple read --user "user:auth0|user123" --object "organization:org_abc123"
```

3. Verify user ID format matches (`user:` prefix)
4. Check organization ID format matches (`organization:` prefix)

### "Insufficient scope" errors
**Cause**: M2M application not authorized for Management API

**Solution**: Follow M2M configuration steps above

### "You do not have permission" errors
**Cause**: User doesn't have FGA role assigned

**Solution**: Assign appropriate FGA role (admin, support, or super_admin)

### Can't see organization members
**Cause**: User doesn't have `can_view` permission

**Solution**: Assign admin, support, or super_admin role in FGA

### Agent doesn't know who I am
**Cause**: Session not properly initialized

**Solution**:
1. Check that you're logged in
2. Try refreshing the page
3. Check browser console for errors

### Model Deployment Fails

1. Verify store ID is correct
2. Check API credentials are valid
3. Ensure model syntax is correct (use FGA CLI to validate)

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

## Additional Resources

- [Auth0 FGA Documentation](https://docs.fga.dev/)
- [FGA Modeling Guide](https://docs.fga.dev/modeling)
- [OpenFGA GitHub](https://github.com/openfga/openfga)
- [Auth0 FGA Dashboard](https://dashboard.fga.dev/)
