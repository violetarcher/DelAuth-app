# Demo Users Reference

This document contains all demo user credentials and information for testing the Delegated Administration application.

---

## Organization Details

- **Organization Name**: `agency-inc`
- **Organization ID**: `org_0EgXDHCsaAtl5uhG`
- **FGA Store ID**: `01KGT7WXSB62KX8W76HA2BSYWG`
- **FGA Model ID**: `01KGTAE4NBQF7B0SDHF3DMCZZH`

---

## Admin Users (Can Log Into App)

These users have permissions to access the admin application at **http://localhost:3005**

### 1. Super Admin
- **Email**: `superadmin@atko.email`
- **Password**: `Test123!@#`
- **User ID**: `auth0|6986517b9f3c3f9a274c5ea5`
- **Role**: `super_admin`
- **Permissions**: ALL (full access)
  - ✅ View members
  - ✅ Reset MFA
  - ✅ Invite members
  - ✅ Add members
  - ✅ Update roles
  - ✅ Remove members
  - ✅ **Delete users** (only super_admin can do this)

**Use Case**: Testing all operations including destructive actions like deleting users.

---

### 2. Admin
- **Email**: `admin@atko.email`
- **Password**: `Test123!@#`
- **User ID**: `auth0|6986517d7eaf93c67df63d5c`
- **Role**: `admin`
- **Permissions**: All except delete
  - ✅ View members
  - ✅ Reset MFA
  - ✅ Invite members
  - ✅ Add members
  - ✅ Update roles
  - ✅ Remove members
  - ❌ Delete users (cannot delete)

**Use Case**: Testing standard admin operations without the ability to delete users permanently.

---

### 3. Support
- **Email**: `support@atko.email`
- **Password**: `Test123!@#`
- **User ID**: `auth0|6986517e72631b6341adfe21`
- **Role**: `support`
- **Permissions**: View and reset MFA only
  - ✅ View members
  - ✅ Reset MFA
  - ❌ Invite members
  - ❌ Add members
  - ❌ Update roles
  - ❌ Remove members
  - ❌ Delete users

**Use Case**: Testing limited support/help desk access - can only view users and help them with MFA issues.

---

## Member Users (Cannot Log Into App)

These are regular organization members who **cannot** access the admin application. They appear in the member list and can be managed by admins/support.

### 1. John Doe
- **Email**: `member1@atko.email`
- **Password**: `Test123!@#`
- **User ID**: `auth0|6986517fbd7d2ffe59dd812a`
- **Role**: `member`
- **Permissions**: NONE
- **Purpose**: Regular organization member (being managed)

---

### 2. Jane Smith
- **Email**: `member2@atko.email`
- **Password**: `Test123!@#`
- **User ID**: `auth0|6986517fae969aaa32f09beb`
- **Role**: `member`
- **Permissions**: NONE
- **Purpose**: Regular organization member (being managed)

---

### 3. Bob Johnson
- **Email**: `member3@atko.email`
- **Password**: `Test123!@#`
- **User ID**: `auth0|698651809f3c3f9a274c5eaa`
- **Role**: `member`
- **Permissions**: NONE
- **Purpose**: Regular organization member (being managed)

---

## Quick Access

### Application URL
```
http://localhost:3005
```

### Quick Login Commands
Copy and paste these for quick testing:

**Super Admin:**
```
Email: superadmin@atko.email
Password: Test123!@#
```

**Admin:**
```
Email: admin@atko.email
Password: Test123!@#
```

**Support:**
```
Email: support@atko.email
Password: Test123!@#
```

---

## Testing Scenarios

### Scenario 1: View All Members
**User**: Any admin user (super_admin, admin, support)
1. Login with any admin account
2. Navigate to Dashboard
3. You should see all 6 users listed (3 admins + 3 members)
4. Search functionality should filter the list

**Expected**: All users visible with their roles displayed

---

### Scenario 2: Reset MFA
**User**: Any admin user (super_admin, admin, support)
1. Login
2. Find a member in the list
3. Click the action menu (three dots)
4. Click "Reset MFA"
5. Confirm the action

**Expected**: Success toast notification

---

### Scenario 3: Invite New Member
**User**: super_admin or admin ONLY (not support)
1. Login as superadmin or admin
2. Click "Invite Member" button
3. Enter email address
4. Select roles (optional)
5. Submit

**Expected**:
- ✅ Works for super_admin and admin
- ❌ Button should be hidden/disabled for support user

---

### Scenario 4: Update Member Roles
**User**: super_admin or admin ONLY
1. Login as superadmin or admin
2. Find a member in the list
3. Click action menu → "Update Roles"
4. Add or remove roles
5. Save changes

**Expected**:
- ✅ Works for super_admin and admin
- ❌ Option not available for support user
- FGA tuples updated in background

---

### Scenario 5: Remove Member from Organization
**User**: super_admin or admin ONLY
1. Login as superadmin or admin
2. Find a member
3. Click action menu → "Remove from Org"
4. Confirm

**Expected**:
- Member removed from organization
- User account still exists in Auth0
- FGA tuples removed

---

### Scenario 6: Delete User (Destructive)
**User**: super_admin ONLY
1. Login as superadmin
2. Find a member
3. Click action menu → "Delete User"
4. Confirm the destructive action

**Expected**:
- ✅ Works for super_admin
- ❌ Option not available for admin or support
- User permanently deleted from Auth0
- FGA tuples removed

---

### Scenario 7: Chatbot Assistant
**User**: Any admin user
1. Login
2. Look at right panel (40% width)
3. Try suggested questions or ask custom ones:
   - "How do I invite a new member?"
   - "What are the different roles?"
   - "Explain FGA permissions"

**Expected**: Context-aware AI responses about member management

---

### Scenario 8: FGA Visualizer
**User**: Any admin user
1. Login
2. View the FGA Permissions card (top of left panel)
3. Your permissions should be displayed with checkmarks

**Expected**:
- Super admin: All permissions green
- Admin: All except "Delete Members"
- Support: Only "View Members" and "Reset MFA"

---

### Scenario 9: Profile & Tokens
**User**: Any admin user
1. Login
2. Click "Profile" in top nav
3. View user information
4. Click eye icon to reveal tokens
5. Click copy icon to copy token

**Expected**:
- User profile displayed
- Access and ID tokens shown (truncated)
- Tokens can be decoded and copied

---

### Scenario 10: Permission Denied Test
**User**: Support user
1. Login as support@atko.email
2. Try to click "Invite Member" button
3. Try to access update/remove actions

**Expected**:
- Buttons should be disabled or hidden
- If somehow accessed, API should return 403 Forbidden
- Toast notification: "Insufficient permissions"

---

## Permission Matrix Reference

| Action | Super Admin | Admin | Support | Member |
|--------|-------------|-------|---------|--------|
| Login to app | ✅ | ✅ | ✅ | ❌ |
| View members | ✅ | ✅ | ✅ | ❌ |
| Reset MFA | ✅ | ✅ | ✅ | ❌ |
| Invite member | ✅ | ✅ | ❌ | ❌ |
| Add member | ✅ | ✅ | ❌ | ❌ |
| Update roles | ✅ | ✅ | ❌ | ❌ |
| Remove member | ✅ | ✅ | ❌ | ❌ |
| Delete user | ✅ | ❌ | ❌ | ❌ |

---

## Recreating Demo Users

If you need to recreate all demo users, run:

```bash
npm run setup-demo-users
```

This will:
- Create users in Auth0 (or find existing)
- Add them to the `agency-inc` organization
- Create FGA role tuples
- Display a summary

**Note**: If users already exist, the script will find and use them without creating duplicates.

---

## Removing Demo Users

To remove demo users manually:

### Via Auth0 Dashboard
1. Go to https://manage.auth0.com/
2. Navigate to User Management → Users
3. Search for `@atko.email`
4. Delete each user

### Via Management API
```bash
# Delete user by ID
curl -X DELETE https://archfaktor.us.auth0.com/api/v2/users/USER_ID \
  -H "Authorization: Bearer MGMT_TOKEN"
```

**Note**: Deleting users will also remove their FGA tuples automatically if done through the app.

---

## Troubleshooting

### Cannot Login
- **Issue**: "Invalid email or password"
- **Solution**: Ensure you're using `Test123!@#` exactly (case-sensitive)

### No Permissions Showing
- **Issue**: FGA visualizer shows all red
- **Solution**: Verify FGA tuples exist, re-run `npm run setup-demo-users`

### Members Not Visible
- **Issue**: Member list is empty
- **Solution**: Check organization ID, ensure users are in `agency-inc` org

### API Errors
- **Issue**: 401 Unauthorized
- **Solution**: Check Auth0 credentials in `.env.local`, restart dev server

### FGA Model Errors
- **Issue**: Permission checks failing
- **Solution**: Redeploy FGA model with `npm run deploy-fga-model`

---

## Support & Resources

- **Application**: http://localhost:3005
- **Auth0 Dashboard**: https://manage.auth0.com/
- **FGA Dashboard**: https://dashboard.fga.dev/
- **Project Documentation**: See `README.md`, `claude.md`, `FGA-SETUP.md`

---

*Last Updated: February 6, 2026*
*Setup Script: `npm run setup-demo-users`*
