#!/usr/bin/env node

/**
 * Test CIBA Configuration
 * This script tests if CIBA is properly configured in Auth0
 */

const axios = require('axios')
require('dotenv').config({ path: '.env.local' })

async function testCIBA() {
  console.log('🧪 Testing CIBA Configuration...\n')

  console.log('Configuration:')
  console.log(`  Domain: ${process.env.AUTH0_ISSUER_BASE_URL}`)
  console.log(`  Client ID: ${process.env.AUTH0_CLIENT_ID}`)
  console.log(`  Client Secret: ${process.env.AUTH0_CLIENT_SECRET ? '***' + process.env.AUTH0_CLIENT_SECRET.slice(-4) : 'NOT SET'}`)
  console.log('')

  // You need to provide your user ID here
  const userId = process.argv[2]

  if (!userId) {
    console.error('❌ Error: Please provide your user ID')
    console.error('Usage: node test-ciba.js YOUR_USER_ID')
    console.error('Example: node test-ciba.js auth0|6986517b9f3c3f9a274c5ea5')
    process.exit(1)
  }

  console.log(`Testing CIBA for user: ${userId}\n`)

  try {
    console.log('Step 1: Initiating CIBA request...')

    // Build form-urlencoded body
    const params = new URLSearchParams()
    params.append('client_id', process.env.AUTH0_CLIENT_ID)
    params.append('client_secret', process.env.AUTH0_CLIENT_SECRET)
    params.append('scope', 'openid profile email')
    params.append('binding_message', 'Test CIBA - Please Approve')
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

    console.log('✅ CIBA request initiated successfully!')
    console.log(`   auth_req_id: ${response.data.auth_req_id}`)
    console.log(`   expires_in: ${response.data.expires_in} seconds`)
    console.log(`   interval: ${response.data.interval} seconds`)
    console.log('')
    console.log('📱 CHECK YOUR PHONE NOW!')
    console.log('   You should receive a Guardian Push notification')
    console.log('   Message: "Test CIBA - Please Approve"')
    console.log('')
    console.log('⏳ Waiting for approval...')

    const authReqId = response.data.auth_req_id
    const interval = response.data.interval || 5
    const maxAttempts = 12 // 1 minute

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, interval * 1000))

      console.log(`   Polling attempt ${attempt}/${maxAttempts}...`)

      try {
        const tokenParams = new URLSearchParams()
        tokenParams.append('grant_type', 'urn:openid:params:grant-type:ciba')
        tokenParams.append('client_id', process.env.AUTH0_CLIENT_ID)
        tokenParams.append('client_secret', process.env.AUTH0_CLIENT_SECRET)
        tokenParams.append('auth_req_id', authReqId)

        const tokenResponse = await axios.post(
          `${process.env.AUTH0_ISSUER_BASE_URL}/oauth/token`,
          tokenParams.toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        )

        if (tokenResponse.data.access_token) {
          console.log('')
          console.log('✅ SUCCESS! CIBA approved!')
          console.log('   Token received - CIBA is working correctly!')
          process.exit(0)
        }
      } catch (pollError) {
        const errorCode = pollError.response?.data?.error

        if (errorCode === 'authorization_pending') {
          continue
        } else if (errorCode === 'access_denied') {
          console.log('')
          console.log('❌ User denied the request')
          process.exit(1)
        } else if (errorCode === 'expired_token') {
          console.log('')
          console.log('❌ Request expired')
          process.exit(1)
        } else {
          console.log('')
          console.error('❌ Polling error:', errorCode, pollError.response?.data)
          process.exit(1)
        }
      }
    }

    console.log('')
    console.log('⏰ Timeout - No response after 1 minute')
    console.log('   Possible issues:')
    console.log('   - Guardian not installed or not logged in')
    console.log('   - Notifications disabled for Guardian app')
    console.log('   - User ID incorrect')
    process.exit(1)
  } catch (error) {
    console.log('')
    console.error('❌ CIBA initiation failed!')
    console.error('Status:', error.response?.status)
    console.error('Error:', error.response?.data?.error)
    console.error('Description:', error.response?.data?.error_description)
    console.log('')

    if (error.response?.status === 403) {
      console.log('💡 Solution: CIBA grant type is not enabled')
      console.log('   1. Go to https://manage.auth0.com')
      console.log('   2. Applications → Your App → Settings')
      console.log('   3. Advanced Settings → Grant Types')
      console.log('   4. Enable "CIBA"')
      console.log('   5. Save Changes')
    } else if (error.response?.data?.error === 'invalid_request') {
      console.log('💡 Possible issues:')
      console.log('   - User ID format incorrect (should be: auth0|123...)')
      console.log('   - Guardian not enrolled for this user')
      console.log('   - User does not exist')
    }

    process.exit(1)
  }
}

testCIBA()
