# Auth0 FGA Setup Guide

This guide explains how to set up and deploy the FGA authorization model for the Delegated Administration application.

## Authorization Model Overview

The application uses Auth0 Fine-Grained Authorization (FGA) to manage permissions based on user roles within organizations.

### Model Structure

**Admin Roles** (assigned to app users):
- `super_admin` - Full system access (can delete users)
- `admin` - Administrative privileges (all except delete)
- `support` - Limited support privileges (view, reset MFA)

**Member Role** (for users being managed):
- `member` - No app permissions. These are regular organization users being managed by admins/support.

**Permissions** (computed from admin roles):
- `can_view` - View organization members (super_admin, admin, support)
- `can_reset_mfa` - Reset user MFA (super_admin, admin, support)
- `can_invite` - Invite new members (super_admin, admin)
- `can_add_member` - Add existing users (super_admin, admin)
- `can_update_roles` - Update member roles (super_admin, admin)
- `can_remove_member` - Remove members (super_admin, admin)
- `can_delete` - Delete user accounts (super_admin only)

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

## Creating Initial Role Assignments

After deploying the model, you need to assign roles to users. Here's how:

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
          "user": "user:auth0|user123",
          "relation": "super_admin",
          "object": "organization:org_abc123"
        }
      ]
    }
  }'
```

## Testing the Model

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

### Expected Results by Role

| Role | can_view | can_reset_mfa | can_invite | can_add_member | can_update_roles | can_remove_member | can_delete |
|------|----------|---------------|------------|----------------|------------------|-------------------|------------|
| super_admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| support | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| member | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

**Note**: Members are regular users in the organization being managed. They don't log into this admin app.

## Important Notes

### Roles vs Permissions

- **Roles** are assigned directly to users (write operations)
- **Permissions** are computed from roles (check operations only)
- Never write permission tuples directly - they are derived from role assignments

### Best Practices

1. **Use Roles for Assignment**: Always assign roles (super_admin, admin, etc.), not permissions
2. **Check Permissions**: Always check permissions (can_view, can_delete, etc.) before operations
3. **Single Role per User**: Typically assign one primary role per user per organization
4. **Audit Changes**: Log all role assignments and changes
5. **Test Thoroughly**: Verify permission checks work as expected before production

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

### Model Deployment Fails

1. Verify store ID is correct
2. Check API credentials are valid
3. Ensure model syntax is correct (use FGA CLI to validate)

### No Permissions Showing

1. Confirm roles are assigned in FGA (not just Auth0)
2. Check that the authorization model is the latest version
3. Verify API calls are using correct user/org IDs

## Additional Resources

- [Auth0 FGA Documentation](https://docs.fga.dev/)
- [FGA Modeling Guide](https://docs.fga.dev/modeling)
- [OpenFGA GitHub](https://github.com/openfga/openfga)
- [Auth0 FGA Dashboard](https://dashboard.fga.dev/)
