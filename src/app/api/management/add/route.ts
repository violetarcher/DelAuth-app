import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { addMemberToOrganization, searchUsersByEmail } from '@/lib/auth0/management'
import { canAddMember } from '@/lib/fga/checks'
import { assignRole } from '@/lib/fga/writes'
import { z } from 'zod'

const addMemberSchema = z.object({
  email: z.string().email(),
  roles: z.array(z.string()).optional(),
  organizationId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUserId = session.user.sub

    const body = await request.json()
    const { email, roles, organizationId } = addMemberSchema.parse(body)

    // Check FGA permission
    const hasPermission = await canAddMember(currentUserId, organizationId)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Search for user by email
    const users = await searchUsersByEmail(email)

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'User not found with that email' },
        { status: 404 }
      )
    }

    const user = users[0]

    // Add member to organization
    await addMemberToOrganization(organizationId, user.user_id, roles)

    // Add roles to FGA if specified
    if (roles && roles.length > 0) {
      for (const role of roles) {
        await assignRole(user.user_id, organizationId, role as any)
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
    })
  } catch (error) {
    console.error('Error adding member:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to add member' },
      { status: 500 }
    )
  }
}
