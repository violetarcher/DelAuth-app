/**
 * Scope validation and extraction utilities for RBAC
 */

import { getSession } from '@auth0/nextjs-auth0'

/**
 * Required scopes for each operation
 */
export const REQUIRED_SCOPES = {
  VIEW_MEMBERS: ['read:organization_members'],
  INVITE_MEMBER: ['create:organization_invitations'],
  ADD_MEMBER: ['create:organization_members'],
  UPDATE_ROLES: ['update:organization_members'],
  REMOVE_MEMBER: ['delete:organization_members'],
  DELETE_USER: ['delete:users'],
  RESET_MFA: ['update:users_app_metadata'],
  READ_USER: ['read:users'],
  UPDATE_USER: ['update:users'],
} as const

/**
 * Extract permissions from user's access token
 */
export async function getUserPermissions(): Promise<string[]> {
  const session = await getSession()

  if (!session?.accessToken) {
    return []
  }

  // Decode JWT to get custom claims
  const tokenPayload = JSON.parse(
    Buffer.from(session.accessToken.split('.')[1], 'base64').toString()
  )

  // Get permissions from custom claim
  const permissions = tokenPayload['https://deladmin.app/permissions'] || []

  return Array.isArray(permissions) ? permissions : []
}

/**
 * Extract user roles from access token
 */
export async function getUserRoles(): Promise<string[]> {
  const session = await getSession()

  if (!session?.accessToken) {
    return []
  }

  const tokenPayload = JSON.parse(
    Buffer.from(session.accessToken.split('.')[1], 'base64').toString()
  )

  const roles = tokenPayload['https://deladmin.app/roles'] || []

  return Array.isArray(roles) ? roles : []
}

/**
 * Extract organization ID from access token
 */
export async function getUserOrganization(): Promise<string | null> {
  const session = await getSession()

  if (!session?.accessToken) {
    return null
  }

  const tokenPayload = JSON.parse(
    Buffer.from(session.accessToken.split('.')[1], 'base64').toString()
  )

  return tokenPayload['https://deladmin.app/organization'] || null
}

/**
 * Check if user has required scope(s)
 */
export async function hasScope(requiredScopes: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions()

  // User must have ALL required scopes
  return requiredScopes.every(scope => userPermissions.includes(scope))
}

/**
 * Check if user has any of the required scopes
 */
export async function hasAnyScope(requiredScopes: string[]): Promise<boolean> {
  const userPermissions = await getUserPermissions()

  // User must have AT LEAST ONE of the required scopes
  return requiredScopes.some(scope => userPermissions.includes(scope))
}

/**
 * Validate scope and throw error if missing
 */
export async function requireScope(
  requiredScopes: string[],
  operation?: string
): Promise<void> {
  const hasRequiredScope = await hasScope(requiredScopes)

  if (!hasRequiredScope) {
    const userPermissions = await getUserPermissions()
    throw new Error(
      `Insufficient permissions for ${operation || 'this operation'}. ` +
      `Required: [${requiredScopes.join(', ')}]. ` +
      `Available: [${userPermissions.join(', ')}]`
    )
  }
}

/**
 * Get user's access token for Management API calls
 */
export async function getUserAccessToken(): Promise<string> {
  const session = await getSession()

  if (!session?.accessToken) {
    throw new Error('No access token available')
  }

  return session.accessToken
}

/**
 * Validate that operation is within user's organization context
 */
export async function validateOrganizationContext(
  requestedOrgId: string
): Promise<void> {
  const userOrgId = await getUserOrganization()

  if (!userOrgId) {
    throw new Error('No organization context in token')
  }

  if (userOrgId !== requestedOrgId) {
    throw new Error(
      'Organization mismatch: operation must be within your organization'
    )
  }
}

/**
 * Extract all user context from token
 */
export async function getUserContext() {
  const session = await getSession()

  if (!session?.accessToken) {
    return null
  }

  const tokenPayload = JSON.parse(
    Buffer.from(session.accessToken.split('.')[1], 'base64').toString()
  )

  return {
    userId: tokenPayload['https://deladmin.app/user_id'] || session.user?.sub,
    roles: tokenPayload['https://deladmin.app/roles'] || [],
    permissions: tokenPayload['https://deladmin.app/permissions'] || [],
    organization: tokenPayload['https://deladmin.app/organization'] || null,
    email: session.user?.email,
    name: session.user?.name,
  }
}
