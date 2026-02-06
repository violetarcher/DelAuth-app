import { RoleType } from './auth0'
import { FGARelation } from './fga'

export interface Member {
  user_id: string
  name?: string
  email: string
  picture?: string
  roles: RoleType[]
  created_at?: string
  last_login?: string
  logins_count?: number
}

export interface MemberWithPermissions extends Member {
  permissions: FGARelation[]
  canView: boolean
  canResetMFA: boolean
  canInvite: boolean
  canAddMember: boolean
  canUpdateRoles: boolean
  canRemoveMember: boolean
  canDelete: boolean
}

export interface MemberAction {
  type: 'invite' | 'add' | 'update_roles' | 'remove' | 'delete' | 'reset_mfa'
  member?: Member
  data?: any
}

export interface MemberInvitation {
  email: string
  roles: RoleType[]
  message?: string
}

export interface MemberUpdate {
  user_id: string
  rolesToAdd: RoleType[]
  rolesToRemove: RoleType[]
}

export interface MemberSearchFilters {
  query?: string
  roles?: RoleType[]
  sortBy?: 'name' | 'email' | 'created_at' | 'last_login'
  sortOrder?: 'asc' | 'desc'
}
