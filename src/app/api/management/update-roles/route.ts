import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { updateMemberRoles } from '@/lib/auth0/management'
import { canUpdateRoles } from '@/lib/fga/checks'
import { updateUserRoles } from '@/lib/fga/writes'
import { z } from 'zod'

const updateRolesSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  rolesToAdd: z.array(z.string()),
  rolesToRemove: z.array(z.string()),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = session.user.sub

    const body = await request.json()
    const { userId, organizationId, rolesToAdd, rolesToRemove } =
      updateRolesSchema.parse(body)

    // Check FGA permission
    const hasPermission = await canUpdateRoles(currentUserId, organizationId)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Update roles in Auth0
    await updateMemberRoles(organizationId, userId, rolesToAdd, rolesToRemove)

    // Update roles in FGA
    await updateUserRoles(
      userId,
      organizationId,
      rolesToAdd as any,
      rolesToRemove as any
    )

    return NextResponse.json({
      success: true,
      message: 'Roles updated successfully',
    })
  } catch (error) {
    console.error('Error updating roles:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update roles' },
      { status: 500 }
    )
  }
}
