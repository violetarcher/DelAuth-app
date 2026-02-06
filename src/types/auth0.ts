export interface Auth0User {
  sub: string
  name?: string
  nickname?: string
  email?: string
  email_verified?: boolean
  picture?: string
  org_id?: string
  roles?: string[]
  [key: string]: any
}

export interface Auth0Session {
  user: Auth0User
  accessToken?: string
  idToken?: string
}

export interface OrganizationMember {
  user_id: string
  name?: string
  email?: string
  picture?: string
  roles?: OrganizationRole[]
}

export interface OrganizationRole {
  id: string
  name: string
  description?: string
}

export interface Organization {
  id: string
  name: string
  display_name?: string
  branding?: {
    logo_url?: string
    colors?: {
      primary?: string
      page_background?: string
    }
  }
  metadata?: Record<string, any>
}

export interface Invitation {
  id: string
  organization_id: string
  inviter: {
    name: string
  }
  invitee: {
    email: string
  }
  ticket_id: string
  created_at: string
  expires_at: string
  roles?: string[]
}

export type RoleType = 'super_admin' | 'admin' | 'support' | 'member'

export interface PermissionCheck {
  allowed: boolean
  role?: RoleType
  reason?: string
}
