#!/usr/bin/env node

/**
 * Setup demo users in Auth0 and FGA
 * Creates admin users and member users for testing
 */

require('dotenv').config({ path: '.env.local' })
const axios = require('axios')
const { OpenFgaClient, CredentialsMethod } = require('@openfga/sdk')

const AUTH0_DOMAIN = process.env.AUTH0_ISSUER_BASE_URL
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID
const AUTH0_CLIENT_SECRET = process.env.AUTH0_CLIENT_SECRET
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE

// Demo users configuration
const ADMIN_USERS = [
  { email: 'superadmin@atko.email', name: 'Super Admin', role: 'super_admin' },
  { email: 'admin@atko.email', name: 'Admin User', role: 'admin' },
  { email: 'support@atko.email', name: 'Support User', role: 'support' },
]

const MEMBER_USERS = [
  { email: 'member1@atko.email', name: 'John Doe', role: 'member' },
  { email: 'member2@atko.email', name: 'Jane Smith', role: 'member' },
  { email: 'member3@atko.email', name: 'Bob Johnson', role: 'member' },
]

const ORGANIZATION_NAME = 'agency-inc'

let managementToken = null
let organizationId = null

async function getManagementToken() {
  console.log('🔑 Getting Auth0 Management API token...')

  const response = await axios.post(`${AUTH0_DOMAIN}/oauth/token`, {
    client_id: AUTH0_CLIENT_ID,
    client_secret: AUTH0_CLIENT_SECRET,
    audience: AUTH0_AUDIENCE,
    grant_type: 'client_credentials',
  })

  managementToken = response.data.access_token
  console.log('✅ Management token obtained\n')
}

async function findOrganization() {
  console.log(`🔍 Finding organization: ${ORGANIZATION_NAME}...`)

  // List all organizations and find by name
  const response = await axios.get(`${AUTH0_DOMAIN}/api/v2/organizations`, {
    headers: { Authorization: `Bearer ${managementToken}` },
  })

  const org = response.data.find(o => o.name === ORGANIZATION_NAME)

  if (!org) {
    throw new Error(`Organization "${ORGANIZATION_NAME}" not found. Please create it first.`)
  }

  organizationId = org.id
  console.log(`✅ Found organization: ${organizationId}\n`)
}

async function createUser(email, name, password = 'Test123!@#') {
  console.log(`👤 Creating user: ${email}...`)

  try {
    const response = await axios.post(
      `${AUTH0_DOMAIN}/api/v2/users`,
      {
        email,
        name,
        password,
        connection: 'Username-Password-Authentication',
        email_verified: true,
      },
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    console.log(`   ✅ Created: ${response.data.user_id}`)
    return response.data.user_id
  } catch (error) {
    if (error.response?.status === 409) {
      // User already exists, find them
      console.log(`   ℹ️  User already exists, finding...`)
      const searchResponse = await axios.get(`${AUTH0_DOMAIN}/api/v2/users`, {
        headers: { Authorization: `Bearer ${managementToken}` },
        params: { q: `email:"${email}"`, search_engine: 'v3' },
      })

      if (searchResponse.data.length > 0) {
        console.log(`   ✅ Found: ${searchResponse.data[0].user_id}`)
        return searchResponse.data[0].user_id
      }
    }
    throw error
  }
}

async function addUserToOrganization(userId, email) {
  console.log(`🏢 Adding ${email} to organization...`)

  try {
    await axios.post(
      `${AUTH0_DOMAIN}/api/v2/organizations/${organizationId}/members`,
      { members: [userId] },
      {
        headers: {
          Authorization: `Bearer ${managementToken}`,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log(`   ✅ Added to organization`)
  } catch (error) {
    if (error.response?.status === 409) {
      console.log(`   ℹ️  User already in organization`)
    } else {
      throw error
    }
  }
}

async function createFGATuple(userId, role) {
  console.log(`🔐 Creating FGA tuple: ${role}...`)

  const fgaClient = new OpenFgaClient({
    apiUrl: process.env.FGA_API_URL,
    storeId: process.env.FGA_STORE_ID,
    credentials: {
      method: CredentialsMethod.ClientCredentials,
      config: {
        apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER,
        apiAudience: process.env.FGA_API_AUDIENCE,
        clientId: process.env.FGA_CLIENT_ID,
        clientSecret: process.env.FGA_CLIENT_SECRET,
      },
    },
  })

  try {
    await fgaClient.write({
      writes: [
        {
          user: `user:${userId}`,
          relation: role,
          object: `organization:${organizationId}`,
        },
      ],
    })
    console.log(`   ✅ FGA tuple created\n`)
  } catch (error) {
    console.log(`   ℹ️  Tuple may already exist\n`)
  }
}

async function setupUser(userConfig) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Setting up: ${userConfig.email} (${userConfig.role})`)
  console.log('='.repeat(60))

  try {
    // Create user
    const userId = await createUser(userConfig.email, userConfig.name)

    // Add to organization
    await addUserToOrganization(userId, userConfig.email)

    // Create FGA tuple
    await createFGATuple(userId, userConfig.role)

    return { email: userConfig.email, userId, role: userConfig.role, success: true }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}\n`)
    return { email: userConfig.email, role: userConfig.role, success: false, error: error.message }
  }
}

async function main() {
  console.log('🚀 Auth0 & FGA Demo User Setup\n')
  console.log(`Organization: ${ORGANIZATION_NAME}`)
  console.log(`Total Users: ${ADMIN_USERS.length + MEMBER_USERS.length}\n`)

  try {
    // Get management token
    await getManagementToken()

    // Find organization
    await findOrganization()

    const results = []

    // Setup admin users
    console.log('\n📋 Creating Admin Users...\n')
    for (const user of ADMIN_USERS) {
      const result = await setupUser(user)
      results.push(result)
    }

    // Setup member users
    console.log('\n📋 Creating Member Users...\n')
    for (const user of MEMBER_USERS) {
      const result = await setupUser(user)
      results.push(result)
    }

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 SETUP SUMMARY')
    console.log('='.repeat(60) + '\n')

    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    console.log(`✅ Successful: ${successful.length}`)
    console.log(`❌ Failed: ${failed.length}\n`)

    if (successful.length > 0) {
      console.log('✅ Successfully Created/Updated:\n')
      successful.forEach(r => {
        console.log(`   ${r.email}`)
        console.log(`   └─ Role: ${r.role}`)
        console.log(`   └─ ID: ${r.userId}\n`)
      })
    }

    if (failed.length > 0) {
      console.log('❌ Failed:\n')
      failed.forEach(r => {
        console.log(`   ${r.email} - ${r.error}\n`)
      })
    }

    console.log('🎉 Setup complete!\n')
    console.log('📝 Test Credentials:')
    console.log('   Email: superadmin@atko.email')
    console.log('   Email: admin@atko.email')
    console.log('   Email: support@atko.email')
    console.log('   Password: Test123!@#\n')
    console.log('🌐 Login at: http://localhost:3005\n')

  } catch (error) {
    console.error('\n❌ Setup Error:', error.message)
    if (error.response) {
      console.error('Response:', error.response.data)
    }
    process.exit(1)
  }
}

main()
