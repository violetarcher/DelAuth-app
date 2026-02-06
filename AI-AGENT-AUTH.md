# AI Agent Authentication & User-Scoped Actions

This document explains how the AI chatbot agent is secured and operates on behalf of authenticated users.

## Overview

The AI agent in this application:
- **Authenticates as the logged-in user** using their Auth0 session and access token
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

### 1. **list_members**
- **Description**: Show all organization members
- **Required Permission**: `can_view`
- **CIBA**: Not required
- **Example**: "Show me all members" or "List users in the organization"

### 2. **invite_member**
- **Description**: Send email invitation to new user
- **Required Permission**: `can_invite`
- **CIBA**: Not required
- **Parameters**: `email`, `roles` (optional)
- **Example**: "Invite john@example.com as an admin"

### 3. **add_member**
- **Description**: Add existing Auth0 user to organization
- **Required Permission**: `can_add_member`
- **CIBA**: Not required
- **Parameters**: `userId`, `roles` (optional)
- **Example**: "Add user auth0|123 to the organization"

### 4. **update_member_roles**
- **Description**: Change member's roles
- **Required Permission**: `can_update_roles`
- **CIBA**: **Required** ✅
- **Parameters**: `userId`, `roles`
- **Example**: "Make user auth0|123 a super admin"

### 5. **remove_member**
- **Description**: Remove member from organization
- **Required Permission**: `can_remove_member`
- **CIBA**: **Required** ✅
- **Parameters**: `userId`
- **Example**: "Remove john@example.com from the organization"

### 6. **delete_member**
- **Description**: Permanently delete user from Auth0
- **Required Permission**: `can_delete` (super_admin only)
- **CIBA**: **Required** ✅
- **Parameters**: `userId`
- **Example**: "Delete user auth0|123 completely"

### 7. **reset_member_mfa**
- **Description**: Reset user's MFA settings
- **Required Permission**: `can_reset_mfa`
- **CIBA**: **Required** ✅
- **Parameters**: `userId`
- **Example**: "Reset MFA for john@example.com"

### 8. **check_my_permissions**
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

### 1. **Least Privilege**
The agent has NO elevated permissions. It can only do what the logged-in user can do.

### 2. **Token Scoping**
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

### 3. **Dual Authorization**
- **FGA check**: Verifies user has the permission (e.g., can_delete)
- **Access token**: Enforces Auth0 Management API authorization

### 4. **CIBA for Sensitive Ops**
Destructive or sensitive operations require push notification approval:
- Update roles
- Remove member
- Delete user
- Reset MFA

### 5. **Audit Trail**
All operations are logged with the user's identity in Auth0 logs.

## Example Agent Interactions

### Example 1: List Members (Allowed)

**User**: "Show me all members in the organization"

**Agent**:
1. Calls `list_members` tool
2. Checks `can_view` permission → ✅ Allowed (user is admin)
3. Fetches members using user's access token
4. Returns formatted list:

```
Here are the members in your organization:

1. **superadmin@atko.email** - Super Admin
   User ID: auth0|6986517b9f3c3f9a274c5ea5

2. **admin@atko.email** - Admin
   User ID: auth0|6986517d7eaf93c67df63d5c

3. **support@atko.email** - Support
   User ID: auth0|6986517e72631b6341adfe21

4. **member1@atko.email** - Member (John Doe)
   User ID: auth0|6986517fbd7d2ffe59dd812a

...
```

### Example 2: Invite Member (Allowed)

**User**: "Invite newuser@example.com as a support agent"

**Agent**:
1. Calls `invite_member` tool with email and support role
2. Checks `can_invite` permission → ✅ Allowed
3. Creates invitation via Management API
4. Returns confirmation:

```
✅ Invitation sent successfully!

I've sent an invitation to newuser@example.com with the support role.
They'll receive an email with instructions to join the organization.
```

### Example 3: Delete User (Requires CIBA)

**User**: "Delete user auth0|6986517fbd7d2ffe59dd812a"

**Agent**:
1. Calls `delete_member` tool
2. Checks `can_delete` permission → ✅ Allowed (user is super_admin)
3. Tool returns `requiresCIBA: true`
4. UI shows Guardian approval prompt
5. User approves via Guardian app (or simulation)
6. Tool re-executes with `cibaVerified=true`
7. Deletes user via Management API
8. Returns confirmation:

```
✅ User deleted successfully!

The user auth0|6986517fbd7d2ffe59dd812a has been permanently
deleted from Auth0.
```

### Example 4: Permission Denied

**User (logged in as support)**: "Make member1@atko.email an admin"

**Agent**:
1. Calls `update_member_roles` tool
2. Checks `can_update_roles` permission → ❌ Denied (support role lacks this permission)
3. Returns error:

```
❌ You do not have permission to update member roles.

Your current role (support) allows you to:
- View members
- Reset MFA

To update member roles, you need admin or super_admin permissions.
```

## Implementation Details

### Tool Definition (OpenAI Function Calling)

```typescript
export const agentTools = [
  {
    type: 'function',
    function: {
      name: 'list_members',
      description: 'List all members in the organization. Requires can_view permission.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  // ... other tools
]
```

### Tool Execution

```typescript
export async function executeTool(
  toolName: string,
  args: any,
  context: AgentContext,
  cibaVerified: boolean = false
): Promise<ToolResult> {
  switch (toolName) {
    case 'list_members':
      return listMembers(context)

    case 'update_member_roles':
      return updateMemberRoles(context, args.userId, args.roles, cibaVerified)

    // ... other tools
  }
}
```

### API Route Flow

```typescript
export async function POST(request: NextRequest) {
  // 1. Get user session
  const session = await getSession()
  const userId = session.user.sub

  // 2. Get user's access token
  const { accessToken } = await getAccessToken()

  // 3. Create context
  const context: AgentContext = { userId, organizationId, accessToken }

  // 4. Call OpenAI with tools
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [...],
    tools: agentTools,
    tool_choice: 'auto',
  })

  // 5. Execute tool calls with user context
  if (responseMessage.tool_calls) {
    for (const toolCall of responseMessage.tool_calls) {
      const result = await executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments),
        context,
        cibaVerified
      )

      // 6. Check for CIBA requirement
      if (result.requiresCIBA) {
        return NextResponse.json({ requiresCIBA: true, ... })
      }
    }
  }

  // 7. Stream final response
  return new NextResponse(readable, ...)
}
```

## Testing Agent Authentication

### Test as Super Admin
```
Login: superadmin@atko.email
Password: Test123!@#

Try:
- "List all members" ✅
- "Invite someone@example.com" ✅
- "Delete user auth0|XXX" ✅ (requires CIBA)
```

### Test as Admin
```
Login: admin@atko.email
Password: Test123!@#

Try:
- "List all members" ✅
- "Invite someone@example.com" ✅
- "Update member1's roles" ✅ (requires CIBA)
- "Delete user auth0|XXX" ❌ (permission denied)
```

### Test as Support
```
Login: support@atko.email
Password: Test123!@#

Try:
- "List all members" ✅
- "Reset MFA for member1" ✅ (requires CIBA)
- "Invite someone@example.com" ❌ (permission denied)
- "Update member roles" ❌ (permission denied)
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

## Security Considerations

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

### 1. Implement Real CIBA
Replace the "Simulate Approval" button with actual Guardian Push integration:
- Create CIBA request via Auth0 API
- Poll for approval status
- Execute operation after approval

### 2. Rate Limiting
Add rate limits to prevent abuse:
```typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each user to 100 requests per windowMs
})
```

### 3. Token Refresh
Implement token refresh when access tokens expire:
```typescript
const tokenResult = await getAccessToken({
  refresh: true // Force token refresh if expired
})
```

### 4. Enhanced Logging
Log all agent operations to a centralized system:
```typescript
await logAgentOperation({
  userId: context.userId,
  operation: toolName,
  args: args,
  result: result,
  timestamp: new Date(),
})
```

### 5. Error Handling
Add more robust error handling for edge cases:
- Network failures
- Token expiration
- Rate limit errors
- Invalid permissions

## Conclusion

The AI agent authentication system ensures:
- **Security**: Agent operates with user's permissions, not elevated privileges
- **Transparency**: All operations are logged and auditable
- **Safety**: Sensitive operations require CIBA verification
- **Usability**: Natural language interface for admin tasks

The agent is a secure, user-scoped assistant that respects authorization boundaries while providing powerful conversational management capabilities.
