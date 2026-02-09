import { getFGAClient, formatFGAUser, formatFGAOrganization } from './client'
import { fgaActivityLogger } from './activity-logger'
import type { FGARelation } from '@/types/fga'

/**
 * Write a relationship tuple to FGA
 */
export async function writeRelationship(
  userId: string,
  organizationId: string,
  relation: FGARelation
): Promise<boolean> {
  const formattedUser = formatFGAUser(userId)
  const formattedObject = formatFGAOrganization(organizationId)

  try {
    const client = getFGAClient()

    await client.write({
      writes: [
        {
          user: formattedUser,
          relation,
          object: formattedObject,
        },
      ],
    })

    // Log the write operation
    fgaActivityLogger.logWrite(formattedUser, relation, formattedObject)

    return true
  } catch (error) {
    console.error('FGA write error:', error)

    // Log the error
    fgaActivityLogger.logError(
      'write',
      formattedUser,
      relation,
      formattedObject,
      error instanceof Error ? error.message : 'Unknown error'
    )

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
  const formattedUser = formatFGAUser(userId)
  const formattedObject = formatFGAOrganization(organizationId)

  try {
    const client = getFGAClient()

    await client.write({
      deletes: [
        {
          user: formattedUser,
          relation,
          object: formattedObject,
        },
      ],
    })

    // Log the delete operation
    fgaActivityLogger.logDelete(formattedUser, relation, formattedObject)

    return true
  } catch (error) {
    console.error('FGA delete error:', error)

    // Log the error
    fgaActivityLogger.logError(
      'delete',
      formattedUser,
      relation,
      formattedObject,
      error instanceof Error ? error.message : 'Unknown error'
    )

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
 * Only deletes tuples that actually exist to avoid FGA errors
 */
export async function updateUserRoles(
  userId: string,
  organizationId: string,
  rolesToAdd: Array<'super_admin' | 'admin' | 'support' | 'member'>,
  rolesToRemove: Array<'super_admin' | 'admin' | 'support' | 'member'>
): Promise<boolean> {
  try {
    const client = getFGAClient()
    const formattedUser = formatFGAUser(userId)
    const formattedObject = formatFGAOrganization(organizationId)

    const writes = rolesToAdd.map((role) => ({
      user: formattedUser,
      relation: role as FGARelation,
      object: formattedObject,
    }))

    // Only delete roles that actually exist
    let deletes: Array<{ user: string; relation: FGARelation; object: string }> = []
    if (rolesToRemove.length > 0) {
      // Read existing tuples
      const readResponse = await client.read({
        user: formattedUser,
        object: formattedObject,
      })

      const existingTuples = readResponse.tuples || []
      const existingRelations = existingTuples.map((t) => t.key.relation)

      // Only delete roles that actually exist
      deletes = rolesToRemove
        .filter((role) => existingRelations.includes(role))
        .map((role) => ({
          user: formattedUser,
          relation: role as FGARelation,
          object: formattedObject,
        }))
    }

    if (writes.length > 0 || deletes.length > 0) {
      await client.write({
        writes: writes.length > 0 ? writes : undefined,
        deletes: deletes.length > 0 ? deletes : undefined,
      })

      // Log operations
      writes.forEach((w) => {
        fgaActivityLogger.logWrite(w.user, w.relation, w.object)
      })

      deletes.forEach((d) => {
        fgaActivityLogger.logDelete(d.user, d.relation, d.object)
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
 * Only deletes tuples that actually exist
 */
export async function removeAllUserRoles(
  userId: string,
  organizationId: string
): Promise<boolean> {
  try {
    const client = getFGAClient()
    const formattedUser = formatFGAUser(userId)
    const formattedObject = formatFGAOrganization(organizationId)

    // Read existing tuples for this user and organization
    const readResponse = await client.read({
      user: formattedUser,
      object: formattedObject,
    })

    const existingTuples = readResponse.tuples || []

    // If no tuples exist, nothing to delete
    if (existingTuples.length === 0) {
      console.log(`No FGA tuples to delete for user ${userId} in org ${organizationId}`)
      return true
    }

    // Build delete array from existing tuples only
    const deletes = existingTuples.map((tuple) => ({
      user: tuple.key.user,
      relation: tuple.key.relation as FGARelation,
      object: tuple.key.object,
    }))

    // Delete only the tuples that exist
    await client.write({
      deletes,
    })

    // Log each deletion
    deletes.forEach((tuple) => {
      fgaActivityLogger.logDelete(tuple.user, tuple.relation, tuple.object)
    })

    console.log(`Deleted ${deletes.length} FGA tuple(s) for user ${userId}`)
    return true
  } catch (error) {
    console.error('FGA removeAllUserRoles error:', error)
    return false
  }
}

/**
 * Get all FGA roles for a user in an organization
 */
export async function getUserFGARoles(
  userId: string,
  organizationId: string
): Promise<FGARelation[]> {
  try {
    const client = getFGAClient()
    const formattedUser = formatFGAUser(userId)
    const formattedObject = formatFGAOrganization(organizationId)

    // Read existing tuples for this user and organization
    const readResponse = await client.read({
      user: formattedUser,
      object: formattedObject,
    })

    const existingTuples = readResponse.tuples || []

    // Extract just the relation names
    return existingTuples.map((tuple) => tuple.key.relation as FGARelation)
  } catch (error) {
    console.error('FGA getUserFGARoles error:', error)
    return []
  }
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
