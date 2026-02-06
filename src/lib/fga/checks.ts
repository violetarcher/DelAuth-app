import { getFGAClient, formatFGAUser, formatFGAOrganization } from './client'
import { fgaActivityLogger } from './activity-logger'
import type { FGARelation, FGACheckRequest, FGABatchCheckRequest } from '@/types/fga'

/**
 * Check if a user has a specific permission for an organization
 */
export async function checkPermission(
  userId: string,
  organizationId: string,
  relation: FGARelation
): Promise<boolean> {
  const formattedUser = formatFGAUser(userId)
  const formattedObject = formatFGAOrganization(organizationId)

  try {
    const client = getFGAClient()

    const { allowed } = await client.check({
      user: formattedUser,
      relation,
      object: formattedObject,
    })

    // Log the check operation
    fgaActivityLogger.logCheck(formattedUser, relation, formattedObject, allowed || false)

    return allowed || false
  } catch (error) {
    console.error('FGA check error:', error)

    // Log the error
    fgaActivityLogger.logError(
      'check',
      formattedUser,
      relation,
      formattedObject,
      error instanceof Error ? error.message : 'Unknown error'
    )

    return false
  }
}

/**
 * Check multiple permissions at once
 */
export async function checkPermissions(
  userId: string,
  organizationId: string,
  relations: FGARelation[]
): Promise<Record<FGARelation, boolean>> {
  const results: Record<string, boolean> = {}

  await Promise.all(
    relations.map(async (relation) => {
      results[relation] = await checkPermission(userId, organizationId, relation)
    })
  )

  return results as Record<FGARelation, boolean>
}

/**
 * Check if user can view members
 */
export async function canView(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_view')
}

/**
 * Check if user can reset MFA
 */
export async function canResetMFA(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_reset_mfa')
}

/**
 * Check if user can invite members
 */
export async function canInvite(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_invite')
}

/**
 * Check if user can add members
 */
export async function canAddMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_add_member')
}

/**
 * Check if user can update roles
 */
export async function canUpdateRoles(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_update_roles')
}

/**
 * Check if user can remove members
 */
export async function canRemoveMember(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_remove_member')
}

/**
 * Check if user can delete members
 */
export async function canDelete(
  userId: string,
  organizationId: string
): Promise<boolean> {
  return checkPermission(userId, organizationId, 'can_delete')
}

/**
 * Get all permissions for a user in an organization
 */
export async function getUserPermissions(
  userId: string,
  organizationId: string
) {
  const allRelations: FGARelation[] = [
    'can_view',
    'can_reset_mfa',
    'can_invite',
    'can_add_member',
    'can_update_roles',
    'can_remove_member',
    'can_delete',
  ]

  const permissions = await checkPermissions(userId, organizationId, allRelations)

  return {
    canView: permissions.can_view,
    canResetMFA: permissions.can_reset_mfa,
    canInvite: permissions.can_invite,
    canAddMember: permissions.can_add_member,
    canUpdateRoles: permissions.can_update_roles,
    canRemoveMember: permissions.can_remove_member,
    canDelete: permissions.can_delete,
  }
}

/**
 * Get user's role in organization
 * Checks role hierarchy: super_admin > admin > support > member
 */
export async function getUserRole(
  userId: string,
  organizationId: string
): Promise<'super_admin' | 'admin' | 'support' | 'member' | null> {
  const roles: Array<'super_admin' | 'admin' | 'support' | 'member'> = [
    'super_admin',
    'admin',
    'support',
    'member',
  ]

  for (const role of roles) {
    const hasRole = await checkPermission(userId, organizationId, role)
    if (hasRole) {
      return role
    }
  }

  return null
}
