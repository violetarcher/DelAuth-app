import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { resetUserMFA } from '@/lib/auth0/management'
import { canResetMFA } from '@/lib/fga/checks'
import { z } from 'zod'

const resetMFASchema = z.object({
  userId: z.string(),
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
    const { userId, organizationId } = resetMFASchema.parse(body)

    // Check FGA permission
    const hasPermission = await canResetMFA(currentUserId, organizationId)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Reset MFA
    await resetUserMFA(userId)

    return NextResponse.json({
      success: true,
      message: 'MFA reset successfully',
    })
  } catch (error) {
    console.error('Error resetting MFA:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to reset MFA' },
      { status: 500 }
    )
  }
}
