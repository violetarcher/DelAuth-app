import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { resolveEmailToUserId, isEmail, isUserId } from '@/lib/auth0/user-resolver'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const identifier = searchParams.get('identifier')

    if (!identifier) {
      return NextResponse.json(
        { error: 'identifier parameter required' },
        { status: 400 }
      )
    }

    console.log('=== EMAIL LOOKUP TEST ===')
    console.log('Input:', identifier)
    console.log('Is Email?', isEmail(identifier))
    console.log('Is User ID?', isUserId(identifier))

    if (isEmail(identifier)) {
      console.log('Attempting email resolution...')
      const userId = await resolveEmailToUserId(identifier)
      console.log('Result:', userId)

      return NextResponse.json({
        input: identifier,
        type: 'email',
        resolved: userId !== null,
        userId: userId,
      })
    } else if (isUserId(identifier)) {
      return NextResponse.json({
        input: identifier,
        type: 'user_id',
        resolved: true,
        userId: identifier,
      })
    } else {
      return NextResponse.json({
        input: identifier,
        type: 'unknown',
        resolved: false,
        userId: null,
      })
    }
  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
