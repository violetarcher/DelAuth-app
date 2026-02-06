import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { checkPermission, getUserPermissions } from '@/lib/fga/checks'
import { z } from 'zod'

const checkSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
  relation: z.string(),
})

const batchCheckSchema = z.object({
  userId: z.string(),
  organizationId: z.string(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Check if it's a batch check request (no relation specified)
    if (!body.relation) {
      const { userId, organizationId } = batchCheckSchema.parse(body)
      const permissions = await getUserPermissions(userId, organizationId)

      return NextResponse.json({
        success: true,
        permissions,
      })
    }

    // Single permission check
    const { userId, organizationId, relation } = checkSchema.parse(body)

    const allowed = await checkPermission(userId, organizationId, relation as any)

    return NextResponse.json({
      success: true,
      allowed,
    })
  } catch (error) {
    console.error('FGA check error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to check permission' },
      { status: 500 }
    )
  }
}
