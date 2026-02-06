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
    console.log('🔐 Initiating CIBA request for user:', userId)
    console.log('   Binding message:', bindingMessage)

    // Auth0 CIBA endpoint requires application/x-www-form-urlencoded
    const params = new URLSearchParams()
    params.append('client_id', process.env.AUTH0_CLIENT_ID!)
    params.append('client_secret', process.env.AUTH0_CLIENT_SECRET!)
    params.append('scope', 'openid profile email')
    params.append('binding_message', bindingMessage || 'Approve this action')
    // Auth0 requires login_hint to be a JSON object with format field
    params.append('login_hint', JSON.stringify({
      format: 'iss_sub',
      iss: process.env.AUTH0_ISSUER_BASE_URL + '/',
      sub: userId
    }))

    const response = await axios.post(
      `${process.env.AUTH0_ISSUER_BASE_URL}/bc-authorize`,
      params.toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    console.log('✅ CIBA request initiated successfully')
    console.log('   auth_req_id:', response.data.auth_req_id)
    console.log('   expires_in:', response.data.expires_in)

    return response.data
  } catch (error: any) {
    console.error('❌ CIBA initiation error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    })
    throw new Error(
      error.response?.data?.error_description ||
      error.response?.data?.error ||
      'Failed to initiate CIBA request'
    )
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
  console.log('🔄 Starting CIBA polling...')
  console.log(`   Max attempts: ${maxAttempts}, Interval: ${intervalSeconds}s`)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`   Polling attempt ${attempt + 1}/${maxAttempts}...`)

      // Auth0 token endpoint requires application/x-www-form-urlencoded
      const tokenParams = new URLSearchParams()
      tokenParams.append('grant_type', 'urn:openid:params:grant-type:ciba')
      tokenParams.append('client_id', process.env.AUTH0_CLIENT_ID!)
      tokenParams.append('client_secret', process.env.AUTH0_CLIENT_SECRET!)
      tokenParams.append('auth_req_id', authReqId)

      const response = await axios.post(
        `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
        tokenParams.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      )

      // Success - token received
      if (response.data.access_token) {
        console.log('✅ CIBA approved! Token received.')
        return response.data
      }
    } catch (error: any) {
      const errorCode = error.response?.data?.error

      // Still pending - continue polling
      if (errorCode === 'authorization_pending') {
        console.log('   ⏳ Authorization still pending, waiting...')
        await new Promise((resolve) =>
          setTimeout(resolve, intervalSeconds * 1000)
        )
        continue
      }

      // Slow down polling
      if (errorCode === 'slow_down') {
        console.log('   🐌 Slow down requested, increasing interval...')
        await new Promise((resolve) =>
          setTimeout(resolve, (intervalSeconds + 5) * 1000)
        )
        continue
      }

      // Other errors - stop polling
      if (errorCode === 'access_denied') {
        console.log('   ❌ User denied the authentication request')
        return {
          error: 'access_denied',
          error_description: 'User denied the authentication request',
        }
      }

      if (errorCode === 'expired_token') {
        console.log('   ⏰ Authentication request expired')
        return {
          error: 'expired_token',
          error_description: 'Authentication request expired',
        }
      }

      // Unknown error
      console.error('   ❌ Unknown CIBA polling error:', {
        errorCode,
        data: error.response?.data,
      })
      throw error
    }
  }

  // Timeout
  console.log('   ⏰ CIBA polling timed out after', maxAttempts, 'attempts')
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
