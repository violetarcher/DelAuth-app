#!/usr/bin/env node

/**
 * Quick script to assign FGA roles to users
 * Usage: node scripts/assign-fga-role.js <userId> <role> [organizationId]
 */

const { OpenFgaClient } = require('@openfga/sdk')
require('dotenv').config({ path: '.env.local' })

const ROLES = {
  super_admin: 'super_admin',
  admin: 'admin',
  support: 'support',
  member: 'member',
}

async function assignRole(userId, role, organizationId) {
  // Validate role
  if (!ROLES[role]) {
    console.error(`❌ Invalid role: ${role}`)
    console.error(`   Valid roles: ${Object.keys(ROLES).join(', ')}`)
    process.exit(1)
  }

  // Use default org if not provided
  const orgId = organizationId || 'org_0EgXDHCsaAtl5uhG'

  // Initialize FGA client
  const client = new OpenFgaClient({
    apiUrl: process.env.FGA_API_URL,
    storeId: process.env.FGA_STORE_ID,
    credentials: {
      method: 'client_credentials',
      config: {
        apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER,
        apiAudience: process.env.FGA_API_AUDIENCE,
        clientId: process.env.FGA_CLIENT_ID,
        clientSecret: process.env.FGA_CLIENT_SECRET,
      },
    },
  })

  console.log('🔧 Assigning FGA Role...')
  console.log(`   User: ${userId}`)
  console.log(`   Role: ${role}`)
  console.log(`   Organization: ${orgId}`)
  console.log('')

  try {
    // Write the tuple
    await client.write({
      writes: [
        {
          user: `user:${userId}`,
          relation: role,
          object: `organization:${orgId}`,
        },
      ],
    })

    console.log('✅ Role assigned successfully!')
    console.log('')
    console.log('🧪 Testing permissions...')

    // Test the permission
    const testPermissions = [
      'can_view',
      'can_reset_mfa',
      'can_invite',
      'can_add_member',
      'can_update_roles',
      'can_remove_member',
      'can_delete',
    ]

    const results = await Promise.all(
      testPermissions.map(async (permission) => {
        const { allowed } = await client.check({
          user: `user:${userId}`,
          relation: permission,
          object: `organization:${orgId}`,
        })
        return { permission, allowed }
      })
    )

    console.log('')
    console.log('📊 Permission Check Results:')
    results.forEach(({ permission, allowed }) => {
      const icon = allowed ? '✓' : '✗'
      const color = allowed ? '\x1b[32m' : '\x1b[90m'
      console.log(`   ${color}${icon}\x1b[0m ${permission}`)
    })

    console.log('')
    console.log('🎉 Done! Refresh your dashboard to see the updated permissions.')
  } catch (error) {
    console.error('❌ Error assigning role:', error.message)
    if (error.response) {
      console.error('   Details:', JSON.stringify(error.response.data, null, 2))
    }
    process.exit(1)
  }
}

// Parse command line arguments
const args = process.argv.slice(2)

if (args.length < 2) {
  console.log('Usage: node scripts/assign-fga-role.js <userId> <role> [organizationId]')
  console.log('')
  console.log('Examples:')
  console.log('  node scripts/assign-fga-role.js auth0|123456 super_admin')
  console.log('  node scripts/assign-fga-role.js auth0|123456 admin org_xyz')
  console.log('')
  console.log('Available roles:')
  console.log('  - super_admin  (Full access including delete)')
  console.log('  - admin        (Full access except delete)')
  console.log('  - support      (Read-only + MFA reset)')
  console.log('  - member       (No permissions)')
  process.exit(1)
}

const [userId, role, organizationId] = args

assignRole(userId, role, organizationId)
