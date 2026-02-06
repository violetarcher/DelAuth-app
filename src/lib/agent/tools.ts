/**
 * AI Agent Tools - User-scoped operations with FGA checks
 *
 * Each tool operates on behalf of the authenticated user, checking their
 * FGA permissions before executing actions.
 */

import axios from 'axios'
import { checkPermission } from '@/lib/fga/checks'
import { assignRole as writeFGARole } from '@/lib/fga/writes'
import { FGAPermission } from '@/types/fga'
import { normalizeToUserId, isEmail, resolveUserIdentifier } from '@/lib/auth0/user-resolver'

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
        organizationId: context.organizationId,
        roles: roles.map((r: any) => r.name),
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

    return {
      success: true,
      data: response.data,
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

    // Call Management API
    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/invitations`,
      {
        inviter: { name: context.userName || 'AI Assistant' },
        invitee: { email },
        client_id: process.env.AUTH0_CLIENT_ID,
        roles: roles,
      },
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      success: true,
      data: response.data,
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
        error: `Could not find user with identifier: ${userIdentifier}`,
      }
    }

    // Get user details for response
    const userInfo = await resolveUserIdentifier(userIdentifier)

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Call Management API
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

    // Assign roles if provided
    if (roles && roles.length > 0) {
      // Process each role - handle both role IDs and role names
      for (const role of roles) {
        let roleId: string
        let roleName: 'super_admin' | 'admin' | 'support' | 'member'

        // Check if this looks like a role ID (starts with 'rol_') or a role name
        if (role.startsWith('rol_')) {
          // It's an Auth0 role ID - fetch the name
          const roleResponse = await axios.get(
            `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/roles/${role}`,
            {
              headers: {
                Authorization: `Bearer ${mgmtToken}`,
              },
            }
          )
          roleId = role
          roleName = roleResponse.data.name as 'super_admin' | 'admin' | 'support' | 'member'
        } else {
          // It's a role name - need to find the role ID
          const rolesResponse = await axios.get(
            `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/roles`,
            {
              headers: {
                Authorization: `Bearer ${mgmtToken}`,
              },
              params: {
                name_filter: role,
              },
            }
          )

          const matchingRole = rolesResponse.data.roles?.find((r: any) => r.name === role)
          if (!matchingRole) {
            console.warn(`Role not found: ${role}`)
            continue
          }

          roleId = matchingRole.id
          roleName = role as 'super_admin' | 'admin' | 'support' | 'member'
        }

        // Assign role in Auth0 organization
        await axios.post(
          `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members/${userId}/roles`,
          {
            roles: [roleId],
          },
          {
            headers: {
              Authorization: `Bearer ${mgmtToken}`,
              'Content-Type': 'application/json',
            },
          }
        )

        // Write FGA tuple
        await writeFGARole(userId, context.organizationId, roleName)
      }
    }

    return {
      success: true,
      data: {
        ...response.data,
        userEmail: userInfo?.email,
        userId: userId,
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
  roles: string[],
  cibaVerified: boolean = false
): Promise<ToolResult> {
  try {
    // Resolve email to user ID if needed
    const userId = await normalizeToUserId(userIdentifier)
    if (!userId) {
      return {
        success: false,
        error: `Could not find user with identifier: ${userIdentifier}`,
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

    // Get M2M token for Management API
    const mgmtToken = await getManagementToken()

    // Update roles via Management API
    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${context.organizationId}/members/${userId}/roles`,
      {
        roles: roles,
      },
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return {
      success: true,
      data: {
        ...response.data,
        userEmail: userInfo?.email,
        userId: userId,
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
        error: `Could not find user with identifier: ${userIdentifier}`,
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

    return {
      success: true,
      data: {
        message: `Member ${userInfo?.email || userId} removed successfully`,
        userEmail: userInfo?.email,
        userId: userId,
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
        error: `Could not find user with identifier: ${userIdentifier}`,
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

    return {
      success: true,
      data: {
        message: `User ${userInfo?.email || userId} deleted permanently`,
        userEmail: userInfo?.email,
        userId: userId,
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
        error: `Could not find user with identifier: ${userIdentifier}`,
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

    // Reset MFA via Management API
    await axios.delete(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}/multifactor/actions/invalidate`,
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`,
        },
      }
    )

    return {
      success: true,
      data: {
        message: `MFA reset for ${userInfo?.email || userId}`,
        userEmail: userInfo?.email,
        userId: userId,
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
 * Check user's permissions (informational)
 */
export async function checkUserPermissions(
  context: AgentContext
): Promise<ToolResult> {
  try {
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

    return {
      success: true,
      data: results,
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
        'Invite a new member to the organization via email. Requires can_invite permission.',
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
            description: 'Array of role IDs to assign to the new member',
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
        'Add an existing Auth0 user to the organization. Accepts either email address or user ID. Requires can_add_member permission. This will add the member to both Auth0 organization and FGA.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User email address (e.g., user@example.com) or Auth0 user ID (e.g., auth0|123...)',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of role names to assign (e.g., "admin", "support", "member")',
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
        'Update roles for an organization member. Accepts either email address or user ID. Requires can_update_roles permission and CIBA verification.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User email address (e.g., user@example.com) or Auth0 user ID (e.g., auth0|123...)',
          },
          roles: {
            type: 'array',
            items: { type: 'string' },
            description: 'New array of role IDs',
          },
        },
        required: ['userId', 'roles'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_member',
      description:
        'Remove a member from the organization. Accepts either email address or user ID. Requires can_remove_member permission and CIBA verification.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User email address (e.g., user@example.com) or Auth0 user ID (e.g., auth0|123...) of the member to remove',
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
        'Permanently delete a user from Auth0. Accepts either email address or user ID. Requires can_delete permission (super_admin only) and CIBA verification.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User email address (e.g., user@example.com) or Auth0 user ID (e.g., auth0|123...) to delete',
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
        'Reset MFA for a member. Accepts either email address or user ID. Requires can_reset_mfa permission and CIBA verification.',
      parameters: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User email address (e.g., user@example.com) or Auth0 user ID (e.g., auth0|123...) of the member',
          },
        },
        required: ['userId'],
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

    case 'list_members':
      return listMembers(context)

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
