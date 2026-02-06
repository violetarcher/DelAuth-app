import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { completeCIBAFlow } from '@/lib/ciba/guardian'
import { z } from 'zod'

const cibaSchema = z.object({
  action: z.string(),
  targetUserId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.sub

    const body = await request.json()
    const { action, targetUserId } = cibaSchema.parse(body)

    // Create binding message based on action
    const bindingMessage = `Approve: ${action}${
      targetUserId ? ` for user ${targetUserId.substring(0, 8)}...` : ''
    }`

    // Complete CIBA flow
    const result = await completeCIBAFlow(userId, bindingMessage)

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'CIBA authentication approved',
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error,
        error_description: result.error_description,
      },
      { status: 403 }
    )
  } catch (error) {
    console.error('CIBA request error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process CIBA request' },
      { status: 500 }
    )
  }
}
