import axios from 'axios'

let cachedToken: { token: string; expiresAt: number } | null = null

/**
 * Get Management API access token with caching
 */
async function getManagementToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const response = await axios.post(
    `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
    {
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }
  )

  const { access_token, expires_in } = response.data

  // Cache token with 5 minute buffer
  cachedToken = {
    token: access_token,
    expiresAt: Date.now() + (expires_in - 300) * 1000,
  }

  return access_token
}

/**
 * Get all members of an organization
 */
export async function getOrganizationMembers(organizationId: string) {
  const token = await getManagementToken()

  const response = await axios.get(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        per_page: 100,
      },
    }
  )

  return response.data
}

/**
 * Get member roles in an organization
 */
export async function getMemberRoles(organizationId: string, userId: string) {
  const token = await getManagementToken()

  const response = await axios.get(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members/${userId}/roles`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return response.data
}

/**
 * Invite a user to an organization
 */
export async function inviteMember(
  organizationId: string,
  inviterName: string,
  inviteeEmail: string,
  roles?: string[]
) {
  const token = await getManagementToken()

  const response = await axios.post(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/invitations`,
    {
      inviter: {
        name: inviterName,
      },
      invitee: {
        email: inviteeEmail,
      },
      client_id: process.env.AUTH0_CLIENT_ID,
      roles: roles || [],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return response.data
}

/**
 * Add an existing user to an organization
 */
export async function addMemberToOrganization(
  organizationId: string,
  userId: string,
  roles?: string[]
) {
  const token = await getManagementToken()

  const response = await axios.post(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members`,
    {
      members: [userId],
      roles: roles || [],
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return response.data
}

/**
 * Update member roles in an organization
 */
export async function updateMemberRoles(
  organizationId: string,
  userId: string,
  rolesToAdd: string[],
  rolesToRemove: string[]
) {
  const token = await getManagementToken()

  // Remove roles
  if (rolesToRemove.length > 0) {
    await axios.delete(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members/${userId}/roles`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        data: {
          roles: rolesToRemove,
        },
      }
    )
  }

  // Add roles
  if (rolesToAdd.length > 0) {
    await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members/${userId}/roles`,
      {
        roles: rolesToAdd,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )
  }

  return { success: true }
}

/**
 * Remove a member from an organization
 */
export async function removeMemberFromOrganization(
  organizationId: string,
  userId: string
) {
  const token = await getManagementToken()

  await axios.delete(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/organizations/${organizationId}/members`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: {
        members: [userId],
      },
    }
  )

  return { success: true }
}

/**
 * Delete a user account (super_admin only)
 */
export async function deleteUser(userId: string) {
  const token = await getManagementToken()

  await axios.delete(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return { success: true }
}

/**
 * Reset user's MFA enrollments
 */
export async function resetUserMFA(userId: string) {
  const token = await getManagementToken()

  await axios.delete(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}/multifactor/actions/invalidate`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return { success: true }
}

/**
 * Get user details by ID
 */
export async function getUserById(userId: string) {
  const token = await getManagementToken()

  const response = await axios.get(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return response.data
}

/**
 * Search for users by email
 */
export async function searchUsersByEmail(email: string) {
  const token = await getManagementToken()

  const response = await axios.get(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        q: `email:"${email}"`,
        search_engine: 'v3',
      },
    }
  )

  return response.data
}

/**
 * Get organizations for a user
 */
export async function getUserOrganizations(userId: string) {
  const token = await getManagementToken()

  const response = await axios.get(
    `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${userId}/organizations`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return response.data
}
