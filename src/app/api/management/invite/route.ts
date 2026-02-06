import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { inviteMember } from '@/lib/auth0/management'
import { canInvite } from '@/lib/fga/checks'
import { z } from 'zod'

const inviteSchema = z.object({
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

    const userId = session.user.sub
    const userName = session.user.name || session.user.email || 'Admin'

    const body = await request.json()
    const { email, roles, organizationId } = inviteSchema.parse(body)

    // Check FGA permission
    const hasPermission = await canInvite(userId, organizationId)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Invite member
    const invitation = await inviteMember(
      organizationId,
      userName,
      email,
      roles
    )

    return NextResponse.json({
      success: true,
      invitation,
    })
  } catch (error) {
    console.error('Error inviting member:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    )
  }
}
