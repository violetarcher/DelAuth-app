'use client'

import { useEffect, useState, useCallback } from 'react'
import { XMarkIcon, CheckCircleIcon, XCircleIcon, ClockIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Modal } from '../ui/Modal'
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

interface FGAActivityMonitorProps {
  isOpen: boolean
  onClose: () => void
}

export function FGAActivityMonitor({
  isOpen,
  onClose,
}: FGAActivityMonitorProps) {
  const [activities, setActivities] = useState<FGAActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchActivities = useCallback(async () => {
    try {
      const response = await fetch('/api/fga/activities')
      if (response.ok) {
        const data = await response.json()
        setActivities(data.activities || [])
      }
    } catch (error) {
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
    if (isOpen) {
      fetchActivities()
    }
  }, [isOpen, fetchActivities])

  useEffect(() => {
    if (isOpen && autoRefresh) {
      const interval = setInterval(fetchActivities, 1000) // Refresh every second
      return () => clearInterval(interval)
    }
  }, [isOpen, autoRefresh, fetchActivities])

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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'check':
        return 'bg-blue-100 text-blue-800'
      case 'write':
        return 'bg-green-100 text-green-800'
      case 'delete':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string, result?: boolean, error?: string) => {
    if (error) {
      return <XCircleIcon className="w-5 h-5 text-red-600" />
    }

    if (type === 'check') {
      return result ? (
        <CheckCircleIcon className="w-5 h-5 text-green-600" />
      ) : (
        <XCircleIcon className="w-5 h-5 text-gray-400" />
      )
    }

    return <ClockIcon className="w-5 h-5 text-gray-400" />
  }

  const truncate = (str: string, length: number = 30) => {
    if (str.length <= length) return str
    return str.substring(0, length) + '...'
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="FGA Activity Monitor"
      size="xl"
    >
      <div className="flex flex-col h-[70vh]">
        {/* Controls */}
        <div className="flex items-center justify-between mb-4 pb-4 border-b">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="autoRefresh" className="text-sm text-gray-700">
                Auto-refresh
              </label>
            </div>
            <div className="text-sm text-gray-500">
              {activities.length} {activities.length === 1 ? 'activity' : 'activities'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={fetchActivities}
              disabled={loading}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={clearActivities}
              disabled={loading || activities.length === 0}
            >
              <TrashIcon className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Activity List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {activities.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <ClockIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p className="text-sm">No FGA activities yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Activities will appear here as they occur
                </p>
              </div>
            </div>
          ) : (
            activities.map((activity) => (
              <div
                key={activity.id}
                className={`p-3 rounded-lg border ${
                  activity.error
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getTypeIcon(activity.type, activity.result, activity.error)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(
                          activity.type
                        )}`}
                      >
                        {activity.type.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTimestamp(activity.timestamp)}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-gray-900 mb-1">
                      {activity.operation}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">User:</span>
                        <p className="font-mono text-gray-900 truncate">
                          {truncate(activity.user, 25)}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Relation:</span>
                        <p className="font-mono text-gray-900">
                          {activity.relation}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Object:</span>
                        <p className="font-mono text-gray-900 truncate">
                          {truncate(activity.object, 25)}
                        </p>
                      </div>
                    </div>

                    {activity.error && (
                      <div className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded">
                        <span className="font-medium">Error:</span> {activity.error}
                      </div>
                    )}

                    {activity.type === 'check' && activity.result !== undefined && (
                      <div className="mt-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            activity.result
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {activity.result ? '✓ Allowed' : '✗ Denied'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div>
              Real-time monitoring of all FGA check, write, and delete operations
            </div>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
