'use client'

import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import toast from 'react-hot-toast'

interface InviteModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  onSuccess: () => void
}

export function InviteModal({
  isOpen,
  onClose,
  organizationId,
  onSuccess,
}: InviteModalProps) {
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

      const response = await fetch('/api/management/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          roles,
          organizationId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to invite member')
      }

      toast.success('Invitation sent successfully')
      setEmail('')
      setRoles([])
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error inviting member:', error)
      toast.error('Failed to send invitation')
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
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Member">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="user@example.com"
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
            Send Invitation
          </Button>
        </div>
      </form>
    </Modal>
  )
}
