#!/usr/bin/env node

/**
 * Deploy FGA model via API
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

require('dotenv').config({ path: '.env.local' })

const FGA_API_URL = process.env.FGA_API_URL
const FGA_STORE_ID = process.env.FGA_STORE_ID
const FGA_CLIENT_ID = process.env.FGA_CLIENT_ID
const FGA_CLIENT_SECRET = process.env.FGA_CLIENT_SECRET
const FGA_API_TOKEN_ISSUER = process.env.FGA_API_TOKEN_ISSUER
const FGA_API_AUDIENCE = process.env.FGA_API_AUDIENCE

async function getAccessToken() {
  console.log('🔑 Getting access token...')

  const data = JSON.stringify({
    client_id: FGA_CLIENT_ID,
    client_secret: FGA_CLIENT_SECRET,
    audience: FGA_API_AUDIENCE,
    grant_type: 'client_credentials',
  })

  const url = new URL(`https://${FGA_API_TOKEN_ISSUER}/oauth/token`)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (res.statusCode === 200) {
          const tokenData = JSON.parse(body)
          resolve(tokenData.access_token)
        } else {
          reject(new Error(`Token request failed: ${res.statusCode} ${body}`))
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function deployModel(accessToken) {
  console.log('📤 Deploying authorization model...')

  // FGA model in JSON format for API
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
                { computedUserset: { relation: 'member' } },
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

  const data = JSON.stringify(model)
  const url = new URL(`${FGA_API_URL}/stores/${FGA_STORE_ID}/authorization-models`)

  return new Promise((resolve, reject) => {
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        Authorization: `Bearer ${accessToken}`,
      },
    }

    const req = https.request(options, (res) => {
      let body = ''
      res.on('data', (chunk) => (body += chunk))
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          const result = JSON.parse(body)
          resolve(result)
        } else {
          reject(new Error(`Model deployment failed: ${res.statusCode} ${body}`))
        }
      })
    })

    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function main() {
  try {
    console.log('🚀 FGA Model Deployment via API\n')
    console.log(`Store ID: ${FGA_STORE_ID}`)
    console.log(`API URL: ${FGA_API_URL}\n`)

    const accessToken = await getAccessToken()
    console.log('✅ Access token obtained\n')

    const result = await deployModel(accessToken)
    console.log('✅ Model deployed successfully!\n')
    console.log(`Model ID: ${result.authorization_model_id}`)
    console.log('\n🎉 Your FGA authorization model is now active!')
    console.log('\nNext step: Start the dev server with `npm run dev`')
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  }
}

main()
