# CIBA (Guardian Push) Setup Guide

## Overview
CIBA (Client Initiated Backchannel Authentication) enables Guardian Push notifications for sensitive operations. This guide ensures CIBA is properly configured.

## Prerequisites

1. **Auth0 Guardian App** installed on your phone
   - iOS: https://apps.apple.com/app/auth0-guardian/id1093447833
   - Android: https://play.google.com/store/apps/details?id=com.auth0.guardian

2. **Guardian enrolled** for your user account
   - Must have enrolled Guardian during login or manually

## Auth0 Tenant Configuration

### Step 1: Enable CIBA for Application

1. Go to https://manage.auth0.com
2. Navigate to **Applications** → **Applications**
3. Find your application: `VibeC0derzz Delegated Administration`
4. Click **Settings**
5. Scroll to **Advanced Settings**
6. Click the **Grant Types** tab
7. Enable these grant types:
   - ✅ **Authorization Code**
   - ✅ **Refresh Token**
   - ✅ **Client Credentials**
   - ✅ **CIBA** ⚠️ **IMPORTANT: This must be checked!**
8. Click **Save Changes**

### Step 2: Configure Backchannel Authentication

1. Still in Application Settings
2. Go to **Advanced Settings** → **OAuth**
3. Verify **Token Endpoint Authentication Method**: `Post` or `Client Secret Post`
4. Click **Save Changes**

### Step 3: Enable Guardian MFA

1. Navigate to **Security** → **Multi-factor Auth**
2. Ensure **Push Notifications via Auth0 Guardian** is enabled
3. Click on **Push Notifications via Auth0 Guardian**
4. Verify settings:
   - **Enabled for**: Select your connections or "All"
   - **Guardian Policies**: Configure as needed
5. Click **Save**

### Step 4: Verify Guardian Enrollment

For your test user:

1. Navigate to **User Management** → **Users**
2. Find your user account
3. Click on the user
4. Go to the **Multi-factor** tab
5. Verify **Guardian** is listed as an enrolled authenticator
6. If not enrolled:
   - Remove all MFA enrollments
   - Log out and log back in
   - Complete Guardian enrollment when prompted

## Testing CIBA

### Test 1: Check CIBA Endpoint

```bash
# Replace with your actual values
curl -X POST https://archfaktor.us.auth0.com/bc-authorize \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET",
    "scope": "openid profile email",
    "binding_message": "Test CIBA Request",
    "login_hint": "sub:YOUR_USER_ID"
  }'
```

**Expected Response:**
```json
{
  "auth_req_id": "abc123...",
  "expires_in": 300,
  "interval": 5
}
```

**Common Errors:**

- `403 Forbidden` - CIBA grant type not enabled
- `400 Bad Request: unsupported_grant_type` - CIBA not configured
- `400 Bad Request: invalid_request` - User ID format wrong or Guardian not enrolled

### Test 2: Test from the App

1. Log into http://localhost:3005/dashboard
2. Ask the agent: "remove member [user-id]"
3. The agent will detect this needs CIBA
4. Click the **"Approve"** button in the chat
5. Watch the server logs for CIBA flow:

```
🔐 Initiating CIBA request for user: auth0|...
   Binding message: Approve: remove_member for user auth0|...
✅ CIBA request initiated successfully
   auth_req_id: abc123...
   expires_in: 300
🔄 Starting CIBA polling...
   Max attempts: 30, Interval: 5s
   Polling attempt 1/30...
   ⏳ Authorization still pending, waiting...
```

6. **Check your phone** - You should receive a Guardian Push notification
7. **Approve** on your phone
8. Server logs should show:

```
✅ CIBA approved! Token received.
```

9. The operation will proceed

## Troubleshooting

### Issue: No Guardian Push notification received

**Possible Causes:**

1. **Guardian not enrolled**
   - **Solution**: Go to User Profile → Multifactor tab, verify Guardian is enrolled
   - If not, remove MFA and re-enroll

2. **CIBA grant type not enabled**
   - **Solution**: Check Application Settings → Advanced → Grant Types
   - Ensure "CIBA" is checked

3. **Wrong user ID format**
   - **Solution**: Check server logs for the exact user ID being used
   - Format should be: `sub:auth0|123456789abcdef`

4. **Guardian app not logged in**
   - **Solution**: Open Guardian app, ensure you're logged in

5. **Push notifications disabled**
   - **Solution**: Check phone settings → Auth0 Guardian → Allow Notifications

### Issue: "authorization_pending" forever

**Possible Causes:**

1. **Notification not reaching phone**
   - Check Guardian app is running
   - Check internet connection
   - Try force-closing and reopening Guardian app

2. **Wrong binding context**
   - The notification is sent but user doesn't see it
   - Check Guardian app for pending requests

### Issue: "access_denied" immediately

**Possible Causes:**

1. **User clicked "Deny" on phone**
   - This is expected behavior
   - Ask user to click "Approve" instead

2. **Guardian policy blocking request**
   - Check Auth0 Guardian policies
   - Verify user's IP/location is allowed

### Issue: 403 Forbidden error

**Solution:**

The application doesn't have CIBA grant type enabled:

1. Go to Auth0 Dashboard
2. Applications → Your App → Settings
3. Advanced Settings → Grant Types
4. Enable **CIBA**
5. Save Changes
6. Retry the operation

### Issue: Request expires (expired_token)

**Possible Causes:**

1. **User took too long to approve**
   - CIBA requests expire in 5 minutes by default
   - User must approve within that time

2. **Polling stopped too early**
   - Check server configuration
   - Default is 30 attempts * 5 seconds = 150 seconds

**Solution**: Increase timeout if needed:
```typescript
// In src/lib/ciba/guardian.ts
const tokenResponse = await pollCIBAToken(
  initResponse.auth_req_id,
  60,  // Increase max attempts
  initResponse.interval || 5
)
```

## Understanding the CIBA Flow

### Normal Flow:

```
1. User: "remove member"
   ↓
2. Agent: Detects operation requires CIBA
   ↓
3. UI: Shows "Approve" button
   ↓
4. User: Clicks "Approve"
   ↓
5. Frontend: Calls /api/ciba/request
   ↓
6. Backend: Initiates CIBA with Auth0
   ↓
7. Auth0: Sends Guardian Push to user's phone
   ↓
8. User's Phone: Shows notification "Approve: remove_member"
   ↓
9. User: Taps "Approve" on phone
   ↓
10. Backend: Polling detects approval
    ↓
11. Frontend: Retries operation with cibaVerified=true
    ↓
12. Agent: Executes operation
    ↓
13. Success!
```

### Expected Timeline:

- **0s**: User clicks "Approve" in UI
- **0-2s**: CIBA request initiated
- **2-5s**: Guardian Push sent to phone
- **5-10s**: User sees notification and taps
- **10-15s**: Backend receives approval
- **15-20s**: Operation executes
- **Total**: ~20 seconds for full flow

## Monitoring CIBA

### Server Logs to Watch:

```bash
# Watch server output for CIBA logs
tail -f /private/tmp/claude/.../tasks/[task-id].output | grep -E "🔐|✅|❌|🔄|⏳"
```

### FGA Activity Monitor:

The FGA Activity Monitor will show:
- Permission checks before CIBA
- Write/delete operations after CIBA approval

### Browser Console:

Check for:
- "Sending Guardian Push notification to your phone..."
- "Guardian Push approved! Executing operation..."
- Or error messages

## Security Considerations

1. **CIBA is Required** for these operations:
   - Update member roles
   - Remove member from organization
   - Delete user account
   - Reset MFA

2. **Cannot be Bypassed**: Even with correct FGA permissions, sensitive operations require Guardian approval

3. **Timeout Protection**: Requests expire after 5 minutes

4. **Audit Trail**: All CIBA requests are logged in Auth0

## Support

If CIBA still doesn't work after following this guide:

1. Check Auth0 Logs:
   - Dashboard → Monitoring → Logs
   - Filter by "CIBA" or "Guardian"

2. Verify Application Type:
   - Must be "Regular Web Application" or "Machine to Machine"
   - Not "Single Page Application" or "Native"

3. Check Tenant Settings:
   - Ensure tenant supports CIBA
   - Some older tenants may need migration

4. Contact Auth0 Support:
   - Provide tenant domain
   - Application client ID
   - Error logs

---

**Last Updated**: February 6, 2026
**Version**: 1.0
