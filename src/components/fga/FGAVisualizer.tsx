'use client'

import { useEffect, useState } from 'react'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/solid'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface FGAPermissions {
  canView: boolean
  canResetMFA: boolean
  canInvite: boolean
  canAddMember: boolean
  canUpdateRoles: boolean
  canRemoveMember: boolean
  canDelete: boolean
}

interface FGAVisualizerProps {
  userId: string
  organizationId: string
  refreshTrigger?: number
}

export function FGAVisualizer({
  userId,
  organizationId,
  refreshTrigger = 0,
}: FGAVisualizerProps) {
  const [permissions, setPermissions] = useState<FGAPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPermissions() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch('/api/fga/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            organizationId,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch permissions')
        }

        const data = await response.json()
        setPermissions(data.permissions)
      } catch (err) {
        console.error('Error fetching FGA permissions:', err)
        setError('Failed to load permissions')
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [userId, organizationId, refreshTrigger])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!permissions) {
    return null
  }

  const permissionList = [
    { key: 'canView', label: 'View Members', value: permissions.canView },
    { key: 'canResetMFA', label: 'Reset MFA', value: permissions.canResetMFA },
    { key: 'canInvite', label: 'Invite Members', value: permissions.canInvite },
    { key: 'canAddMember', label: 'Add Members', value: permissions.canAddMember },
    {
      key: 'canUpdateRoles',
      label: 'Update Roles',
      value: permissions.canUpdateRoles,
    },
    {
      key: 'canRemoveMember',
      label: 'Remove Members',
      value: permissions.canRemoveMember,
    },
    { key: 'canDelete', label: 'Delete Members', value: permissions.canDelete },
  ]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        FGA Permissions
      </h3>

      <div className="space-y-3">
        {permissionList.map((permission) => (
          <div
            key={permission.key}
            className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md"
          >
            <span className="text-sm font-medium text-gray-700">
              {permission.label}
            </span>
            {permission.value ? (
              <CheckCircleIcon className="w-5 h-5 text-green-600" />
            ) : (
              <XCircleIcon className="w-5 h-5 text-gray-400" />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          User ID: <span className="font-mono">{userId.substring(0, 20)}...</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Organization ID:{' '}
          <span className="font-mono">{organizationId.substring(0, 20)}...</span>
        </p>
      </div>
    </div>
  )
}
