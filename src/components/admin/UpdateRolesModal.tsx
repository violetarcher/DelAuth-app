'use client'

import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import toast from 'react-hot-toast'
import type { Member } from '@/types/member'

interface UpdateRolesModalProps {
  isOpen: boolean
  onClose: () => void
  member: Member
  organizationId: string
}

export function UpdateRolesModal({
  isOpen,
  onClose,
  member,
  organizationId,
}: UpdateRolesModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>(member.roles || [])
  const [loading, setLoading] = useState(false)

  const availableRoles = ['super_admin', 'admin', 'support', 'member']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const currentRoles = member.roles || []
    const rolesToAdd = selectedRoles.filter((role) => !currentRoles.includes(role as any))
    const rolesToRemove = currentRoles.filter((role) => !selectedRoles.includes(role))

    if (rolesToAdd.length === 0 && rolesToRemove.length === 0) {
      toast.error('No changes to apply')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/management/update-roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.user_id,
          organizationId,
          rolesToAdd,
          rolesToRemove,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update roles')
      }

      toast.success('Roles updated successfully')
      // onSuccess() - Removed: User will manually refresh when ready
      onClose()
    } catch (error) {
      console.error('Error updating roles:', error)
      toast.error('Failed to update roles')
    } finally {
      setLoading(false)
    }
  }

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Member Roles">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-50 rounded-md p-4">
          <p className="text-sm font-medium text-gray-700">
            {member.name || 'No name'}
          </p>
          <p className="text-sm text-gray-500">{member.email}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Roles
          </label>
          <div className="space-y-2">
            {availableRoles.map((role) => (
              <label
                key={role}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedRoles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  {role.replace('_', ' ')}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Update Roles
          </Button>
        </div>
      </form>
    </Modal>
  )
}
