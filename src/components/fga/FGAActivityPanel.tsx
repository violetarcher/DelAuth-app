'use client'

import { useEffect, useState, useCallback } from 'react'
import { CheckCircleIcon, XCircleIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import { FGARelationshipFlow } from './FGARelationshipFlow'
import { Button } from '../ui/Button'

interface FGAActivity {
  id: string
  timestamp: number
  type: 'check' | 'write' | 'delete'
  operation: string
  user: string
  relation: string
  object: string
  result?: boolean
  error?: string
  metadata?: Record<string, any>
}

export function FGAActivityPanel() {
  const [activities, setActivities] = useState<FGAActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch('/api/fga/activities', {
        // Suppress logging for this high-frequency polling endpoint
        headers: {
          'X-Suppress-Logs': 'true'
        }
      })
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
      // Only log errors, not successful polling
      console.error('Failed to fetch activities:', error)
    }
  }, [])

  const clearActivities = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/fga/activities', {
        method: 'DELETE',
      })
      if (response.ok) {
        setActivities([])
      }
    } catch (error) {
      console.error('Failed to clear activities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchActivities, 2000) // Refresh every 2 seconds (reduced noise)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, fetchActivities])

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  const getTypeIcon = (type: string, result?: boolean, error?: string) => {
    if (error) {
      return <XCircleIcon className="w-4 h-4 text-red-600" />
    }

    if (type === 'check') {
      return result ? (
        <CheckCircleIcon className="w-4 h-4 text-green-600" />
      ) : (
        <XCircleIcon className="w-4 h-4 text-gray-400" />
      )
    }

    if (type === 'write') {
      return <CheckCircleIcon className="w-4 h-4 text-green-600" />
    }

    if (type === 'delete') {
      return <TrashIcon className="w-4 h-4 text-red-600" />
    }

    return <ClockIcon className="w-4 h-4 text-gray-400" />
  }

  const getActivityDescription = (activity: FGAActivity) => {
    const userShort = activity.user.split(':')[1]?.split('|')[1]?.substring(0, 8) || activity.user
    const objShort = activity.object.split(':')[1] || activity.object

    if (activity.type === 'write') {
      return `Created tuple: ${userShort} → ${activity.relation} → ${objShort}`
    }

    if (activity.type === 'delete') {
      return `Deleted tuple: ${userShort} → ${activity.relation} → ${objShort}`
    }

    if (activity.type === 'check') {
      return `Checked: ${userShort} ${activity.relation} ${objShort} ${activity.result ? '✓ granted' : '✗ denied'}`
    }

    return activity.operation
  }

  const latestActivity = activities[0]

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              FGA Activity Monitor
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time authorization operations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="autoRefresh" className="text-xs text-gray-600">
                Auto
              </label>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={clearActivities}
              disabled={loading || activities.length === 0}
            >
              <TrashIcon className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Latest Activity Visualization */}
        {latestActivity ? (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-700 mb-2 flex items-center justify-between">
              <span>Latest Operation:</span>
              <span className="font-mono text-gray-500">
                {formatTimestamp(latestActivity.timestamp)}
              </span>
            </div>
            <FGARelationshipFlow activity={latestActivity} />
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-gray-500">
            <div className="text-center">
              <ClockIcon className="w-10 h-10 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">Waiting for FGA activity...</p>
              <p className="text-xs text-gray-400 mt-1">
                Operations will appear here in real-time
              </p>
            </div>
          </div>
        )}

        {/* Activity History */}
        {activities.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Recent Activity
              </h4>
              <span className="text-xs text-gray-500">
                {activities.length} {activities.length === 1 ? 'event' : 'events'}
              </span>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded text-xs ${
                    index === 0
                      ? 'bg-blue-50 border border-blue-200'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {getTypeIcon(activity.type, activity.result, activity.error)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-gray-500 text-[10px]">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                          activity.type === 'check'
                            ? 'bg-blue-100 text-blue-700'
                            : activity.type === 'write'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {activity.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-700 mt-0.5 font-mono">
                      {getActivityDescription(activity)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
