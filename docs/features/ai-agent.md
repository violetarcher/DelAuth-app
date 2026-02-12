# AI Agent Authentication & Authorization

This document explains how the AI chatbot agent is secured and operates on behalf of authenticated users.

## Overview

The AI agent in this application:
- **Authenticates as the logged-in user** using their Auth0 session
- **Checks FGA permissions** before executing any operation
- **Requires CIBA verification** for sensitive operations (Guardian Push)
- **Uses OpenAI function calling** to execute operations directly via chat
- **Respects role-based access control** (super_admin, admin, support)

## Architecture

```
User Message
    ↓
ChatInterface (React)
    ↓
POST /api/chat (Next.js API Route)
    ↓
├─ Get user session (Auth0)
├─ Get user access token
├─ Create AgentContext { userId, organizationId, accessToken }
    ↓
OpenAI GPT-4o mini with Function Calling
    ↓
├─ System Prompt (defines available tools)
├─ User Message
└─ Tools: [list_members, invite_member, update_member_roles, ...]
    ↓
Agent decides to call a tool
    ↓
executeTool(toolName, args, context, cibaVerified)
    ↓
├─ Check FGA permission (using user's ID)
├─ If permission denied → return error
├─ If sensitive operation & !cibaVerified → return requiresCIBA
├─ Execute operation using user's access token
└─ Return result
    ↓
If requiresCIBA:
    Show Guardian approval UI
    User approves → resend with cibaVerified=true
Otherwise:
    Stream response to user
```

## User Context

Every operation executed by the agent includes:

```typescript
interface AgentContext {
  userId: string           // Auth0 user ID (e.g., auth0|123...)
  organizationId: string   // Current organization ID
  accessToken: string      // User's Management API access token
}
```

This context ensures:
1. **Identity**: The agent acts as the specific user, not as a system account
2. **Authorization**: Operations use the user's permissions, not elevated privileges
3. **Audit trail**: All API calls are logged with the user's identity

## Available Agent Tools

The agent has access to these operations (via OpenAI function calling):

### 1. list_members
- **Description**: Show all organization members
- **Required Permission**: `can_view`
- **CIBA**: Not required
- **Example**: "Show me all members" or "List users in the organization"

### 2. invite_member
- **Description**: Send email invitation to new user
- **Required Permission**: `can_invite`
- **CIBA**: Not required
- **Parameters**: `email`, `roles` (optional)
- **Example**: "Invite john@example.com as an admin"

### 3. add_member
- **Description**: Add existing Auth0 user to organization
- **Required Permission**: `can_add_member`
- **CIBA**: Not required
- **Parameters**: `userId`, `roles` (optional)
- **Example**: "Add user auth0|123 to the organization"

### 4. update_member_roles
- **Description**: Change member's roles
- **Required Permission**: `can_update_roles`
- **CIBA**: **Required** ✅
- **Parameters**: `userId`, `roles`
- **Example**: "Make user auth0|123 a super admin"

### 5. remove_member
- **Description**: Remove member from organization
- **Required Permission**: `can_remove_member`
- **CIBA**: **Required** ✅
- **Parameters**: `userId`
- **Example**: "Remove john@example.com from the organization"

### 6. delete_member
- **Description**: Permanently delete user from Auth0
- **Required Permission**: `can_delete` (super_admin only)
- **CIBA**: **Required** ✅
- **Parameters**: `userId`
- **Example**: "Delete user auth0|123 completely"

### 7. reset_member_mfa
- **Description**: Reset user's MFA settings
- **Required Permission**: `can_reset_mfa`
- **CIBA**: **Required** ✅
- **Parameters**: `userId`
- **Example**: "Reset MFA for john@example.com"

### 8. check_my_permissions
- **Description**: Show current user's permissions
- **Required Permission**: None (informational)
- **CIBA**: Not required
- **Example**: "What can I do?" or "Show my permissions"

## FGA Permission Checks

Before executing any tool, the agent checks the user's FGA permission:

```typescript
const hasPermission = await checkPermission(
  context.userId,           // The logged-in user
  context.organizationId,   // Current organization
  'can_invite'             // Required permission for this operation
)

if (!hasPermission) {
  return {
    success: false,
    error: 'You do not have permission to invite members'
  }
}
```

This ensures the agent can **never** perform operations the user isn't authorized for.

## CIBA Verification Flow

Sensitive operations require additional verification via Guardian Push:

### Step 1: Agent attempts sensitive operation
```typescript
const result = await executeTool('update_member_roles', args, context, false)
```

### Step 2: Tool returns CIBA requirement
```typescript
{
  success: false,
  requiresCIBA: true,
  cibaOperation: 'update_member_roles',
  data: { userId: 'auth0|123', roles: ['super_admin'] }
}
```

### Step 3: UI shows Guardian approval prompt
```
┌─────────────────────────────────────────┐
│ ⚠️  Guardian Verification Required       │
│                                         │
│ Operation: update_member_roles          │
│ Check your Guardian app to approve.     │
│                                         │
│ [Simulate Approval]  [Cancel]          │
└─────────────────────────────────────────┘
```

### Step 4: User approves (via Guardian or simulation)
```typescript
// Resend with cibaVerified=true
handleSend(cibaRequest.pendingMessage, true)
```

### Step 5: Tool executes with verified flag
```typescript
const result = await executeTool('update_member_roles', args, context, true)
// Now executes the operation
```

## Security Benefits

### 1. Least Privilege
The agent has NO elevated permissions. It can only do what the logged-in user can do.

### 2. Token Scoping
The agent uses the user's Management API access token, which has specific scopes:
```
read:users
read:organizations
read:organization_members
create:organization_invitations
create:organization_members
update:organization_members
delete:organization_members
```

### 3. Dual Authorization
- **FGA check**: Verifies user has the permission (e.g., can_delete)
- **Access token**: Enforces Auth0 Management API authorization

### 4. CIBA for Sensitive Ops
Destructive or sensitive operations require push notification approval:
- Update roles
- Remove member
- Delete user
- Reset MFA

### 5. Audit Trail
All operations are logged with the user's identity in Auth0 logs.

## Testing Guide

### Test 1: List Members (All Roles)
```
Login as: superadmin@atko.email / admin@atko.email / support@atko.email
Password: Test123!@#

In chat:
> "Show me all members in the organization"

Expected: Lists all members with names and roles
```

### Test 2: Invite Member (Admin/Super Admin Only)
```
Login as: admin@atko.email
Password: Test123!@#

In chat:
> "Invite newuser@example.com as a support agent"

Expected: Success message confirming invitation sent
```

### Test 3: Permission Denied (Support trying to invite)
```
Login as: support@atko.email
Password: Test123!@#

In chat:
> "Invite someone@example.com"

Expected: Error message - "You do not have permission to invite members"
```

### Test 4: CIBA Flow (Update Roles)
```
Login as: admin@atko.email
Password: Test123!@#

In chat:
> "Update member1@atko.email to be an admin"

Expected:
1. Message: "This operation requires verification via your Guardian app..."
2. Yellow CIBA panel appears with "Simulate Approval" button
3. Click "Simulate Approval"
4. Success message: "Member roles updated successfully"
```

### Test 5: Delete User (Super Admin Only)
```
Login as: superadmin@atko.email
Password: Test123!@#

In chat:
> "Delete user auth0|6986517fbd7d2ffe59dd812a"

Expected:
1. CIBA approval prompt appears
2. After approval: Success message
```

### Test 6: Delete User Denied (Admin trying)
```
Login as: admin@atko.email
Password: Test123!@#

In chat:
> "Delete user auth0|6986517fbd7d2ffe59dd812a"

Expected: Error - "You do not have permission to delete members (requires super_admin)"
```

## Extending the Agent

To add new operations:

### 1. Add FGA Permission (if needed)
Update `fga-model.fga` and redeploy.

### 2. Create Tool Function
```typescript
export async function myNewOperation(
  context: AgentContext,
  param1: string,
  cibaVerified: boolean = false
): Promise<ToolResult> {
  // Check FGA permission
  const hasPermission = await checkPermission(
    context.userId,
    context.organizationId,
    'can_do_something'
  )

  if (!hasPermission) {
    return { success: false, error: 'Permission denied' }
  }

  // Require CIBA if sensitive
  if (!cibaVerified) {
    return { success: false, requiresCIBA: true, cibaOperation: 'my_operation' }
  }

  // Execute using user's token
  const response = await axios.post(url, data, {
    headers: { Authorization: `Bearer ${context.accessToken}` }
  })

  return { success: true, data: response.data }
}
```

### 3. Add Tool Definition
```typescript
export const agentTools = [
  // ... existing tools
  {
    type: 'function',
    function: {
      name: 'my_new_operation',
      description: 'Does something cool. Requires can_do_something permission.',
      parameters: {
        type: 'object',
        properties: {
          param1: { type: 'string', description: 'Parameter description' }
        },
        required: ['param1']
      }
    }
  }
]
```

### 4. Add to executeTool Switch
```typescript
export async function executeTool(...) {
  switch (toolName) {
    // ... existing cases
    case 'my_new_operation':
      return myNewOperation(context, args.param1, cibaVerified)
  }
}
```

### 5. Update System Prompt
Add the new operation to the system prompt in `src/lib/openai/client.ts`.

## Implementation Details

### Files Created/Modified

**New Files:**
- `src/lib/agent/tools.ts` (534 lines) - Agent tools with FGA permission checks

**Modified Files:**
- `src/app/api/chat/route.ts` - OpenAI function calling support
- `src/lib/openai/client.ts` - Enhanced system prompt
- `src/components/chat/ChatInterface.tsx` - CIBA verification UI
- `src/components/chat/ChatMessage.tsx` - Tool message support

## Monitoring & Debugging

### Check Agent Logs
```bash
# In the Next.js terminal
Agent executing tool: list_members
Tool result: list_members {"success":true,"data":[...]}
```

### Check Auth0 Logs
- Go to Auth0 Dashboard → Monitoring → Logs
- Filter by user ID to see all operations
- Look for Management API calls

### Check FGA Logs
FGA checks are logged in the application:
```
FGA check: user:auth0|123 can_view organization:org_0EgXDHCsaAtl5uhG → true
```

## Production Considerations

1. **Implement Real CIBA**: Replace simulation with actual Guardian Push API
2. **Rate Limiting**: Add per-user rate limits to prevent abuse
3. **Token Refresh**: Handle access token expiration gracefully
4. **Enhanced Logging**: Centralized logging service (DataDog, CloudWatch)
5. **Error Recovery**: More robust error handling for network failures
6. **Monitoring & Alerts**: Alert on failed FGA checks and track agent usage patterns

## Security Best Practices

### ✅ Do's
- Always check FGA permissions before operations
- Use the user's access token for all API calls
- Require CIBA for sensitive/destructive operations
- Log all agent operations with user context
- Return clear error messages for permission denials

### ❌ Don'ts
- Never use a service account or system token
- Never bypass FGA checks
- Never skip CIBA for sensitive operations
- Never expose raw tokens in agent responses
- Never execute operations without user context
