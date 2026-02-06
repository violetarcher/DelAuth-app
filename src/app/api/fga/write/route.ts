import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import {
  writeRelationship,
  deleteRelationship,
  updateUserRoles,
} from '@/lib/fga/writes'
import { canUpdateRoles } from '@/lib/fga/checks'
import { z } from 'zod'

const writeSchema = z.object({
  action: z.enum(['write', 'delete', 'update']),
  userId: z.string(),
  organizationId: z.string(),
  relation: z.string().optional(),
  rolesToAdd: z.array(z.string()).optional(),
  rolesToRemove: z.array(z.string()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = session.user.sub
    const body = await request.json()
    const { action, userId, organizationId, relation, rolesToAdd, rolesToRemove } =
      writeSchema.parse(body)

    // Check if current user has permission to update roles
    const hasPermission = await canUpdateRoles(currentUserId, organizationId)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    let success = false

    switch (action) {
      case 'write':
        if (!relation) {
          return NextResponse.json(
            { error: 'relation is required for write action' },
            { status: 400 }
          )
        }
        success = await writeRelationship(userId, organizationId, relation as any)
        break

      case 'delete':
        if (!relation) {
          return NextResponse.json(
            { error: 'relation is required for delete action' },
            { status: 400 }
          )
        }
        success = await deleteRelationship(userId, organizationId, relation as any)
        break

      case 'update':
        if (!rolesToAdd && !rolesToRemove) {
          return NextResponse.json(
            { error: 'rolesToAdd or rolesToRemove required for update action' },
            { status: 400 }
          )
        }
        success = await updateUserRoles(
          userId,
          organizationId,
          (rolesToAdd || []) as any,
          (rolesToRemove || []) as any
        )
        break
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to write FGA relationship' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'FGA relationship updated successfully',
    })
  } catch (error) {
    console.error('FGA write error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to write FGA relationship' },
      { status: 500 }
    )
  }
}
