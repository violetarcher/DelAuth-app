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
      <Card padding="sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar - Smaller */}
            {member.picture ? (
              <img
                src={member.picture}
                alt={member.name || member.email}
                className="h-10 w-10 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-semibold text-base">
                  {(member.name || member.email).charAt(0).toUpperCase()}
                </span>
              </div>
            )}

            {/* Member Info - More Compact */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {member.name || 'No name'}
                </h3>
                {/* Roles - Inline */}
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

              <p className="text-xs text-gray-500 truncate mt-0.5">{member.email}</p>

              {/* User ID - Compact */}
              <p className="text-xs text-gray-400 truncate font-mono">
                {member.user_id}
              </p>
            </div>
          </div>

          {/* Action Buttons - More Compact */}
          <div className="flex-shrink-0">
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
