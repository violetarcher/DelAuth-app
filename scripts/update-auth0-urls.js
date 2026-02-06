#!/usr/bin/env node

/**
 * Update Auth0 Application URLs for local development
 */

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const AUTH0_DOMAIN = process.env.AUTH0_ISSUER_BASE_URL
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE
const BASE_URL = process.env.AUTH0_BASE_URL || 'http://localhost:3005'

const REQUIRED_URLS = {
  callbacks: [
    `${BASE_URL}/api/auth/callback`,
  ],
  allowed_logout_urls: [
    `${BASE_URL}`,
  ],
  web_origins: [
    `${BASE_URL}`,
  ],
  allowed_origins: [
    `${BASE_URL}`,
  ],
}

async function getManagementToken() {
  console.log('🔑 Getting Management API token...')

  const response = await axios.post(`${AUTH0_DOMAIN}/oauth/token`, {
    client_id: AUTH0_CLIENT_ID,
    client_secret: AUTH0_CLIENT_SECRET,
    audience: AUTH0_AUDIENCE,
    grant_type: 'client_credentials',
  })

  console.log('✅ Token obtained\n')
  return response.data.access_token
}

async function updateApplication(token) {
  console.log('📝 Updating Auth0 Application URLs...\n')

  try {
    // Get current application settings
    const getCurrentApp = await axios.get(
      `${AUTH0_DOMAIN}/api/v2/clients/${AUTH0_CLIENT_ID}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    )

    const currentApp = getCurrentApp.data

    // Merge existing URLs with required URLs (avoid duplicates)
    const updatedCallbacks = [
      ...new Set([...(currentApp.callbacks || []), ...REQUIRED_URLS.callbacks]),
    ]
    const updatedLogoutUrls = [
      ...new Set([
        ...(currentApp.allowed_logout_urls || []),
        ...REQUIRED_URLS.allowed_logout_urls,
      ]),
    ]
    const updatedWebOrigins = [
      ...new Set([
        ...(currentApp.web_origins || []),
        ...REQUIRED_URLS.web_origins,
      ]),
    ]
    const updatedAllowedOrigins = [
      ...new Set([
        ...(currentApp.allowed_origins || []),
        ...REQUIRED_URLS.allowed_origins,
      ]),
    ]

    // Update application
    await axios.patch(
      `${AUTH0_DOMAIN}/api/v2/clients/${AUTH0_CLIENT_ID}`,
      {
        callbacks: updatedCallbacks,
        allowed_logout_urls: updatedLogoutUrls,
        web_origins: updatedWebOrigins,
        allowed_origins: updatedAllowedOrigins,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('✅ Application Updated Successfully!\n')
    console.log('📋 Configured URLs:\n')
    console.log('Callback URLs:')
    updatedCallbacks.forEach(url => console.log(`   ✓ ${url}`))
    console.log('\nAllowed Logout URLs:')
    updatedLogoutUrls.forEach(url => console.log(`   ✓ ${url}`))
    console.log('\nWeb Origins:')
    updatedWebOrigins.forEach(url => console.log(`   ✓ ${url}`))
    console.log('\nAllowed Origins:')
    updatedAllowedOrigins.forEach(url => console.log(`   ✓ ${url}`))
    console.log('\n🎉 Configuration complete!')
    console.log('\n📝 Next step: Try logging in again at http://localhost:3005')
  } catch (error) {
    if (error.response) {
      console.error('❌ Error updating application:', error.response.data)
    } else {
      console.error('❌ Error:', error.message)
    }
    throw error
  }
}

async function main() {
  console.log('🚀 Auth0 Application URL Configuration\n')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Client ID: ${AUTH0_CLIENT_ID}\n`)

  try {
    const token = await getManagementToken()
    await updateApplication(token)
  } catch (error) {
    console.error('\n❌ Setup failed')
    process.exit(1)
  }
}

main()
