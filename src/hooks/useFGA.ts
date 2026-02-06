'use client'

import { useState, useEffect, useCallback } from 'react'

interface FGAPermissions {
  canView: boolean
  canResetMFA: boolean
  canInvite: boolean
  canAddMember: boolean
  canUpdateRoles: boolean
  canRemoveMember: boolean
  canDelete: boolean
}

export function useFGA(userId: string, organizationId: string) {
  const [permissions, setPermissions] = useState<FGAPermissions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/fga/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, organizationId }),
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
  }, [userId, organizationId])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  return {
    permissions,
    loading,
    error,
    refetch: fetchPermissions,
  }
}
