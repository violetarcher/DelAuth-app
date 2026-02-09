'use client'

import { useState } from 'react'
import { CheckCircleIcon } from '@heroicons/react/24/solid'

interface Role {
  name: string
  label: string
  description: string
  color: string
}

const ROLES: Role[] = [
  {
    name: 'super_admin',
    label: 'Super Admin',
    description: 'Full control (all operations including delete)',
    color: 'bg-purple-100 hover:bg-purple-200 border-purple-300 text-purple-900',
  },
  {
    name: 'admin',
    label: 'Admin',
    description: 'All operations except delete',
    color: 'bg-blue-100 hover:bg-blue-200 border-blue-300 text-blue-900',
  },
  {
    name: 'support',
    label: 'Support',
    description: 'View members and reset MFA only',
    color: 'bg-green-100 hover:bg-green-200 border-green-300 text-green-900',
  },
  {
    name: 'member',
    label: 'Member',
    description: 'Regular user with no admin permissions',
    color: 'bg-gray-100 hover:bg-gray-200 border-gray-300 text-gray-900',
  },
]

interface RoleSelectorProps {
  onSelect: (roles: string[]) => void
}

export function RoleSelector({ onSelect }: RoleSelectorProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])

  const toggleRole = (roleName: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleName)
        ? prev.filter((r) => r !== roleName)
        : [...prev, roleName]
    )
  }

  const handleConfirm = () => {
    if (selectedRoles.length > 0) {
      onSelect(selectedRoles)
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="text-sm text-gray-700 font-medium">
        Select role(s):
      </div>

      <div className="grid grid-cols-1 gap-2">
        {ROLES.map((role) => (
          <button
            key={role.name}
            onClick={() => toggleRole(role.name)}
            className={`
              relative text-left px-4 py-3 rounded-lg border-2 transition-all
              ${
                selectedRoles.includes(role.name)
                  ? `${role.color} border-opacity-100 ring-2 ring-offset-1 ring-blue-400`
                  : `${role.color} border-opacity-50`
              }
            `}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {selectedRoles.includes(role.name) ? (
                  <CheckCircleIcon className="w-5 h-5 text-blue-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">{role.label}</div>
                <div className="text-xs opacity-80 mt-0.5">
                  {role.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handleConfirm}
        disabled={selectedRoles.length === 0}
        className={`
          w-full px-4 py-2 rounded-lg font-medium text-sm transition-colors
          ${
            selectedRoles.length > 0
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {selectedRoles.length > 0
          ? `Assign ${selectedRoles.length} Role${selectedRoles.length > 1 ? 's' : ''}`
          : 'Select at least one role'}
      </button>
    </div>
  )
}
