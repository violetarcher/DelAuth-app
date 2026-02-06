import axios from 'axios'

interface CIBAInitiateResponse {
  auth_req_id: string
  expires_in: number
  interval: number
}

interface CIBATokenResponse {
  access_token?: string
  error?: string
  error_description?: string
}

/**
 * Initiate a CIBA authentication request with Guardian Push
 */
export async function initiateCIBARequest(
  userId: string,
  bindingMessage?: string
): Promise<CIBAInitiateResponse> {
  try {
    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/bc-authorize`,
      {
        client_id: process.env.AUTH0_CLIENT_ID,
        client_secret: process.env.AUTH0_CLIENT_SECRET,
        scope: 'openid profile email',
        binding_message: bindingMessage || 'Approve this action',
        login_hint: `sub:${userId}`,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )

    return response.data
  } catch (error) {
    console.error('CIBA initiation error:', error)
    throw new Error('Failed to initiate CIBA request')
  }
}

/**
 * Poll for CIBA authentication result
 */
export async function pollCIBAToken(
  authReqId: string,
  maxAttempts: number = 30,
  intervalSeconds: number = 5
): Promise<CIBATokenResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await axios.post(
        `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
        {
          grant_type: 'urn:openid:params:grant-type:ciba',
          client_id: process.env.AUTH0_CLIENT_ID,
          client_secret: process.env.AUTH0_CLIENT_SECRET,
          auth_req_id: authReqId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      // Success - token received
      if (response.data.access_token) {
        return response.data
      }
    } catch (error: any) {
      const errorCode = error.response?.data?.error

      // Still pending - continue polling
      if (errorCode === 'authorization_pending') {
        await new Promise((resolve) =>
          setTimeout(resolve, intervalSeconds * 1000)
        )
        continue
      }

      // Slow down polling
      if (errorCode === 'slow_down') {
        await new Promise((resolve) =>
          setTimeout(resolve, (intervalSeconds + 5) * 1000)
        )
        continue
      }

      // Other errors - stop polling
      if (errorCode === 'access_denied') {
        return {
          error: 'access_denied',
          error_description: 'User denied the authentication request',
        }
      }

      if (errorCode === 'expired_token') {
        return {
          error: 'expired_token',
          error_description: 'Authentication request expired',
        }
      }

      // Unknown error
      throw error
    }
  }

  // Timeout
  return {
    error: 'timeout',
    error_description: 'Authentication request timed out',
  }
}

/**
 * Complete CIBA flow - initiate and poll for result
 */
export async function completeCIBAFlow(
  userId: string,
  bindingMessage?: string
): Promise<{
  success: boolean
  access_token?: string
  error?: string
  error_description?: string
}> {
  try {
    // Initiate CIBA request
    const initResponse = await initiateCIBARequest(userId, bindingMessage)

    // Poll for result
    const tokenResponse = await pollCIBAToken(
      initResponse.auth_req_id,
      30,
      initResponse.interval || 5
    )

    if (tokenResponse.access_token) {
      return {
        success: true,
        access_token: tokenResponse.access_token,
      }
    }

    return {
      success: false,
      error: tokenResponse.error,
      error_description: tokenResponse.error_description,
    }
  } catch (error) {
    console.error('CIBA flow error:', error)
    return {
      success: false,
      error: 'ciba_failed',
      error_description: 'Failed to complete CIBA authentication',
    }
  }
}
