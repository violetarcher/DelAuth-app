import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@auth0/nextjs-auth0'
import { addMemberToOrganization, searchUsersByEmail, getManagementToken } from '@/lib/auth0/management'
import { canAddMember } from '@/lib/fga/checks'
import { assignRole } from '@/lib/fga/writes'
import { z } from 'zod'
import axios from 'axios'

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

    // Add member to organization (without roles first)
    await addMemberToOrganization(organizationId, user.user_id)

    // Get management token for role operations
    const mgmtToken = await getManagementToken()

    // Process roles if specified - map role names to Auth0 role IDs
    if (roles && roles.length > 0) {
      for (const roleName of roles) {
        // Find Auth0 role ID by name
        const rolesResponse = await axios.get(
          `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/roles`,
          {
            headers: {
              Authorization: `Bearer ${mgmtToken}`,
            },
            params: {
              name_filter: roleName,
            },
          }
        )

        const matchingRole = rolesResponse.data.roles?.find(
          (r: any) => r.name === roleName
        )

        if (!matchingRole) {
          console.warn(`Role not found: ${roleName}`)
          continue
        }

        // Assign role in Auth0 organization
        await axios.post(
          `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members/${user.user_id}/roles`,
          {
            roles: [matchingRole.id],
          },
          {
            headers: {
              Authorization: `Bearer ${mgmtToken}`,
              'Content-Type': 'application/json',
            },
          }
        )

        // Write FGA tuple
        await assignRole(
          user.user_id,
          organizationId,
          roleName as 'super_admin' | 'admin' | 'support' | 'member'
        )
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
