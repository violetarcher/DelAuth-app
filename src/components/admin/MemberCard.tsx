'use client'

import { useState } from 'react'
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
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
  const [copied, setCopied] = useState(false)

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(member.user_id)
      setCopied(true)
      toast.success('User ID copied to clipboard', { duration: 2000 })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy user ID')
    }
  }

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
              </div>

              <p className="text-xs text-gray-500 truncate mt-0.5">{member.email}</p>

              {/* User ID - Compact with Copy Button */}
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-xs text-gray-400 truncate font-mono">
                  {member.user_id}
                </p>
                <button
                  onClick={handleCopyUserId}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-gray-100 transition-colors"
                  title="Copy User ID"
                >
                  {copied ? (
                    <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <ClipboardDocumentIcon className="h-3.5 w-3.5 text-gray-400 hover:text-blue-600" />
                  )}
                </button>
              </div>

              {/* Auth0 RBAC Roles */}
              {member.roles && member.roles.length > 0 && (
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-xs font-medium text-blue-700 flex-shrink-0">
                    Auth0:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {member.roles.map((role) => (
                      <Badge
                        key={`auth0-${role}`}
                        variant={getRoleBadgeVariant(role)}
                        size="sm"
                        className="border-2 border-solid"
                      >
                        {role.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* FGA ReBAC Roles */}
              {member.fgaRoles && member.fgaRoles.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-purple-700 flex-shrink-0">
                    FGA:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {member.fgaRoles.map((role) => (
                      <Badge
                        key={`fga-${role}`}
                        variant={getRoleBadgeVariant(role)}
                        size="sm"
                        className="border-2 border-dashed"
                      >
                        {role.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* No Roles Message */}
              {(!member.roles || member.roles.length === 0) &&
               (!member.fgaRoles || member.fgaRoles.length === 0) && (
                <Badge variant="secondary" size="sm">
                  No roles
                </Badge>
              )}
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
