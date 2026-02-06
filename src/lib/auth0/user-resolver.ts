/**
 * User ID and Email Resolution Utilities
 * Allows using either email or user ID throughout the app
 */

import axios from 'axios'

// Cache for M2M token
let cachedM2MToken: { token: string; expiresAt: number } | null = null

/**
 * Get Management API M2M token
 */
async function getManagementToken(): Promise<string> {
  // Return cached token if still valid
  if (cachedM2MToken && cachedM2MToken.expiresAt > Date.now()) {
    return cachedM2MToken.token
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
  cachedM2MToken = {
    token: access_token,
    expiresAt: Date.now() + (expires_in - 300) * 1000,
  }

  return access_token
}

/**
 * Check if a string is an email address
 */
export function isEmail(identifier: string): boolean {
  return identifier.includes('@')
}

/**
 * Check if a string is a user ID (auth0|... or other provider formats)
 */
export function isUserId(identifier: string): boolean {
  return identifier.includes('|') || identifier.startsWith('auth0')
}

/**
 * Resolve email to user ID
 */
export async function resolveEmailToUserId(email: string): Promise<string | null> {
  try {
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

    const users = response.data

    if (users.length === 0) {
      console.warn(`No user found with email: ${email}`)
      return null
    }

    if (users.length > 1) {
      console.warn(`Multiple users found with email: ${email}, using first one`)
    }

    return users[0].user_id
  } catch (error) {
    console.error('Error resolving email to user ID:', error)
    return null
  }
}

/**
 * Resolve user ID or email to user details
 */
export async function resolveUserIdentifier(identifier: string): Promise<{
  userId: string
  email: string
  name?: string
} | null> {
  try {
    const token = await getManagementToken()

    // If it's already a user ID, fetch user details
    if (isUserId(identifier)) {
      const response = await axios.get(
        `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(identifier)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      return {
        userId: response.data.user_id,
        email: response.data.email,
        name: response.data.name,
      }
    }

    // If it's an email, search for the user
    if (isEmail(identifier)) {
      const userId = await resolveEmailToUserId(identifier)
      if (!userId) return null

      // Fetch full user details
      const response = await axios.get(
        `${process.env.AUTH0_ISSUER_BASE_URL}/api/v2/users/${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )

      return {
        userId: response.data.user_id,
        email: response.data.email,
        name: response.data.name,
      }
    }

    // Unknown format
    console.warn(`Unknown identifier format: ${identifier}`)
    return null
  } catch (error) {
    console.error('Error resolving user identifier:', error)
    return null
  }
}

/**
 * Normalize user identifier to user ID
 * Accepts either email or user ID, returns user ID
 */
export async function normalizeToUserId(identifier: string): Promise<string | null> {
  // Already a user ID
  if (isUserId(identifier)) {
    return identifier
  }

  // Email - need to resolve
  if (isEmail(identifier)) {
    return await resolveEmailToUserId(identifier)
  }

  console.warn(`Cannot normalize identifier: ${identifier}`)
  return null
}

/**
 * Format user for display (shows both email and ID)
 */
export function formatUserDisplay(email: string, userId: string): string {
  return `${email} (${userId.substring(0, 20)}...)`
}

/**
 * Extract user info from identifier
 */
export async function getUserInfo(identifier: string): Promise<{
  userId: string
  email: string
  displayName: string
} | null> {
  const resolved = await resolveUserIdentifier(identifier)
  if (!resolved) return null

  return {
    userId: resolved.userId,
    email: resolved.email,
    displayName: resolved.name || resolved.email,
  }
}
