/**
 * AI Agent Tools - User-scoped operations with FGA checks
 *
 * Each tool operates on behalf of the authenticated user, checking their
 * FGA permissions before executing actions.
 */

import axios from 'axios'
import { checkPermission } from '@/lib/fga/checks'
import { assignRole as writeFGARole, removeAllUserRoles, updateUserRoles, getUserFGARoles } from '@/lib/fga/writes'
import { FGAPermission } from '@/types/fga'
import { normalizeToUserId, isEmail, resolveUserIdentifier } from '@/lib/auth0/user-resolver'

// Cache for organization details
let cachedOrgDetails: { orgId: string; name: string; displayName: string } | null = null

/**
 * Available FGA roles (relationships in the authorization model)
 */
export const AVAILABLE_ROLES = [
  'super_admin',
  'admin',
  'support',
  'member',
] as const

export type FGARole = typeof AVAILABLE_ROLES[number]

/**
 * Format role name to human-readable form
 */
function formatRoleName(role: string): string {
  const roleMap: Record<string, string> = {
    'super_admin': 'Super Admin',
    'admin': 'Admin',
    'support': 'Support',
    'member': 'Member',
  }
  return roleMap[role] || role
}

/**
 * Format role with both human name and ID
 */
function formatRoleDisplay(role: string): string {
  return `**${formatRoleName(role)}** (\`${role}\`)`
}

/**
 * Create user-friendly error message when user lookup fails
 */
function createUserNotFoundError(userIdentifier: string): string {
  const isEmail = userIdentifier.includes('@')

  if (isEmail) {
    return `Could not find any Auth0 user with email **${userIdentifier}**. Please verify:\n\n` +
           `• The email address is spelled correctly\n` +
           `• The user exists in Auth0 (not just invited)\n` +
           `• The user has logged in at least once\n\n` +
           `You can use the "list members" command to see all current members, or check the Auth0 dashboard.`
  } else {
    return `Could not find user with ID **${userIdentifier}**. The user may not exist or may have been deleted.`
  }
}

/**
 * Get organization details
 */
async function getOrganizationDetails(organizationId: string): Promise<{ name: string; displayName: string }> {
  // Return cached if available
  if (cachedOrgDetails && cachedOrgDetails.orgId === organizationId) {
    return { name: cachedOrgDetails.name, displayName: cachedOrgDetails.displayName }
  }

  try {
    const mgmtToken = await getManagementToken()
    const response = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const org = response.data
    cachedOrgDetails = {
      orgId: organizationId,
      name: org.name || 'Unknown Organization',
      displayName: org.display_name || org.name || 'Unknown Organization',
    }

    return { name: cachedOrgDetails.name, displayName: cachedOrgDetails.displayName }
  } catch (error) {
    console.error('Failed to fetch organization details:', error)
    return { name: 'Unknown Organization', displayName: 'Unknown Organization' }
  }
}

export interface AgentContext {
  userId: string
  organizationId: string
  accessToken: string
  userEmail?: string
  userName?: string
}

// Cache for M2M token
let cachedM2MToken: { token: string; expiresAt: number } | null = null

/**
 * Get Management API M2M token
 */
async function getManagementToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedM2MToken && cachedM2MToken.expiresAt > Date.now()) {
    return cachedM2MToken.token
  }

  const response = await axios.post(
    `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
    {
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }
  )

  const { access_token, expires_in } = response.data

  // Cache token with 5 minute buffer
  cachedM2MToken = {
    token: access_token,
    expiresAt: Date.now() + (expires_in - 300) * 1000,
  }

  return access_token
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  requiresCIBA?: boolean
  cibaOperation?: string
}

/**
 * Get information about the current user
 */
export async function getMyInfo(
  context: AgentContext
): Promise<ToolResult> {
  try {
    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Fetch organization details
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Fetch full user details from Auth0
    const userResponse = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(context.userId)}`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const user = userResponse.data

    // Get user's roles in organization
    const rolesResponse = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members/${encodeURIComponent(context.userId)}/roles`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const roles = rolesResponse.data
    const formattedRoles = roles.map((r: any) => formatRoleDisplay(r.name))

    return {
      success: true,
      data: {
        name: user.name || 'Unknown',
        email: user.email,
        emailVerified: user.email_verified,
        userId: user.user_id,
        nickname: user.nickname,
        givenName: user.given_name,
        familyName: user.family_name,
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        roles: roles.map((r: any) => r.name),
        formattedRoles: formattedRoles,
        lastLogin: user.last_login,
        loginsCount: user.logins_count,
        createdAt: user.created_at,
      },
    }
  } catch (error: any) {
    console.error('getMyInfo error:', error)
    return {
      success: false,
      error: 'Failed to get user info',
    }
  }
}

/**
 * Get detailed information about a specific member
 */
export async function getMemberInfo(
  context: AgentContext,
  userIdentifier: string
): Promise<ToolResult> {
  try {
    // Check FGA permission
    const hasPermission = await checkPermission(
      context.userId,
      context.organizationId,
      'can_view'
    )

    if (!hasPermission) {
      return {
        success: false,
        error: 'You do not have permission to view members',
      }
    }

    // Resolve to user ID
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Fetch organization details
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Fetch full user details from Auth0
    const userResponse = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(userId)}`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const user = userResponse.data

    // Get user's roles in organization
    const rolesResponse = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members/${encodeURIComponent(userId)}/roles`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const roles = rolesResponse.data
    const formattedRoles = roles.map((r: any) => formatRoleDisplay(r.name))

    return {
      success: true,
      data: {
        name: user.name || 'Unknown',
        email: user.email,
        emailVerified: user.email_verified,
        userId: user.user_id,
        nickname: user.nickname,
        givenName: user.given_name,
        familyName: user.family_name,
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        roles: roles.map((r: any) => r.name),
        formattedRoles: formattedRoles,
        lastLogin: user.last_login,
        loginsCount: user.logins_count,
        createdAt: user.created_at,
      },
    }
  } catch (error: any) {
    console.error('getMemberInfo error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to get member info',
    }
  }
}

/**
 * List available FGA roles
 */
export async function listAvailableRoles(
  context: AgentContext
): Promise<ToolResult> {
  try {
    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    const roleDescriptions = [
      {
        role: 'super_admin',
        name: 'Super Admin',
        description: 'Full control - all operations including delete',
        permissions: ['can_view', 'can_reset_mfa', 'can_invite', 'can_add_member', 'can_update_roles', 'can_remove_member', 'can_delete'],
      },
      {
        role: 'admin',
        name: 'Admin',
        description: 'All operations except delete',
        permissions: ['can_view', 'can_reset_mfa', 'can_invite', 'can_add_member', 'can_update_roles', 'can_remove_member'],
      },
      {
        role: 'support',
        name: 'Support',
        description: 'View members and reset MFA only',
        permissions: ['can_view', 'can_reset_mfa'],
      },
      {
        role: 'member',
        name: 'Member',
        description: 'Regular user with no admin permissions (users being managed)',
        permissions: [],
      },
    ]

    return {
      success: true,
      data: {
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        roles: roleDescriptions,
        message: `**Available Roles in ${orgDetails.displayName}:**\n\n` +
          roleDescriptions.map(r =>
            `• **${r.name}** (\`${r.role}\`): ${r.description}\n  Permissions: ${r.permissions.length > 0 ? r.permissions.join(', ') : 'None'}`
          ).join('\n\n'),
      },
    }
  } catch (error: any) {
    console.error('listAvailableRoles error:', error)
    return {
      success: false,
      error: 'Failed to list available roles',
    }
  }
}

/**
 * List organization members (requires can_view permission)
 */
export async function listMembers(
  context: AgentContext
): Promise<ToolResult> {
  try {
    // Check FGA permission
    const hasPermission = await checkPermission(
      context.userId,
      context.organizationId,
      'can_view'
    )

    if (!hasPermission) {
      return {
        success: false,
        error: 'You do not have permission to view members',
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Fetch organization details
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Call Management API using M2M token
    const response = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
        params: {
          per_page: 100,
        },
      }
    )

    // Enhance member data with formatted display
    const members = response.data
    const enhancedMembers = members.map((member: any) => ({
      ...member,
      displayName: member.name || member.email,
      userIdShort: member.user_id.substring(0, 20) + '...',
    }))

    return {
      success: true,
      data: {
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        members: enhancedMembers,
        totalCount: enhancedMembers.length,
      },
    }
  } catch (error: any) {
    console.error('listMembers error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to list members',
    }
  }
}

/**
 * Invite a new member (requires can_invite permission)
 */
export async function inviteMember(
  context: AgentContext,
  email: string,
  roles: string[]
): Promise<ToolResult> {
  try {
    // Check FGA permission
    const hasPermission = await checkPermission(
      context.userId,
      context.organizationId,
      'can_invite'
    )

    if (!hasPermission) {
      return {
        success: false,
        error: 'You do not have permission to invite members',
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Validate role names (only FGA roles allowed)
    const validRoles = roles.filter(role => AVAILABLE_ROLES.includes(role as FGARole))
    if (validRoles.length !== roles.length) {
      const invalidRoles = roles.filter(role => !AVAILABLE_ROLES.includes(role as FGARole))
      return {
        success: false,
        error: `Invalid role(s): ${invalidRoles.join(', ')}. Valid roles are: ${AVAILABLE_ROLES.join(', ')}`,
      }
    }

    // Send invitation via Auth0 (no role assignment in Auth0, just invitation)
    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/invitations`,
      {
        inviter: { name: context.userName || 'AI Assistant' },
        invitee: { email },
        client_id: process.env.AUTH0_CLIENT_ID,
      },
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Note: FGA tuples will be written when the user accepts the invitation and is added to the organization

    // Format roles for response
    const formattedRoles = roles.length > 0 ? roles.map(formatRoleDisplay) : ['No roles assigned']

    return {
      success: true,
      data: {
        ...response.data,
        email: email,
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        roles: roles,
        formattedRoles: formattedRoles,
        message: `✅ Invitation sent to **${email}** for **${orgDetails.displayName}** with role(s): ${formattedRoles.join(', ')}`,
      },
    }
  } catch (error: any) {
    console.error('inviteMember error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to invite member',
    }
  }
}

/**
 * Add existing user to organization (requires can_add_member permission)
 * Accepts either email or user ID
 */
export async function addMember(
  context: AgentContext,
  userIdentifier: string,
  roles: string[]
): Promise<ToolResult> {
  try {
    // Check FGA permission
    const hasPermission = await checkPermission(
      context.userId,
      context.organizationId,
      'can_add_member'
    )

    if (!hasPermission) {
      return {
        success: false,
        error: 'You do not have permission to add members',
      }
    }

    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get user details for response
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Validate role names (only FGA roles allowed)
    const validRoles = roles.filter(role => AVAILABLE_ROLES.includes(role as FGARole))
    if (validRoles.length !== roles.length) {
      const invalidRoles = roles.filter(role => !AVAILABLE_ROLES.includes(role as FGARole))
      return {
        success: false,
        error: `Invalid role(s): ${invalidRoles.join(', ')}. Valid roles are: ${AVAILABLE_ROLES.join(', ')}`,
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Add user to Auth0 organization (membership only, no Auth0 roles)
    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members`,
      {
        members: [userId],
      },
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    // Write FGA tuples for each role
    if (roles && roles.length > 0) {
      for (const role of roles) {
        await writeFGARole(userId, context.organizationId, role as FGARole)
      }
    }

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Format roles for response
    const formattedRoles = roles.map(formatRoleDisplay)

    return {
      success: true,
      data: {
        ...response.data,
        userName: userInfo?.name || userInfo?.email,
        userEmail: userInfo?.email,
        userId: userId,
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        formattedRoles: formattedRoles,
        message: `✅ Successfully added **${userInfo?.name || userInfo?.email}** to **${orgDetails.displayName}** with role(s): ${formattedRoles.join(', ')}`,
      },
    }
  } catch (error: any) {
    console.error('addMember error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to add member',
    }
  }
}

/**
 * Update member roles (requires can_update_roles permission + CIBA verification)
 * Accepts either email or user ID
 */
export async function updateMemberRoles(
  context: AgentContext,
  userIdentifier: string,
  roles?: string[],
  cibaVerified: boolean = false
): Promise<ToolResult> {
  try {
    // CRITICAL: Check if roles were provided
    // If not, the agent must ask the user - never reuse old roles
    // Also reject if it's explicitly undefined (agent should not call this function at all)
    if (roles === undefined || roles === null || roles.length === 0) {
      return {
        success: false,
        error: 'AGENT_ERROR: Roles not provided. You must ask the user which roles to assign using the standard role selection format. NEVER reuse roles from previous messages. NEVER call this function if the user did not explicitly specify roles in their current message. Each update operation requires fresh, explicit role selection from the user.',
      }
    }

    // Additional check: Log a warning if we suspect the agent is using default/inferred roles
    console.log(`⚠️ updateMemberRoles called with roles:`, roles)
    console.log(`⚠️ If user did NOT explicitly specify these roles, this is a bug!`)

    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get user details for display
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Check FGA permission (only if not already verified via CIBA)
    if (!cibaVerified) {
      const hasPermission = await checkPermission(
        context.userId,
        context.organizationId,
        'can_update_roles'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to update member roles',
        }
      }

      // Require CIBA verification for this sensitive operation
      return {
        success: false,
        requiresCIBA: true,
        cibaOperation: 'update_member_roles',
        data: {
          userId,
          roles,
          userEmail: userInfo?.email,
        },
      }
    }

    // Validate role names (only FGA roles allowed)
    const validRoles = roles.filter(role => AVAILABLE_ROLES.includes(role as FGARole))
    if (validRoles.length !== roles.length) {
      const invalidRoles = roles.filter(role => !AVAILABLE_ROLES.includes(role as FGARole))
      return {
        success: false,
        error: `Invalid role(s): ${invalidRoles.join(', ')}. Valid roles are: ${AVAILABLE_ROLES.join(', ')}`,
      }
    }

    const roleNames = validRoles as FGARole[]

    // Get current FGA roles for the user
    const currentRoles = await getUserFGARoles(userId, context.organizationId)
    console.log('=== UPDATE MEMBER ROLES DEBUG ===')
    console.log(`User ID: ${userId}`)
    console.log(`Organization ID: ${context.organizationId}`)
    console.log(`Current FGA roles:`, currentRoles)
    console.log(`New roles requested:`, roleNames)

    // Calculate roles to add and remove
    const rolesToAdd = roleNames.filter(role => !currentRoles.includes(role))
    const rolesToRemove = currentRoles.filter(role => !roleNames.includes(role))

    console.log(`Roles to add:`, rolesToAdd)
    console.log(`Roles to remove:`, rolesToRemove)

    // Update FGA tuples - this replaces all existing roles with the new set
    console.log(`Calling updateUserRoles...`)
    const updateSuccess = await updateUserRoles(
      userId,
      context.organizationId,
      rolesToAdd,
      rolesToRemove
    )

    console.log(`updateUserRoles returned: ${updateSuccess}`)

    if (!updateSuccess) {
      return {
        success: false,
        error: 'Failed to update FGA roles',
      }
    }

    // Verify the update by reading roles again
    const verifyRoles = await getUserFGARoles(userId, context.organizationId)
    console.log(`Roles after update (verification):`, verifyRoles)
    console.log('=== END DEBUG ===')

    // Check if verification matches expected roles
    const rolesMismatch = !roleNames.every(r => verifyRoles.includes(r)) || !verifyRoles.every(r => roleNames.includes(r))
    if (rolesMismatch) {
      console.error('⚠️ ROLES MISMATCH AFTER UPDATE!')
      console.error(`Expected: ${roleNames.join(', ')}`)
      console.error(`Actual: ${verifyRoles.join(', ')}`)
    }

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Format roles for display
    const formattedNewRoles = roleNames.map(formatRoleDisplay)
    const formattedAddedRoles = rolesToAdd.map(formatRoleDisplay)
    const formattedRemovedRoles = rolesToRemove.map(formatRoleDisplay)

    let changesSummary = ''
    if (rolesToAdd.length > 0) {
      changesSummary += `\n  • Added: ${formattedAddedRoles.join(', ')}`
    }
    if (rolesToRemove.length > 0) {
      changesSummary += `\n  • Removed: ${formattedRemovedRoles.join(', ')}`
    }

    return {
      success: true,
      data: {
        userName: userInfo?.name || userInfo?.email,
        userEmail: userInfo?.email,
        userId: userId,
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        newRoles: roleNames,
        formattedNewRoles: formattedNewRoles,
        rolesAdded: rolesToAdd,
        rolesRemoved: rolesToRemove,
        message: `✅ Roles updated for **${userInfo?.name || userInfo?.email}** in **${orgDetails.displayName}**.\n\nNew roles: ${formattedNewRoles.join(', ')}${changesSummary}`,
      },
    }
  } catch (error: any) {
    console.error('updateMemberRoles error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to update member roles',
    }
  }
}

/**
 * Remove member from organization (requires can_remove_member permission + CIBA)
 * Accepts either email or user ID
 */
export async function removeMember(
  context: AgentContext,
  userIdentifier: string,
  cibaVerified: boolean = false
): Promise<ToolResult> {
  try {
    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get user details for display
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Check FGA permission (only if not already verified via CIBA)
    // Once CIBA is approved, we know permission was already checked
    if (!cibaVerified) {
      const hasPermission = await checkPermission(
        context.userId,
        context.organizationId,
        'can_remove_member'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to remove members',
        }
      }

      // Require CIBA verification
      return {
        success: false,
        requiresCIBA: true,
        cibaOperation: 'remove_member',
        data: {
          userId,
          userEmail: userInfo?.email,
        },
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Remove member via Management API
    await axios.delete(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          'Content-Type': 'application/json',
        },
        data: {
          members: [userId],
        },
      }
    )

    // IMPORTANT: Also delete ALL FGA tuples for this user in this organization
    await removeAllUserRoles(userId, context.organizationId)

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    return {
      success: true,
      data: {
        userName: userInfo?.name || userInfo?.email,
        userEmail: userInfo?.email,
        userId: userId,
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        message: `✅ **${userInfo?.name || userInfo?.email}** removed from **${orgDetails.displayName}** (Auth0 + FGA tuples deleted)`,
      },
    }
  } catch (error: any) {
    console.error('removeMember error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to remove member',
    }
  }
}

/**
 * Delete user completely (requires can_delete permission + CIBA)
 * Accepts either email or user ID
 */
export async function deleteMember(
  context: AgentContext,
  userIdentifier: string,
  cibaVerified: boolean = false
): Promise<ToolResult> {
  try {
    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get user details for display
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Check FGA permission (only if not already verified via CIBA)
    if (!cibaVerified) {
      const hasPermission = await checkPermission(
        context.userId,
        context.organizationId,
        'can_delete'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to delete members (requires super_admin)',
        }
      }

      // Require CIBA verification
      return {
        success: false,
        requiresCIBA: true,
        cibaOperation: 'delete_member',
        data: {
          userId,
          userEmail: userInfo?.email,
        },
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Delete user via Management API
    await axios.delete(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    // IMPORTANT: Clean up ALL FGA tuples for this user across ALL organizations
    // Note: When a user is deleted from Auth0 entirely, we should remove their FGA tuples
    // in the current organization context. If they're in multiple orgs, those orgs should
    // handle cleanup separately.
    await removeAllUserRoles(userId, context.organizationId)

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    return {
      success: true,
      data: {
        userName: userInfo?.name || userInfo?.email,
        userEmail: userInfo?.email,
        userId: userId,
        organizationName: orgDetails.displayName,
        message: `✅ User **${userInfo?.name || userInfo?.email}** (\`${userId}\`) deleted permanently from Auth0`,
      },
    }
  } catch (error: any) {
    console.error('deleteMember error:', error)
    return {
      success: false,
      error: error.response?.data?.message || 'Failed to delete member',
    }
  }
}

/**
 * Reset member MFA (requires can_reset_mfa permission + CIBA)
 * Accepts either email or user ID
 */
export async function resetMemberMFA(
  context: AgentContext,
  userIdentifier: string,
  cibaVerified: boolean = false
): Promise<ToolResult> {
  try {
    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get user details for display
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Check FGA permission (only if not already verified via CIBA)
    if (!cibaVerified) {
      const hasPermission = await checkPermission(
        context.userId,
        context.organizationId,
        'can_reset_mfa'
      )

      if (!hasPermission) {
        return {
          success: false,
          error: 'You do not have permission to reset MFA',
        }
      }

      // Require CIBA verification
      return {
        success: false,
        requiresCIBA: true,
        cibaOperation: 'reset_mfa',
        data: {
          userId,
          userEmail: userInfo?.email,
        },
      }
    }

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Use the correct authentication-methods endpoint
    // Get all authentication methods for the user
    const authMethodsResponse = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(userId)}/authentication-methods`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const authMethods = authMethodsResponse.data || []

    // If no authentication methods found, return error
    if (authMethods.length === 0) {
      return {
        success: false,
        error: `No MFA enrollments found for ${userInfo?.email || userIdentifier}. The user has not enabled MFA yet.`,
      }
    }

    // Delete each authentication method individually
    let deletedCount = 0
    for (const method of authMethods) {
      try {
        await axios.delete(
          `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(userId)}/authentication-methods/${method.id}`,
          {
            headers: {
              Authorization: `Bearer ${mgmtToken}`,
            },
          }
        )
        deletedCount++
      } catch (err: any) {
        console.error(`Failed to delete authentication method ${method.id}:`, err.message)
      }
    }

    // If nothing was deleted, return error
    if (deletedCount === 0) {
      return {
        success: false,
        error: `Failed to reset MFA for ${userInfo?.email || userIdentifier}. Could not delete authentication methods.`,
      }
    }

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    // Send enrollment invitation
    let enrollmentTicket = null
    try {
      const ticketResponse = await axios.post(
        `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/guardian/enrollments/ticket`,
        {
          user_id: userId,
          email: userInfo?.email,
          send_mail: true, // Automatically send email to user
        },
        {
          headers: {
            Authorization: `Bearer ${mgmtToken}`,
            'Content-Type': 'application/json',
          },
        }
      )
      enrollmentTicket = ticketResponse.data
      console.log('✉️ MFA enrollment invitation sent to:', userInfo?.email)
    } catch (enrollmentError: any) {
      console.error('Failed to send enrollment invitation:', enrollmentError.response?.data || enrollmentError.message)
      // Don't fail the whole operation if invitation fails
    }

    return {
      success: true,
      data: {
        userName: userInfo?.name || userInfo?.email,
        userEmail: userInfo?.email,
        userId: userId,
        organizationName: orgDetails.displayName,
        methodsDeleted: deletedCount,
        totalMethods: authMethods.length,
        enrollmentTicketSent: !!enrollmentTicket,
        message: enrollmentTicket
          ? `✅ MFA reset successful for **${userInfo?.name || userInfo?.email}** in **${orgDetails.displayName}**. Removed ${deletedCount} of ${authMethods.length} authentication method(s). An enrollment invitation has been sent to **${userInfo?.email}**.`
          : `✅ MFA reset successful for **${userInfo?.name || userInfo?.email}** in **${orgDetails.displayName}**. Removed ${deletedCount} of ${authMethods.length} authentication method(s).`,
      },
    }
  } catch (error: any) {
    console.error('resetMemberMFA error:', error)

    // Handle 404 error specifically - usually means no MFA enrolled
    if (error.response?.status === 404) {
      return {
        success: false,
        error: `No MFA enrollments found for ${userIdentifier}. The user may not have MFA enabled yet.`,
      }
    }

    return {
      success: false,
      error: error.response?.data?.message || 'Failed to reset MFA',
    }
  }
}

/**
 * Check MFA enrollment status for a member
 * Returns details about what authentication methods they have enrolled
 */
export async function checkMemberMFA(
  context: AgentContext,
  userIdentifier: string
): Promise<ToolResult> {
  try {
    // Check FGA permission
    const hasPermission = await checkPermission(
      context.userId,
      context.organizationId,
      'can_view'
    )

    if (!hasPermission) {
      return {
        success: false,
        error: 'You do not have permission to view member information',
      }
    }

    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: createUserNotFoundError(userIdentifier),
      }
    }

    // Get user details for display
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Get all authentication methods for the user
    const authMethodsResponse = await axios.get(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(userId)}/authentication-methods`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    const authMethods = authMethodsResponse.data || []

    // Parse authentication methods into readable format
    const methodDetails = authMethods.map((method: any) => {
      const type = method.type || 'unknown'
      const typeLabels: Record<string, string> = {
        'phone': '📱 SMS',
        'totp': '🔐 Authenticator App (TOTP)',
        'push-notification': '📲 Push Notification (Guardian)',
        'email': '📧 Email OTP',
        'recovery-code': '🔑 Recovery Code',
        'webauthn-roaming': '🔒 Security Key (WebAuthn)',
        'webauthn-platform': '🔒 Platform Authenticator (WebAuthn)',
      }

      return {
        id: method.id,
        type: type,
        label: typeLabels[type] || `❓ ${type}`,
        name: method.name || 'Unnamed',
        confirmed: method.confirmed || false,
        createdAt: method.created_at,
      }
    })

    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    const isEnrolled = authMethods.length > 0
    const methodLabels = methodDetails.map(m => m.label).join(', ')

    return {
      success: true,
      data: {
        userName: userInfo?.name || userInfo?.email,
        userEmail: userInfo?.email,
        userId: userId,
        organizationName: orgDetails.displayName,
        isEnrolled: isEnrolled,
        methodCount: authMethods.length,
        methods: methodDetails,
        message: isEnrolled
          ? `🔐 **${userInfo?.name || userInfo?.email}** has MFA enrolled in **${orgDetails.displayName}**\n\nEnrolled methods (${authMethods.length}):\n${methodDetails.map(m => `• ${m.label}${m.confirmed ? ' ✓' : ' (unconfirmed)'}`).join('\n')}`
          : `❌ **${userInfo?.name || userInfo?.email}** does not have MFA enrolled in **${orgDetails.displayName}**`,
      },
    }
  } catch (error: any) {
    console.error('checkMemberMFA error:', error)

    // Handle 404 error specifically - usually means no MFA enrolled
    if (error.response?.status === 404) {
      const userInfo = await resolveUserIdentifier(userIdentifier)
      const orgDetails = await getOrganizationDetails(context.organizationId)

      return {
        success: true,
        data: {
          userName: userInfo?.name || userInfo?.email,
          userEmail: userInfo?.email,
          organizationName: orgDetails.displayName,
          isEnrolled: false,
          methodCount: 0,
          methods: [],
          message: `❌ **${userInfo?.name || userInfo?.email}** does not have MFA enrolled in **${orgDetails.displayName}**`,
        },
      }
    }

    return {
      success: false,
      error: error.response?.data?.message || 'Failed to check MFA status',
    }
  }
}

/**
 * Check user's permissions (informational)
 */
export async function checkUserPermissions(
  context: AgentContext
): Promise<ToolResult> {
  try {
    // Get org details for response
    const orgDetails = await getOrganizationDetails(context.organizationId)

    const permissions: FGAPermission[] = [
      'can_view',
      'can_reset_mfa',
      'can_invite',
      'can_add_member',
      'can_update_roles',
      'can_remove_member',
      'can_delete',
    ]

    const results: Record<string, boolean> = {}

    for (const permission of permissions) {
      results[permission] = await checkPermission(
        context.userId,
        context.organizationId,
        permission
      )
    }

    // Format permission names for display
    const permissionLabels: Record<string, string> = {
      'can_view': 'View Members',
      'can_reset_mfa': 'Reset MFA',
      'can_invite': 'Invite Members',
      'can_add_member': 'Add Members',
      'can_update_roles': 'Update Roles',
      'can_remove_member': 'Remove Members',
      'can_delete': 'Delete Users',
    }

    return {
      success: true,
      data: {
        organizationName: orgDetails.displayName,
        organizationId: context.organizationId,
        permissions: results,
        permissionLabels: permissionLabels,
      },
    }
  } catch (error: any) {
    console.error('checkUserPermissions error:', error)
    return {
      success: false,
      error: 'Failed to check permissions',
    }
  }
}

/**
 * Tool definitions for OpenAI function calling
 */
export const agentTools = [
  {
    type: 'function',
    function: {
      name: 'get_my_info',
      description:
        'Get comprehensive profile information about the current authenticated user. Returns: name, email (with verification status), user ID, nickname, roles in organization, login statistics, and account creation date. Use this when user asks "who am I", "my profile", "my info", etc. Format the response as a clean profile card with sections.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_member_info',
      description:
        'Get comprehensive profile information about a specific organization member. Returns the same detailed information as get_my_info but for any member: name, email (with verification status), user ID, nickname, roles in organization, login statistics, and account creation date. Use this when user asks about another member like "tell me about member1@atko.email", "who is john@example.com", "show me info for user auth0|123", etc. Format the response as a clean profile card with sections. Requires can_view permission. ACCEPTS EMAIL OR USER ID.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., john@example.com, auth0archer@gmail.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved to user IDs.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_members',
      description:
        'List all members in the organization. Requires can_view permission.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'invite_member',
      description:
        'INVITE a NEW user by email (for users who don\'t have an Auth0 account yet). Sends an email invitation. Requires can_invite permission. For EXISTING users, use add_member instead.',
      parameters: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the person to invite',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of FGA role names (e.g., ["admin", "support"]). Valid roles: super_admin, admin, support, member. These are FGA relationship names, NOT Auth0 role IDs.',
          },
        },
        required: ['email'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_member',
      description:
        'ADD an EXISTING Auth0 user to the organization (for users who already have an account). ACCEPTS EMAIL OR USER ID. Supports MULTIPLE roles per user. Requires can_add_member permission. Adds member to Auth0 org and writes FGA tuples. For NEW users, use invite_member instead. If user does not specify which roles to assign, ASK THEM using the standard role selection format before calling this tool.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., john@example.com, auth0archer@gmail.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved.',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of FGA role names. Can contain MULTIPLE roles (e.g., ["admin", "support"] assigns BOTH admin and support roles). Valid roles: super_admin, admin, support, member. These are FGA relationship names, NOT Auth0 role IDs.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_member_roles',
      description:
        'Update FGA roles for an organization member. ACCEPTS EMAIL OR USER ID. Supports MULTIPLE roles per user. Requires can_update_roles permission and CIBA verification (automatic). The roles array completely REPLACES the user\'s current roles (adds new ones, removes old ones). **CRITICAL - DO NOT CALL THIS FUNCTION UNLESS**: The user has EXPLICITLY specified role(s) IN THEIR CURRENT MESSAGE (e.g., "update to admin", "change roles to admin, support"). If the user did NOT specify roles (e.g., "update roles for X", "change X\'s roles"), you MUST respond with a question asking which roles to assign - DO NOT call this function. NEVER infer, guess, or reuse roles from conversation history. NEVER use current roles as default. If unsure whether roles were specified, ASK instead of calling this function.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., john@example.com, auth0archer@gmail.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved.',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Complete new array of FGA role names. Can contain MULTIPLE roles (e.g., ["admin", "support"] for both admin AND support roles). These REPLACE existing roles completely. Valid roles: super_admin, admin, support, member. CRITICAL: Must come from the CURRENT user message only - NEVER reuse roles from earlier in the conversation history. If not provided in current message, DO NOT call this tool - ask user first.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_member',
      description:
        'Remove a member from the organization. ACCEPTS EMAIL OR USER ID. Requires can_remove_member permission and CIBA verification (automatic).',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., auth0archer@gmail.com, john@example.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_member',
      description:
        'Permanently delete a user from Auth0 completely. ACCEPTS EMAIL OR USER ID. Requires can_delete permission (super_admin only) and CIBA verification (automatic).',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., auth0archer@gmail.com, john@example.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_member_mfa',
      description:
        'Check if a member has MFA enrolled and see what authentication methods they have enabled. ACCEPTS EMAIL OR USER ID. Returns enrollment status and detailed list of enrolled methods (Guardian Push, TOTP, SMS, etc.). Requires can_view permission. Use this when user asks "does X have MFA", "check MFA for X", "is X enrolled in MFA", "what MFA methods does X have", etc.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., auth0archer@gmail.com, john@example.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reset_member_mfa',
      description:
        'Reset all MFA enrollments for a member and automatically send a re-enrollment invitation email. ACCEPTS EMAIL OR USER ID. Requires can_reset_mfa permission and CIBA verification (automatic). After removing all authentication methods, an enrollment invitation is automatically sent to the user\'s email.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User identifier - can be EITHER an email address (e.g., auth0archer@gmail.com, john@example.com) OR an Auth0 user ID (e.g., auth0|123...). Email addresses are automatically resolved.',
          },
        },
        required: ['userId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_available_roles',
      description:
        'List all available FGA roles in the organization with their descriptions and permissions. Use this when user asks "what roles exist", "show me roles", "what are the available roles", etc.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_my_permissions',
      description:
        'Check what permissions the current user has in the organization.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
]

/**
 * Execute a tool function
 */
export async function executeTool(
  toolName: string,
  args: any,
  context: AgentContext,
  cibaVerified: boolean = false
): Promise<ToolResult> {
  switch (toolName) {
    case 'get_my_info':
      return getMyInfo(context)

    case 'get_member_info':
      return getMemberInfo(context, args.userId)

    case 'list_members':
      return listMembers(context)

    case 'list_available_roles':
      return listAvailableRoles(context)

    case 'invite_member':
      return inviteMember(context, args.email, args.roles || [])

    case 'add_member':
      return addMember(context, args.userId, args.roles || [])

    case 'update_member_roles':
      return updateMemberRoles(
        context,
        args.userId,
        args.roles,
        cibaVerified
      )

    case 'remove_member':
      return removeMember(context, args.userId, cibaVerified)

    case 'delete_member':
      return deleteMember(context, args.userId, cibaVerified)

    case 'check_member_mfa':
      return checkMemberMFA(context, args.userId)

    case 'reset_member_mfa':
      return resetMemberMFA(context, args.userId, cibaVerified)

    case 'check_my_permissions':
      return checkUserPermissions(context)

    default:
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      }
  }
}
