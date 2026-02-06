import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import {
  removeMemberFromOrganization,
  deleteUser,
} from '@/lib/auth0/management'
import { canRemoveMember, canDelete } from '@/lib/fga/checks'
import { removeAllUserRoles } from '@/lib/fga/writes'
import { z } from 'zod'

const removeSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  deleteUser: z.boolean().optional(),
})

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = session.user.sub

    const body = await request.json()
    const { userId, organizationId, deleteUser: shouldDeleteUser } =
      removeSchema.parse(body)

    if (shouldDeleteUser) {
      // Check FGA permission for delete
      const hasDeletePermission = await canDelete(currentUserId, organizationId)

      if (!hasDeletePermission) {
        return NextResponse.json(
          { error: 'Insufficient permissions to delete user' },
          { status: 403 }
        )
      }

      // Delete user entirely
      await deleteUser(userId)

      // Remove all FGA tuples for this user
      await removeAllUserRoles(userId, organizationId)

      return NextResponse.json({
        success: true,
        message: 'User deleted successfully',
      })
    } else {
      // Check FGA permission for remove
      const hasRemovePermission = await canRemoveMember(
        currentUserId,
        organizationId
      )

      if (!hasRemovePermission) {
        return NextResponse.json(
          { error: 'Insufficient permissions to remove member' },
          { status: 403 }
        )
      }

      // Remove member from organization
      await removeMemberFromOrganization(organizationId, userId)

      // Remove FGA roles
      await removeAllUserRoles(userId, organizationId)

      return NextResponse.json({
        success: true,
        message: 'Member removed from organization',
      })
    }
  } catch (error) {
    console.error('Error removing/deleting member:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to remove/delete member' },
      { status: 500 }
    )
  }
}
