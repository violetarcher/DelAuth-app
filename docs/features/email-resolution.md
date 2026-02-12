# Email and User ID Resolution

## Overview
The app now supports using **either email addresses or user IDs** throughout the interface and with the AI agent. This makes the app more user-friendly since people naturally think in terms of emails rather than Auth0's internal user IDs.

## Key Features

### 1. Dual Identifier Support
All agent tools now accept either format:
- ✅ Email: `user@example.com`
- ✅ User ID: `auth0|6986517b9f3c3f9a274c5ea5`

### 2. Automatic Resolution
The system automatically:
- Detects if input is an email or user ID
- Resolves emails to user IDs via Auth0 Management API
- Returns both email and user ID in responses

### 3. Enhanced Responses
All operations now return:
- User email address
- User ID
- Display name (if available)

## Supported Operations

### With the AI Agent

**Add Member:**
```
✓ "add user@example.com to the organization"
✓ "add auth0|123456 to the organization"
```

**Remove Member:**
```
✓ "remove user@example.com"
✓ "remove auth0|123456"
```

**Update Roles:**
```
✓ "make user@example.com an admin"
✓ "make auth0|123456 an admin"
```

**Delete Member:**
```
✓ "delete user@example.com"
✓ "delete auth0|123456"
```

**Reset MFA:**
```
✓ "reset MFA for user@example.com"
✓ "reset MFA for auth0|123456"
```

## How It Works

### Architecture

```
User Input (email or userId)
     ↓
normalizeToUserId()
     ↓
Auth0 Management API Search
     ↓
Resolve to User ID
     ↓
Execute Operation
     ↓
Return with both email & userId
```

### Resolution Process

1. **Detection**:
   - Checks if input contains `@` → Email
   - Checks if input contains `|` or starts with `auth0` → User ID

2. **Lookup** (if email):
   - Query Auth0: `GET /api/v2/users?q=email:"user@example.com"`
   - Extract `user_id` from results
   - Cache user details for response

3. **Execution**:
   - Use resolved user ID for Auth0 API calls
   - Maintain email for display purposes

4. **Response**:
   - Include both identifiers in result
   - Show user-friendly messages with emails

## Implementation Details

### User Resolver (`src/lib/auth0/user-resolver.ts`)

**Key Functions:**

```typescript
// Check if string is email
isEmail(identifier: string): boolean

// Check if string is user ID
isUserId(identifier: string): boolean

// Convert email → user ID
normalizeToUserId(identifier: string): Promise<string | null>

// Get full user details from either format
resolveUserIdentifier(identifier: string): Promise<{
  userId: string
  email: string
  name?: string
} | null>

// Get user info for display
getUserInfo(identifier: string): Promise<{
  userId: string
  email: string
  displayName: string
} | null>
```

### Updated Agent Tools

All these tools now accept either format:
- `addMember(userIdentifier, roles)`
- `updateMemberRoles(userIdentifier, roles)`
- `removeMember(userIdentifier)`
- `deleteMember(userIdentifier)`
- `resetMemberMFA(userIdentifier)`

### Tool Descriptions Updated

The AI agent knows it can accept either format:

```typescript
{
  name: 'remove_member',
  description: 'Remove a member from the organization. Accepts either email address or user ID...',
  parameters: {
    userId: {
      type: 'string',
      description: 'User email address (e.g., user@example.com) or Auth0 user ID (e.g., auth0|123...)'
    }
  }
}
```

## Examples

### Example 1: Remove Member by Email

**User:** "remove john@example.com from the organization"

**Agent Process:**
1. Calls `remove_member` tool with `john@example.com`
2. Tool detects email format
3. Looks up user ID: `auth0|6986517b9f3c3f9a274c5ea5`
4. Checks FGA permission
5. Requires CIBA approval
6. After approval, removes member
7. Returns: "Member john@example.com removed successfully"

**FGA Activity Monitor Shows:**
```
[user:auth0|current_user] --can_remove_member--> [organization:org_xyz] ✓ Allowed
[user:auth0|6986517b9f3c3f9a274c5ea5] --member--> [organization:org_xyz] - Removed
```

### Example 2: Add Member by User ID

**User:** "add auth0|abc123 as support"

**Agent Process:**
1. Calls `add_member` tool with `auth0|abc123`
2. Tool detects user ID format (no lookup needed)
3. Fetches user details for display
4. Checks FGA permission
5. Adds member with support role
6. Returns: "Added user@example.com (auth0|abc123) with role: support"

### Example 3: Reset MFA by Email

**User:** "reset MFA for jane.doe@company.com"

**Agent Process:**
1. Calls `reset_member_mfa` tool with `jane.doe@company.com`
2. Resolves to user ID
3. Checks FGA permission
4. Requires CIBA approval
5. After approval, resets MFA
6. Returns: "MFA reset for jane.doe@company.com"

## Benefits

### User Experience
- **Natural Language**: Users can speak/type emails naturally
- **No ID Lookup**: Don't need to find Auth0 user IDs manually
- **Clear Responses**: See both email and ID in confirmations

### Agent Intelligence
- **Context Awareness**: Agent understands both formats
- **Flexible Input**: Works regardless of how user specifies target
- **Better Conversations**: More natural interactions

### Error Handling
- **Not Found**: Clear message if email doesn't exist
- **Multiple Matches**: Warns if multiple users have same email (uses first)
- **Invalid Format**: Helpful error if neither email nor user ID

## Member List Display

The member list UI already shows both:
- **Primary**: Email address
- **Secondary**: User ID (truncated)
- **Hover**: Full user ID tooltip

This allows users to:
- Copy email for chat commands
- Copy user ID if needed
- See both pieces of information at once

## Performance Considerations

### Caching
- M2M token cached (reused for lookups)
- User lookups cached in function scope
- No redundant Auth0 API calls

### Optimization
- Single API call per email lookup
- User details fetched once per operation
- Batch operations supported (future enhancement)

## Error Scenarios

### Email Not Found
```
User: "remove nonexistent@example.com"
Agent: "Could not find user with identifier: nonexistent@example.com"
```

### Invalid Format
```
User: "remove invalid-identifier"
Agent: "Could not find user with identifier: invalid-identifier"
```

### Multiple Users (rare)
```
Console: "Multiple users found with email: shared@example.com, using first one"
Agent proceeds with first match
```

## Future Enhancements

Potential improvements:
- [ ] Cache email→userId mappings in memory
- [ ] Support partial email matching
- [ ] Bulk operations with mixed identifiers
- [ ] Export user list with both email and ID
- [ ] Search by name or other attributes
- [ ] Autocomplete suggestions in chat

## Testing

### Test Scenarios

1. **Email Resolution**:
   - Add member by email
   - Verify correct user ID resolved
   - Check operation succeeds

2. **User ID Direct**:
   - Remove member by user ID
   - Verify no lookup needed
   - Check operation succeeds

3. **Mixed Usage**:
   - Add by email, remove by ID
   - Add by ID, update by email
   - Verify both work seamlessly

4. **Error Cases**:
   - Try invalid email
   - Try non-existent user ID
   - Verify helpful error messages

### Manual Testing

```bash
# Test via Agent
1. "add test@example.com"
2. "remove auth0|123456"
3. "reset MFA for user@domain.com"
4. "make admin@company.com super admin"
```

## Troubleshooting

### Issue: Email lookup fails

**Symptoms**: "Could not find user" error

**Solutions**:
1. Verify user exists in Auth0
2. Check exact email spelling
3. Ensure M2M token has `read:users` scope
4. Check Auth0 API rate limits

### Issue: Wrong user resolved

**Symptoms**: Operation affects wrong user

**Solutions**:
1. Check for duplicate emails in Auth0
2. Review console logs for warnings
3. Use user ID directly for precision

### Issue: Slow responses

**Symptoms**: Agent takes long to respond

**Solutions**:
1. Check Auth0 API response time
2. Verify M2M token not expired
3. Monitor API rate limits
4. Consider implementing Redis cache

---

**Created**: February 6, 2026
**Version**: 1.0
