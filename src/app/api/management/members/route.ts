import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { getOrganizationMembers, getMemberRoles } from '@/lib/auth0/management'
import { canView } from '@/lib/fga/checks'
import { getUserFGARoles } from '@/lib/fga/writes'

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

    // Fetch both Auth0 roles and FGA roles for each member
    const membersWithRoles = await Promise.all(
      members.map(async (member: any) => {
        try {
          // Fetch Auth0 RBAC roles
          const auth0Roles = await getMemberRoles(organizationId, member.user_id)

          // Fetch FGA ReBAC roles
          const fgaRoles = await getUserFGARoles(member.user_id, organizationId)

          console.log(`👤 Roles for ${member.email}:`, {
            auth0Roles: auth0Roles.map((r: any) => r.name),
            fgaRoles: fgaRoles,
          })

          return {
            user_id: member.user_id,
            name: member.name,
            email: member.email,
            picture: member.picture,
            roles: auth0Roles.map((r: any) => r.name), // Auth0 RBAC roles
            fgaRoles: fgaRoles, // FGA ReBAC roles
          }
        } catch (error) {
          console.error(`Error fetching roles for ${member.user_id}:`, error)
          return {
            user_id: member.user_id,
            name: member.name,
            email: member.email,
            picture: member.picture,
            roles: [],
            fgaRoles: [],
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
