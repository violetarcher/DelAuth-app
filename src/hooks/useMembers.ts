'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Member } from '@/types/member'

export function useMembers(organizationId: string) {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/management/members?organizationId=${organizationId}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch members')
      }

      const data = await response.json()
      setMembers(data.members || [])
    } catch (err) {
      console.error('Error fetching members:', err)
      setError('Failed to load members')
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  return {
    members,
    loading,
    error,
    refetch: fetchMembers,
  }
}
