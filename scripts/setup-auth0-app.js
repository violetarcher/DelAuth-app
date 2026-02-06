#!/usr/bin/env node

/**
 * Complete Auth0 Application Setup
 * - Callback URLs
 * - Grant types (including CIBA)
 * - Token settings
 * - OIDC compliance
 */

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')

const AUTH0_DOMAIN = process.env.AUTH0_ISSUER_BASE_URL
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE
const BASE_URL = process.env.AUTH0_BASE_URL || 'http://localhost:3005'

const APPLICATION_CONFIG = {
  // URLs
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

  // Grant types
  grant_types: [
    'authorization_code',           // Standard OAuth flow
    'implicit',                     // For single-page apps
    'refresh_token',                // Token refresh
    'client_credentials',           // Machine-to-machine
    'password',                     // Resource Owner Password (for testing)
    // Note: CIBA grant (urn:openid:params:grant-type:ciba) must be enabled
    // manually in Auth0 Dashboard under Advanced Settings > Grant Types
  ],

  // Token endpoint authentication
  token_endpoint_auth_method: 'client_secret_post',

  // Application type
  app_type: 'regular_web',

  // OIDC conformant
  oidc_conformant: true,

  // JWT configuration
  jwt_configuration: {
    alg: 'RS256',
    lifetime_in_seconds: 36000,
  },

  // Refresh token settings
  refresh_token: {
    rotation_type: 'rotating',
    expiration_type: 'expiring',
    leeway: 0,
    token_lifetime: 2592000, // 30 days
    infinite_token_lifetime: false,
    infinite_idle_token_lifetime: false,
    idle_token_lifetime: 1296000, // 15 days
  },
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

async function getCurrentConfig(token) {
  console.log('📖 Reading current application configuration...')

  const response = await axios.get(
    `${AUTH0_DOMAIN}/api/v2/clients/${AUTH0_CLIENT_ID}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  console.log('✅ Current configuration retrieved\n')
  return response.data
}

async function updateApplication(token, currentConfig) {
  console.log('📝 Updating Auth0 Application...\n')

  try {
    // Merge URLs (avoid duplicates)
    const mergedCallbacks = [
      ...new Set([
        ...(currentConfig.callbacks || []),
        ...APPLICATION_CONFIG.callbacks,
      ]),
    ]

    const mergedLogoutUrls = [
      ...new Set([
        ...(currentConfig.allowed_logout_urls || []),
        ...APPLICATION_CONFIG.allowed_logout_urls,
      ]),
    ]

    const mergedWebOrigins = [
      ...new Set([
        ...(currentConfig.web_origins || []),
        ...APPLICATION_CONFIG.web_origins,
      ]),
    ]

    const mergedAllowedOrigins = [
      ...new Set([
        ...(currentConfig.allowed_origins || []),
        ...APPLICATION_CONFIG.allowed_origins,
      ]),
    ]

    // Merge grant types (avoid duplicates)
    const mergedGrantTypes = [
      ...new Set([
        ...(currentConfig.grant_types || []),
        ...APPLICATION_CONFIG.grant_types,
      ]),
    ]

    const updatePayload = {
      ...APPLICATION_CONFIG,
      callbacks: mergedCallbacks,
      allowed_logout_urls: mergedLogoutUrls,
      web_origins: mergedWebOrigins,
      allowed_origins: mergedAllowedOrigins,
      grant_types: mergedGrantTypes,
    }

    // Update application
    await axios.patch(
      `${AUTH0_DOMAIN}/api/v2/clients/${AUTH0_CLIENT_ID}`,
      updatePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log('✅ Application Updated Successfully!\n')
    console.log('=' .repeat(60))
    console.log('📋 CONFIGURED SETTINGS')
    console.log('='.repeat(60) + '\n')

    console.log('🔗 Callback URLs:')
    mergedCallbacks.forEach(url => console.log(`   ✓ ${url}`))

    console.log('\n🚪 Allowed Logout URLs:')
    mergedLogoutUrls.forEach(url => console.log(`   ✓ ${url}`))

    console.log('\n🌐 Web Origins:')
    mergedWebOrigins.forEach(url => console.log(`   ✓ ${url}`))

    console.log('\n📜 Grant Types:')
    mergedGrantTypes.forEach(grant => {
      const label = grant === 'urn:openid:params:grant-type:ciba'
        ? `${grant} (CIBA/Guardian Push)`
        : grant
      console.log(`   ✓ ${label}`)
    })

    console.log(`\n🔐 Token Endpoint Auth: ${APPLICATION_CONFIG.token_endpoint_auth_method}`)
    console.log(`📱 App Type: ${APPLICATION_CONFIG.app_type}`)
    console.log(`✅ OIDC Conformant: ${APPLICATION_CONFIG.oidc_conformant}`)

    console.log('\n🔄 Refresh Token Settings:')
    console.log(`   Rotation: ${APPLICATION_CONFIG.refresh_token.rotation_type}`)
    console.log(`   Expiration: ${APPLICATION_CONFIG.refresh_token.expiration_type}`)
    console.log(`   Lifetime: ${APPLICATION_CONFIG.refresh_token.token_lifetime / 86400} days`)
    console.log(`   Idle Lifetime: ${APPLICATION_CONFIG.refresh_token.idle_token_lifetime / 86400} days`)

    console.log('\n' + '='.repeat(60))
    console.log('🎉 Configuration Complete!')
    console.log('='.repeat(60) + '\n')

    console.log('📝 Next Steps:')
    console.log('   1. Try logging in at http://localhost:3005')
    console.log('   2. Test CIBA flow with Guardian app')
    console.log('   3. Verify all grant types work as expected\n')

  } catch (error) {
    if (error.response) {
      console.error('❌ Error updating application:')
      console.error('Status:', error.response.status)
      console.error('Data:', JSON.stringify(error.response.data, null, 2))
    } else {
      console.error('❌ Error:', error.message)
    }
    throw error
  }
}

async function verifyConfiguration(token) {
  console.log('🔍 Verifying configuration...')

  try {
    const config = await getCurrentConfig(token)

    const checks = [
      {
        name: 'Callback URL',
        check: config.callbacks?.includes(`${BASE_URL}/api/auth/callback`),
      },
      {
        name: 'Authorization Code Grant',
        check: config.grant_types?.includes('authorization_code'),
      },
      {
        name: 'CIBA Grant (optional)',
        check: config.grant_types?.includes('urn:openid:params:grant-type:ciba'),
        optional: true,
      },
      {
        name: 'Refresh Token',
        check: config.grant_types?.includes('refresh_token'),
      },
      {
        name: 'OIDC Conformant',
        check: config.oidc_conformant === true,
      },
    ]

    console.log('\n✓ Verification Results:\n')
    checks.forEach(({ name, check, optional }) => {
      const status = check ? '✅' : (optional ? '⚠️ ' : '❌')
      console.log(`   ${status} ${name}`)
    })

    const allPassed = checks.filter(c => !c.optional).every(c => c.check)

    if (allPassed) {
      console.log('\n🎉 All checks passed!\n')
    } else {
      console.log('\n⚠️  Some checks failed. Configuration may be incomplete.\n')
    }

  } catch (error) {
    console.error('❌ Verification failed:', error.message)
  }
}

async function main() {
  console.log('🚀 Auth0 Application Complete Setup\n')
  console.log(`Domain: ${AUTH0_DOMAIN}`)
  console.log(`Client ID: ${AUTH0_CLIENT_ID}`)
  console.log(`Base URL: ${BASE_URL}\n`)

  try {
    const token = await getManagementToken()
    const currentConfig = await getCurrentConfig(token)
    await updateApplication(token, currentConfig)
    await verifyConfiguration(token)

    console.log('✅ Setup completed successfully!')

  } catch (error) {
    console.error('\n❌ Setup failed')
    console.error('Please check your Auth0 credentials and try again.')
    process.exit(1)
  }
}

main()
