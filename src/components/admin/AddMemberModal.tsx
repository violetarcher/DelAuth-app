'use client'

import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import toast from 'react-hot-toast'

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  onSuccess: () => void
}

export function AddMemberModal({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
}: AddMemberModalProps) {
  const [email, setEmail] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const availableRoles = ['super_admin', 'admin', 'support', 'member']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Email is required')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/management/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          roles,
          organizationId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add member')
      }

      toast.success('Member added successfully')
      setEmail('')
      setRoles([])
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error adding member:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const toggleRole = (role: string) => {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Existing Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          Add an existing Auth0 user to this organization.
        </p>

        <Input
          label="User Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
          helperText="User must already exist in Auth0"
          required
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Roles (Optional)
          </label>
          <div className="space-y-2">
            {availableRoles.map((role) => (
              <label
                key={role}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
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
            Add Member
          </Button>
        </div>
      </form>
    </Modal>
  )
}
