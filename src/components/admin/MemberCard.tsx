'use client'

import { useState } from 'react'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ActionButtons } from './ActionButtons'
import { UpdateRolesModal } from './UpdateRolesModal'
import type { Member } from '@/types/member'

interface MemberCardProps {
  member: Member
  organizationId: string
  onUpdate: () => void
}

export function MemberCard({ member, organizationId, onUpdate }: MemberCardProps) {
  const [updateRolesModalOpen, setUpdateRolesModalOpen] = useState(false)

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'danger'
      case 'admin':
        return 'warning'
      case 'support':
        return 'info'
      default:
        return 'secondary'
    }
  }

  return (
    <>
      <Card padding="md">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4 flex-1">
            {/* Avatar */}
            {member.picture ? (
              <img
                src={member.picture}
                alt={member.name || member.email}
                className="h-12 w-12 rounded-full"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 font-semibold text-lg">
                  {(member.name || member.email).charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Member Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {member.name || 'No name'}
              </h3>
              <p className="text-sm text-gray-500 truncate">{member.email}</p>

              {/* Roles */}
              <div className="mt-2 flex flex-wrap gap-2">
                {member.roles && member.roles.length > 0 ? (
                  member.roles.map((role) => (
                    <Badge
                      key={role}
                      variant={getRoleBadgeVariant(role)}
                      size="sm"
                    >
                      {role.replace('_', ' ')}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="secondary" size="sm">
                    No roles
                  </Badge>
                )}
              </div>

              {/* Additional Info */}
              {(member.last_login || member.logins_count !== undefined) && (
                <div className="mt-2 text-xs text-gray-400">
                  {member.logins_count !== undefined && (
                    <span>Logins: {member.logins_count}</span>
                  )}
                  {member.last_login && member.logins_count !== undefined && (
                    <span className="mx-2">•</span>
                  )}
                  {member.last_login && (
                    <span>
                      Last login: {new Date(member.last_login).toLocaleDateString()}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="ml-4">
            <ActionButtons
              member={member}
              organizationId={organizationId}
              onUpdate={onUpdate}
              onUpdateRoles={() => setUpdateRolesModalOpen(true)}
            />
          </div>
        </div>
      </Card>

      {/* Update Roles Modal */}
      <UpdateRolesModal
        isOpen={updateRolesModalOpen}
        onClose={() => setUpdateRolesModalOpen(false)}
        member={member}
        organizationId={organizationId}
        onSuccess={onUpdate}
      />
    </>
  )
}
