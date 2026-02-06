import { OpenFgaClient, CredentialsMethod } from '@openfga/sdk'

let fgaClient: OpenFgaClient | null = null

/**
 * Get or create FGA client instance (singleton)
 */
export function getFGAClient(): OpenFgaClient {
  if (!fgaClient) {
    fgaClient = new OpenFgaClient({
      apiUrl: process.env.FGA_API_URL!,
      storeId: process.env.FGA_STORE_ID!,
      credentials: {
        method: CredentialsMethod.ClientCredentials,
        config: {
          apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER!,
          apiAudience: process.env.FGA_API_AUDIENCE!,
          clientId: process.env.FGA_CLIENT_ID!,
          clientSecret: process.env.FGA_CLIENT_SECRET!,
        },
      },
    })
  }

  return fgaClient
}

/**
 * Format user string for FGA
 */
export function formatFGAUser(userId: string): string {
  return `user:${userId}`
}

/**
 * Format organization string for FGA
 */
export function formatFGAOrganization(organizationId: string): string {
  return `organization:${organizationId}`
}

/**
 * Parse FGA user string to get user ID
 */
export function parseFGAUser(fgaUser: string): string {
  return fgaUser.replace('user:', '')
}

/**
 * Parse FGA organization string to get org ID
 */
export function parseFGAOrganization(fgaOrg: string): string {
  return fgaOrg.replace('organization:', '')
}
