# FGA Activity Monitor - Real-Time Visualization

## Overview
The FGA Activity Monitor provides real-time visualization of all Fine-Grained Authorization operations happening in your application. It displays both a visual flow diagram and a detailed activity log.

## Features

### 1. **Always-On Display**
- Located in the Admin Panel (left side of dashboard)
- No modal/popup needed - always visible
- Auto-refreshes every second to show latest operations

### 2. **Visual Relationship Flow**
The latest FGA operation is displayed as a visual diagram:

```
[User Icon]  --[relation]-->  [Organization Icon]  [Result Icon]
   User ID      (arrow)         Organization ID      ✓/✗/+/-
```

**Components:**
- **User Node**: Blue circle with user icon + truncated user ID
- **Relation**: Arrow with the permission/role being checked (e.g., `can_view`, `admin`, `can_delete`)
- **Organization Node**: Purple circle with building icon + truncated org ID
- **Result Badge**: Shows operation outcome
  - ✓ Allowed (green) - Check succeeded
  - ✗ Denied (gray) - Check failed
  - + Created (green) - Write succeeded
  - - Removed (red) - Delete succeeded
  - Error (red) - Operation failed

**Color Coding:**
- Green background: Successful check or write
- Red background: Delete operation or error
- Gray background: Denied check

### 3. **Activity History Log**
Below the flow diagram is a scrollable list of recent activities:
- Each entry shows: timestamp, operation type, relation, and result
- Color-coded badges:
  - Blue: `check` operations
  - Green: `write` operations
  - Red: `delete` operations
- Latest activity is highlighted in blue
- Up to 100 activities stored in memory

### 4. **Controls**
- **Auto-refresh checkbox**: Toggle real-time updates
- **Clear button**: Remove all activities from the log

## What Gets Logged

### Check Operations
When the system verifies if a user has permission:
```typescript
checkPermission(userId, organizationId, 'can_view')
```
Logs show:
- User attempting the action
- Permission being checked
- Organization context
- Result: ✓ Allowed or ✗ Denied

### Write Operations
When roles/permissions are assigned:
```typescript
writeRelationship(userId, organizationId, 'admin')
```
Logs show:
- User receiving the role
- Role/relation being assigned
- Organization context
- Result: + Created

### Delete Operations
When roles/permissions are removed:
```typescript
deleteRelationship(userId, organizationId, 'support')
```
Logs show:
- User losing the role
- Role/relation being removed
- Organization context
- Result: - Removed

## Real-World Examples

### Example 1: User Views Dashboard
```
Flow Visualization:
[user:auth0|123] --can_view--> [organization:org_xyz] ✓ Allowed

Activity Log:
14:23:45.123  [check]  can_view  ✓
14:23:45.098  [check]  can_reset_mfa  ✓
14:23:45.076  [check]  can_invite  ✓
14:23:45.052  [check]  can_add_member  ✓
```

### Example 2: Agent Checks Permission Before Listing Members
```
Flow Visualization:
[user:auth0|456] --can_view--> [organization:org_xyz] ✗ Denied

Activity Log:
14:25:10.234  [check]  can_view  ✗
```

### Example 3: Admin Assigns Role via Script
```
Flow Visualization:
[user:auth0|789] --admin--> [organization:org_xyz] + Created

Activity Log:
14:30:15.567  [write]  admin
```

### Example 4: Chatbot Operation Flow
When you ask the agent: "list members"
```
Activity Stream:
1. [check] can_view → ✓ Allowed
2. Management API call succeeds
3. Members returned to chat
```

## Technical Details

### Architecture
- **Client-side**: React component with 1-second polling
- **Server-side**: In-memory activity logger (singleton)
- **API Endpoint**: `/api/fga/activities`
  - GET: Retrieve all activities
  - DELETE: Clear activity log

### Activity Logger
Location: `src/lib/fga/activity-logger.ts`

All FGA operations automatically log through:
- `src/lib/fga/checks.ts` - Logs all permission checks
- `src/lib/fga/writes.ts` - Logs all writes and deletes

### Data Structure
```typescript
interface FGAActivity {
  id: string              // Unique activity ID
  timestamp: number       // Unix timestamp (ms)
  type: 'check' | 'write' | 'delete'
  operation: string       // Human-readable description
  user: string           // Formatted user (e.g., "user:auth0|123")
  relation: string       // Permission/role (e.g., "can_view", "admin")
  object: string         // Formatted object (e.g., "organization:org_xyz")
  result?: boolean       // For checks: true = allowed, false = denied
  error?: string         // Error message if operation failed
  metadata?: object      // Additional context
}
```

### Memory Management
- Maximum 100 activities stored
- Oldest activities automatically removed
- Can be cleared manually via UI or API

## Usage

### As a User
1. Navigate to http://localhost:3005/dashboard
2. The FGA Activity Monitor is at the top of the Admin Panel
3. Watch operations happen in real-time as you:
   - Navigate the app
   - Ask the chatbot to do things
   - Run admin scripts

### For Debugging
The monitor is invaluable for:
- **Understanding authorization failures**: See exactly which permission check failed
- **Verifying role assignments**: Confirm writes succeeded
- **Monitoring agent behavior**: Watch what the AI checks before actions
- **Troubleshooting FGA**: See the exact tuples being evaluated

### For Demos
Perfect for demonstrating:
- How FGA authorization works
- Real-time permission checks
- AI agent authorization flow
- Role-based access control in action

## Asking the Agent About Permissions

Instead of checking the static permissions visualizer, you can ask:
- "What are my permissions?"
- "Check my permissions"
- "Show me what I can do"

The agent will use the `check_my_permissions` tool and return your current permissions.

## Future Enhancements

Potential improvements:
- [ ] Filter by operation type (check/write/delete)
- [ ] Search by user or relation
- [ ] Export activity log to JSON
- [ ] Statistics dashboard (success rate, most checked permissions)
- [ ] WebSocket for real-time push instead of polling
- [ ] Persist activity log to database
- [ ] Show permission evaluation path (trace through FGA model)

---

**Created**: February 6, 2026
**Version**: 1.0
