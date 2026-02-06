import { getSession, getAccessToken } from '@auth0/nextjs-auth0'

export async function getServerSession() {
  try {
    const session = await getSession()
    return session
  } catch (error) {
    console.error('Error getting session:', error)
    return null
  }
}

export async function getServerAccessToken() {
  try {
    const { accessToken } = await getAccessToken()
    return accessToken
  } catch (error) {
    console.error('Error getting access token:', error)
    return null
  }
}

export async function getCurrentUser() {
  const session = await getServerSession()
  return session?.user || null
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }
  return session.user
}
