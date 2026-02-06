'use client'

import { useState } from 'react'
import { Menu } from '@headlessui/react'
import {
  EllipsisVerticalIcon,
  PencilIcon,
  TrashIcon,
  ArrowRightOnRectangleIcon,
  KeyIcon,
} from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import type { Member } from '@/types/member'

interface ActionButtonsProps {
  member: Member
  organizationId: string
  onUpdate: () => void
  onUpdateRoles: () => void
}

export function ActionButtons({
  member,
  organizationId,
  onUpdate,
  onUpdateRoles,
}: ActionButtonsProps) {
  const [loading, setLoading] = useState(false)

  const handleResetMFA = async () => {
    if (!confirm(`Reset MFA for ${member.name || member.email}?`)) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/management/reset-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.user_id,
          organizationId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to reset MFA')
      }

      toast.success('MFA reset successfully')
      onUpdate()
    } catch (error) {
      console.error('Error resetting MFA:', error)
      toast.error('Failed to reset MFA')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!confirm(`Remove ${member.name || member.email} from organization?`)) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/management/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.user_id,
          organizationId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to remove member')
      }

      toast.success('Member removed successfully')
      onUpdate()
    } catch (error) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (
      !confirm(
        `PERMANENTLY DELETE user ${member.name || member.email}? This action cannot be undone!`
      )
    ) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/management/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: member.user_id,
          organizationId,
          deleteUser: true,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete user')
      }

      toast.success('User deleted successfully')
      onUpdate()
    } catch (error) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button
        disabled={loading}
        className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <EllipsisVerticalIcon className="h-5 w-5" />
      </Menu.Button>

      <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
        <div className="py-1">
          <Menu.Item>
            {({ active }) => (
              <button
                onClick={onUpdateRoles}
                className={`${
                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                } group flex w-full items-center px-4 py-2 text-sm`}
              >
                <PencilIcon className="mr-3 h-5 w-5 text-gray-400" />
                Update Roles
              </button>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleResetMFA}
                className={`${
                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                } group flex w-full items-center px-4 py-2 text-sm`}
              >
                <KeyIcon className="mr-3 h-5 w-5 text-gray-400" />
                Reset MFA
              </button>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleRemove}
                className={`${
                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'
                } group flex w-full items-center px-4 py-2 text-sm`}
              >
                <ArrowRightOnRectangleIcon className="mr-3 h-5 w-5 text-gray-400" />
                Remove from Org
              </button>
            )}
          </Menu.Item>

          <Menu.Item>
            {({ active }) => (
              <button
                onClick={handleDelete}
                className={`${
                  active ? 'bg-red-50 text-red-900' : 'text-red-700'
                } group flex w-full items-center px-4 py-2 text-sm`}
              >
                <TrashIcon className="mr-3 h-5 w-5 text-red-400" />
                Delete User
              </button>
            )}
          </Menu.Item>
        </div>
      </Menu.Items>
    </Menu>
  )
}
