# Auth0 RBAC Implementation Guide

## Overview
This guide implements Role-Based Access Control (RBAC) for the delegated administration app using Auth0 Roles at the organization level. User roles determine which Management API scopes are granted.

## Architecture

### Role → Scope Mapping

| Role | Management API Scopes |
|------|----------------------|
| **Super Admin** | `read:users` `update:users` `delete:users` `read:organizations` `read:organization_members` `create:organization_members` `update:organization_members` `delete:organization_members` `create:organization_invitations` `read:roles` `update:users_app_metadata` |
| **Admin** | `read:users` `update:users` `read:organizations` `read:organization_members` `create:organization_members` `update:organization_members` `delete:organization_members` `create:organization_invitations` `read:roles` `update:users_app_metadata` |
| **Support** | `read:users` `read:organizations` `read:organization_members` `update:users_app_metadata` (for MFA reset) |
| **Member** | No scopes (cannot access app) |

---

## Implementation Steps

### Phase 1: Create/Update Auth0 Roles

#### 1. Update Existing "Admin" Role
Navigate to: **User Management > Roles** in Auth0 Dashboard

1. Find and click on the **Admin** role
2. Go to the **Permissions** tab
3. Click **Add Permissions**
4. Select **Auth0 Management API**
5. Add these permissions:
   - ✓ `read:users`
   - ✓ `update:users`
   - ✓ `read:organizations`
   - ✓ `read:organization_members`
   - ✓ `create:organization_members`
   - ✓ `update:organization_members`
   - ✓ `delete:organization_members`
   - ✓ `create:organization_invitations`
   - ✓ `read:roles`
   - ✓ `update:users_app_metadata`
6. Click **Add Permissions**

#### 2. Create "Super Admin" Role
1. Click **Create Role**
2. Name: `Super Admin`
3. Description: `Full delegated admin access including user deletion`
4. Click **Create**
5. Go to **Permissions** tab
6. Add all Admin permissions PLUS:
   - ✓ `delete:users`
7. Click **Add Permissions**

#### 3. Create "Support" Role
1. Click **Create Role**
2. Name: `Support`
3. Description: `Read-only access with MFA reset capability`
4. Click **Create**
5. Go to **Permissions** tab
6. Add these permissions:
   - ✓ `read:users`
   - ✓ `read:organizations`
   - ✓ `read:organization_members`
   - ✓ `update:users_app_metadata`
7. Click **Add Permissions**

---

### Phase 2: Create Auth0 Action for Dynamic Scope Assignment

#### Create "Add Organization Role Scopes" Action

Navigate to: **Actions > Flows > Login**

1. Click **+ Custom** to create a new action
2. Name: `Add Organization Role Scopes`
3. Trigger: **Login / Post Login**
4. Runtime: **Node 18 (Recommended)**

**Action Code:**

```javascript
/**
 * Handler that will be called during the execution of a PostLogin flow.
 *
 * @param {Event} event - Details about the user and the context in which they are logging in.
 * @param {PostLoginAPI} api - Interface whose methods can be used to change the behavior of the login.
 */
exports.onExecutePostLogin = async (event, api) => {
  // Only process if user is logging into an organization
  if (!event.organization || !event.organization.id) {
    console.log('No organization context, skipping role scope assignment');
    return;
  }

  const organizationId = event.organization.id;
  const userId = event.user.user_id;

  console.log(`Processing login for user ${userId} in org ${organizationId}`);

  // Get user's roles in this organization
  const userRoles = event.authorization?.roles || [];

  console.log(`User roles:`, userRoles);

  // Define scope mappings for each role
  const roleScopeMap = {
    'Super Admin': [
      'read:users',
      'update:users',
      'delete:users',
      'read:organizations',
      'read:organization_members',
      'create:organization_members',
      'update:organization_members',
      'delete:organization_members',
      'create:organization_invitations',
      'read:roles',
      'update:users_app_metadata'
    ],
    'Admin': [
      'read:users',
      'update:users',
      'read:organizations',
      'read:organization_members',
      'create:organization_members',
      'update:organization_members',
      'delete:organization_members',
      'create:organization_invitations',
      'read:roles',
      'update:users_app_metadata'
    ],
    'Support': [
      'read:users',
      'read:organizations',
      'read:organization_members',
      'update:users_app_metadata'
    ]
  };

  // Collect all scopes based on user's roles
  const grantedScopes = new Set();
  let hasValidRole = false;

  userRoles.forEach(role => {
    if (roleScopeMap[role]) {
      hasValidRole = true;
      roleScopeMap[role].forEach(scope => grantedScopes.add(scope));
      console.log(`Added scopes for role: ${role}`);
    }
  });

  // If user has no valid admin/support roles, deny access
  if (!hasValidRole) {
    console.log('User has no valid administrative role');
    api.access.deny('You do not have permission to access this application. Please contact your organization administrator.');
    return;
  }

  // Add scopes to the access token
  const scopesArray = Array.from(grantedScopes);
  console.log(`Granting scopes:`, scopesArray);

  // Add the Management API audience with the granted scopes
  api.accessToken.setCustomClaim(
    'https://deladmin.app/roles',
    userRoles
  );

  api.accessToken.setCustomClaim(
    'https://deladmin.app/organization',
    organizationId
  );

  api.accessToken.setCustomClaim(
    'https://deladmin.app/permissions',
    scopesArray
  );

  // Add user metadata for FGA integration
  api.accessToken.setCustomClaim(
    'https://deladmin.app/user_id',
    userId
  );
};
```

5. Click **Deploy**

#### Add Action to Login Flow

1. Go to **Actions > Flows > Login**
2. Drag the **Add Organization Role Scopes** action from the right sidebar into the flow
3. Place it between **Start** and **Complete**
4. Click **Apply**

---

### Phase 3: Assign Roles to Organization Members

Navigate to: **Organizations > [Your Organization]**

For each user you want to grant access:

1. Go to the **Members** tab
2. Click on a member
3. Click **Assign Roles**
4. Select appropriate role:
   - **Super Admin** - Full access including user deletion
   - **Admin** - Full management except deletion
   - **Support** - Read-only + MFA reset
5. Click **Assign**

**Note**: Do NOT assign the "Member" role to users who need app access. "Member" is for regular org users being managed.

---

### Phase 4: Update Application Configuration

#### Update Auth0 Application Settings

Navigate to: **Applications > Applications > [Your App]**

1. Go to **Settings** tab
2. Scroll to **Application URIs**:
   - **Allowed Callback URLs**: `http://localhost:3005/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3005`
3. Scroll to **Advanced Settings > OAuth**:
   - **JsonWebToken Signature Algorithm**: `RS256`
4. Click **Save Changes**

#### Enable Organization Support

1. Go to the **Organizations** tab
2. Toggle **Enable Organizations** to ON
3. **Login Prompt**: Select "Prompt for Organization"
4. Click **Save**

---

### Phase 5: Test the Implementation

#### Test Flow:

1. **Logout** from the application
2. **Clear browser cache/cookies**
3. Navigate to `http://localhost:3005`
4. Click **Login**
5. Enter organization name when prompted
6. Authenticate with credentials
7. Check that you're redirected to `/dashboard`

#### Verify Scopes:

1. Navigate to `http://localhost:3005/profile`
2. View the **Access Token** section
3. Decode the JWT token at https://jwt.io
4. Check the custom claims:
   - `https://deladmin.app/roles` - Should show your role(s)
   - `https://deladmin.app/permissions` - Should show granted scopes
   - `https://deladmin.app/organization` - Should show org ID

#### Test Operations:

**As Super Admin:**
- ✓ View members
- ✓ Invite members
- ✓ Add members
- ✓ Update roles
- ✓ Remove members
- ✓ Delete users
- ✓ Reset MFA

**As Admin:**
- ✓ View members
- ✓ Invite members
- ✓ Add members
- ✓ Update roles
- ✓ Remove members
- ✗ Delete users (should fail)
- ✓ Reset MFA

**As Support:**
- ✓ View members
- ✗ Invite members (should fail)
- ✗ Add members (should fail)
- ✗ Update roles (should fail)
- ✗ Remove members (should fail)
- ✗ Delete users (should fail)
- ✓ Reset MFA

---

## Code Updates Required

### 1. Update Auth0 Management Client

The Management API client needs to use the user's access token instead of a machine-to-machine token.

**File: `src/lib/auth0/management.ts`**

The client should extract scopes from the user's access token custom claims instead of requesting all scopes.

### 2. Update API Routes to Use Token Scopes

Each API route should:
1. Extract the user's access token
2. Verify it contains the required Management API scopes
3. Use that token for Management API calls

### 3. Add Scope Validation Middleware

Create middleware to validate that the user's token has the required scope for each operation.

---

## Security Considerations

1. **Token Validation**: Always verify JWT signature and expiration
2. **Scope Enforcement**: Check scopes on every API call, not just in the UI
3. **Organization Context**: Ensure operations are scoped to the user's organization
4. **Audit Logging**: Log all administrative actions with user identity
5. **CIBA for Sensitive Ops**: Maintain Guardian Push requirement for destructive operations

---

## Troubleshooting

### Issue: User gets "Access Denied" after login
**Solution**: Verify user has been assigned an Admin, Super Admin, or Support role in the organization.

### Issue: "Insufficient scope" errors
**Solution**:
1. Check the Action logs in Auth0 Dashboard (Monitoring > Logs)
2. Verify roles have the correct Management API permissions
3. Ensure Action is deployed and added to Login flow

### Issue: No scopes in access token
**Solution**:
1. Verify the Action is in the Login flow
2. Check Action logs for errors
3. Ensure `audience` parameter includes Management API

### Issue: Wrong scopes granted
**Solution**: Review the `roleScopeMap` in the Action and ensure it matches the role permissions matrix.

---

## Next Steps

After implementing RBAC:

1. Update code to extract scopes from custom claims
2. Create scope validation middleware
3. Update Management API client to use user tokens
4. Test all operations with each role
5. Document role assignment process for administrators
6. Set up monitoring for failed scope checks

---

## Rollback Plan

If issues occur:

1. Remove Action from Login flow (Actions > Flows > Login)
2. Users will lose scoped access but can still authenticate
3. Fix issues in Action code
4. Redeploy Action
5. Re-add to Login flow
6. Test with a single user before enabling for all

---

**Last Updated**: February 6, 2026
**Version**: 1.0
