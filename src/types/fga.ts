// Roles are hierarchical and assigned directly
export type FGARole = 'super_admin' | 'admin' | 'support' | 'member'

// Permissions are computed from roles (not written directly)
export type FGAPermission =
  | 'can_view'
  | 'can_reset_mfa'
  | 'can_invite'
  | 'can_add_member'
  | 'can_update_roles'
  | 'can_remove_member'
  | 'can_delete'

// All relations (roles + computed permissions) for type checking
export type FGARelation = FGARole | FGAPermission

export interface FGATuple {
  user: string
  relation: FGARelation
  object: string
}

export interface FGACheckRequest {
  user: string
  relation: FGARelation
  object: string
}

export interface FGACheckResponse {
  allowed: boolean
  resolution?: string
}

export interface FGAWriteRequest {
  writes?: FGATuple[]
  deletes?: FGATuple[]
}

export interface FGAWriteResponse {
  success: boolean
  error?: string
}

export interface FGABatchCheckRequest {
  checks: FGACheckRequest[]
}

export interface FGABatchCheckResponse {
  results: {
    request: FGACheckRequest
    allowed: boolean
  }[]
}

export interface FGARelationshipVisualization {
  userId: string
  organizationId: string
  directRoles: FGARole[]
  computedPermissions: FGAPermission[]
  checks: {
    relation: FGARelation
    allowed: boolean
  }[]
}
