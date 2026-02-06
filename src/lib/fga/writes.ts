import { getFGAClient, formatFGAUser, formatFGAOrganization } from './client'
import type { FGARelation } from '@/types/fga'

/**
 * Write a relationship tuple to FGA
 */
export async function writeRelationship(
  userId: string,
  organizationId: string,
  relation: FGARelation
): Promise<boolean> {
  try {
    const client = getFGAClient()

    await client.write({
      writes: [
        {
          user: formatFGAUser(userId),
          relation,
          object: formatFGAOrganization(organizationId),
        },
      ],
    })

    return true
  } catch (error) {
    console.error('FGA write error:', error)
    return false
  }
}

/**
 * Delete a relationship tuple from FGA
 */
export async function deleteRelationship(
  userId: string,
  organizationId: string,
  relation: FGARelation
): Promise<boolean> {
  try {
    const client = getFGAClient()

    await client.write({
      deletes: [
        {
          user: formatFGAUser(userId),
          relation,
          object: formatFGAOrganization(organizationId),
        },
      ],
    })

    return true
  } catch (error) {
    console.error('FGA delete error:', error)
    return false
  }
}

/**
 * Assign a role to a user in an organization
 */
export async function assignRole(
  userId: string,
  organizationId: string,
  role: 'super_admin' | 'admin' | 'support' | 'member'
): Promise<boolean> {
  return writeRelationship(userId, organizationId, role)
}

/**
 * Remove a role from a user in an organization
 */
export async function removeRole(
  userId: string,
  organizationId: string,
  role: 'super_admin' | 'admin' | 'support' | 'member'
): Promise<boolean> {
  return deleteRelationship(userId, organizationId, role)
}

/**
 * Update user roles - remove old roles and assign new ones
 */
export async function updateUserRoles(
  userId: string,
  organizationId: string,
  rolesToAdd: Array<'super_admin' | 'admin' | 'support' | 'member'>,
  rolesToRemove: Array<'super_admin' | 'admin' | 'support' | 'member'>
): Promise<boolean> {
  try {
    const client = getFGAClient()

    const writes = rolesToAdd.map((role) => ({
      user: formatFGAUser(userId),
      relation: role as FGARelation,
      object: formatFGAOrganization(organizationId),
    }))

    const deletes = rolesToRemove.map((role) => ({
      user: formatFGAUser(userId),
      relation: role as FGARelation,
      object: formatFGAOrganization(organizationId),
    }))

    if (writes.length > 0 || deletes.length > 0) {
      await client.write({
        writes: writes.length > 0 ? writes : undefined,
        deletes: deletes.length > 0 ? deletes : undefined,
      })
    }

    return true
  } catch (error) {
    console.error('FGA update roles error:', error)
    return false
  }
}

/**
 * Remove all roles for a user in an organization
 */
export async function removeAllUserRoles(
  userId: string,
  organizationId: string
): Promise<boolean> {
  const allRoles: Array<'super_admin' | 'admin' | 'support' | 'member'> = [
    'super_admin',
    'admin',
    'support',
    'member',
  ]

  return updateUserRoles(userId, organizationId, [], allRoles)
}

/**
 * Batch write multiple relationships
 */
export async function batchWriteRelationships(
  writes: Array<{
    userId: string
    organizationId: string
    relation: FGARelation
  }>,
  deletes?: Array<{
    userId: string
    organizationId: string
    relation: FGARelation
  }>
): Promise<boolean> {
  try {
    const client = getFGAClient()

    const writeTuples = writes.map((w) => ({
      user: formatFGAUser(w.userId),
      relation: w.relation,
      object: formatFGAOrganization(w.organizationId),
    }))

    const deleteTuples = deletes?.map((d) => ({
      user: formatFGAUser(d.userId),
      relation: d.relation,
      object: formatFGAOrganization(d.organizationId),
    }))

    await client.write({
      writes: writeTuples.length > 0 ? writeTuples : undefined,
      deletes: deleteTuples && deleteTuples.length > 0 ? deleteTuples : undefined,
    })

    return true
  } catch (error) {
    console.error('FGA batch write error:', error)
    return false
  }
}
