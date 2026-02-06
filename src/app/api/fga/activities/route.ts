import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { fgaActivityLogger } from '@/lib/fga/activity-logger'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activities = fgaActivityLogger.getActivities()

    return NextResponse.json({
      success: true,
      activities,
    })
  } catch (error) {
    console.error('FGA activities error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    fgaActivityLogger.clear()

    return NextResponse.json({
      success: true,
      message: 'Activities cleared',
    })
  } catch (error) {
    console.error('FGA clear activities error:', error)
    return NextResponse.json(
      { error: 'Failed to clear activities' },
      { status: 500 }
    )
  }
}
