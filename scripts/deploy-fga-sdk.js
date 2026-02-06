#!/usr/bin/env node

/**
 * Deploy FGA model using the OpenFGA SDK
 */

require('dotenv').config({ path: '.env.local' })
const { OpenFgaClient, CredentialsMethod } = require('@openfga/sdk')

async function deployModel() {
  console.log('🚀 FGA Model Deployment using OpenFGA SDK\n')
  console.log(`Store ID: ${process.env.FGA_STORE_ID}`)
  console.log(`API URL: ${process.env.FGA_API_URL}\n`)

  // Initialize FGA client
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

  console.log('🔑 Authenticating with FGA...')

  try {
    // Define the authorization model in JSON format
    const model = {
      schema_version: '1.1',
      type_definitions: [
        {
          type: 'user',
        },
        {
          type: 'organization',
          relations: {
            super_admin: {
              this: {},
            },
            admin: {
              this: {},
            },
            support: {
              this: {},
            },
            member: {
              this: {},
            },
            can_view: {
              union: {
                child: [
                  { computedUserset: { relation: 'super_admin' } },
                  { computedUserset: { relation: 'admin' } },
                  { computedUserset: { relation: 'support' } },
                ],
              },
            },
            can_reset_mfa: {
              union: {
                child: [
                  { computedUserset: { relation: 'super_admin' } },
                  { computedUserset: { relation: 'admin' } },
                  { computedUserset: { relation: 'support' } },
                ],
              },
            },
            can_invite: {
              union: {
                child: [
                  { computedUserset: { relation: 'super_admin' } },
                  { computedUserset: { relation: 'admin' } },
                ],
              },
            },
            can_add_member: {
              union: {
                child: [
                  { computedUserset: { relation: 'super_admin' } },
                  { computedUserset: { relation: 'admin' } },
                ],
              },
            },
            can_update_roles: {
              union: {
                child: [
                  { computedUserset: { relation: 'super_admin' } },
                  { computedUserset: { relation: 'admin' } },
                ],
              },
            },
            can_remove_member: {
              union: {
                child: [
                  { computedUserset: { relation: 'super_admin' } },
                  { computedUserset: { relation: 'admin' } },
                ],
              },
            },
            can_delete: {
              computedUserset: { relation: 'super_admin' },
            },
          },
          metadata: {
            relations: {
              super_admin: { directly_related_user_types: [{ type: 'user' }] },
              admin: { directly_related_user_types: [{ type: 'user' }] },
              support: { directly_related_user_types: [{ type: 'user' }] },
              member: { directly_related_user_types: [{ type: 'user' }] },
            },
          },
        },
      ],
    }

    console.log('📤 Deploying authorization model...\n')

    // Deploy the model
    const { authorization_model_id } = await fgaClient.writeAuthorizationModel(model)

    console.log('✅ Model deployed successfully!\n')
    console.log(`Authorization Model ID: ${authorization_model_id}`)
    console.log('\n📋 Model Summary:')
    console.log('   - Admin Roles: super_admin, admin, support (can log into the app)')
    console.log('   - Member Role: member (no permissions - these are users being managed)')
    console.log('   - Permissions: can_view, can_reset_mfa, can_invite, can_add_member,')
    console.log('                  can_update_roles, can_remove_member, can_delete')
    console.log('\n🎉 Your FGA authorization model is now active!')
    console.log('\n📝 Next steps:')
    console.log('   1. Start the dev server: npm run dev')
    console.log('   2. Login to the app at http://localhost:3005')
    console.log('   3. Assign yourself a role (see FGA-SETUP.md for instructions)')
  } catch (error) {
    console.error('\n❌ Deployment Error:', error.message)
    if (error.message.includes('authorization model id')) {
      console.log('\n💡 Note: If the model already exists, that\'s okay!')
      console.log('   The existing model will continue to work.')
    } else {
      console.error('\nFull error:', error)
    }
    process.exit(1)
  }
}

deployModel()
