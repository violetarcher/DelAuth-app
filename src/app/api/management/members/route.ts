import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { getOrganizationMembers, getMemberRoles } from '@/lib/auth0/management'
import { canView } from '@/lib/fga/checks'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.sub
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { status: 400 }
      )
    }

    // Check FGA permission
    const hasPermission = await canView(userId, organizationId)

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch members
    const members = await getOrganizationMembers(organizationId)

    // Fetch roles for each member
    const membersWithRoles = await Promise.all(
      members.map(async (member: any) => {
        try {
          const roles = await getMemberRoles(organizationId, member.user_id)
          return {
            user_id: member.user_id,
            name: member.name,
            email: member.email,
            picture: member.picture,
            roles: roles.map((r: any) => r.name),
          }
        } catch (error) {
          console.error(`Error fetching roles for ${member.user_id}:`, error)
          return {
            user_id: member.user_id,
            name: member.name,
            email: member.email,
            picture: member.picture,
            roles: [],
          }
        }
      })
    )

    return NextResponse.json({
      success: true,
      members: membersWithRoles,
    })
  } catch (error) {
    console.error('Error fetching members:', error)
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 }
    )
  }
}
