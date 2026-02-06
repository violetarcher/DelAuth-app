import { getSession } from '@auth0/nextjs-auth0'

/**
 * Get the current organization ID from the session
 * Assumes the org_id is in the access token or user metadata
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  const session = await getSession()

  if (!session?.user) {
    return null
  }

  // Try to get org_id from user object
  // Auth0 typically includes this in the token claims
  const orgId = session.user.org_id || session.user['https://auth0.com/org_id']

  return orgId || null
}

/**
 * Get user's roles in the current organization
 */
export async function getUserRoles(): Promise<string[]> {
  const session = await getSession()

  if (!session?.user) {
    return []
  }

  // Roles might be in different claim formats
  const roles =
    session.user.roles ||
    session.user['https://auth0.com/roles'] ||
    session.user['https://auth0.com/org_roles'] ||
    []

  return Array.isArray(roles) ? roles : []
}

/**
 * Check if user has a specific role
 */
export async function hasRole(role: string): Promise<boolean> {
  const roles = await getUserRoles()
  return roles.includes(role)
}

/**
 * Check if user is super admin
 */
export async function isSuperAdmin(): Promise<boolean> {
  return hasRole('super_admin')
}

/**
 * Check if user is admin or super admin
 */
export async function isAdmin(): Promise<boolean> {
  const roles = await getUserRoles()
  return roles.includes('admin') || roles.includes('super_admin')
}

/**
 * Check if user has support role
 */
export async function isSupport(): Promise<boolean> {
  return hasRole('support')
}

/**
 * Get user ID from session
 */
export async function getUserId(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.sub || null
}

/**
 * Get user email from session
 */
export async function getUserEmail(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.email || null
}

/**
 * Get user name from session
 */
export async function getUserName(): Promise<string | null> {
  const session = await getSession()
  return session?.user?.name || session?.user?.nickname || null
}
