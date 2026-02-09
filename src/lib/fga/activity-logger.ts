/**
 * FGA Activity Logger - Tracks all FGA operations in real-time
 */

export interface FGAActivity {
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

class FGAActivityLogger {
  private activities: FGAActivity[] = []
  private listeners: Set<(activity: FGAActivity) => void> = new Set()
  private maxActivities = 100
  private storageKey = 'fga_activities'

  constructor() {
    // Load activities from localStorage on initialization
    this.loadFromStorage()
  }

  /**
   * Load activities from localStorage
   */
  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(this.storageKey)
        if (stored) {
          this.activities = JSON.parse(stored)
          console.log(`📦 Loaded ${this.activities.length} FGA activities from localStorage`)
        }
      } catch (error) {
        console.error('Failed to load FGA activities from localStorage:', error)
        this.activities = []
      }
    }
  }

  /**
   * Save activities to localStorage
   */
  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.activities))
      } catch (error) {
        console.error('Failed to save FGA activities to localStorage:', error)
      }
    }
  }

  /**
   * Log an FGA check operation
   */
  logCheck(
    user: string,
    relation: string,
    object: string,
    result: boolean,
    metadata?: Record<string, any>
  ) {
    const activity: FGAActivity = {
      id: `check-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'check',
      operation: 'Check Permission',
      user,
      relation,
      object,
      result,
      metadata,
    }

    this.addActivity(activity)
  }

  /**
   * Log an FGA write operation
   */
  logWrite(
    user: string,
    relation: string,
    object: string,
    metadata?: Record<string, any>
  ) {
    const activity: FGAActivity = {
      id: `write-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'write',
      operation: 'Write Tuple',
      user,
      relation,
      object,
      metadata,
    }

    this.addActivity(activity)
  }

  /**
   * Log an FGA delete operation
   */
  logDelete(
    user: string,
    relation: string,
    object: string,
    metadata?: Record<string, any>
  ) {
    const activity: FGAActivity = {
      id: `delete-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: 'delete',
      operation: 'Delete Tuple',
      user,
      relation,
      object,
      metadata,
    }

    this.addActivity(activity)
  }

  /**
   * Log an error
   */
  logError(
    type: 'check' | 'write' | 'delete',
    user: string,
    relation: string,
    object: string,
    error: string
  ) {
    const activity: FGAActivity = {
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type,
      operation: `${type} Error`,
      user,
      relation,
      object,
      error,
    }

    this.addActivity(activity)
  }

  /**
   * Add activity to log and notify listeners
   */
  private addActivity(activity: FGAActivity) {
    this.activities.unshift(activity) // Add to beginning

    // Keep only last N activities
    if (this.activities.length > this.maxActivities) {
      this.activities = this.activities.slice(0, this.maxActivities)
    }

    // Save to localStorage for persistence
    this.saveToStorage()

    // Notify all listeners
    this.listeners.forEach((listener) => listener(activity))
  }

  /**
   * Subscribe to activity updates
   */
  subscribe(listener: (activity: FGAActivity) => void): () => void {
    this.listeners.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get all activities
   */
  getActivities(): FGAActivity[] {
    return [...this.activities]
  }

  /**
   * Clear all activities
   */
  clear() {
    this.activities = []
    this.saveToStorage() // Persist the cleared state
    console.log('🗑️ FGA activities cleared and localStorage updated')
  }
}

// Singleton instance
export const fgaActivityLogger = new FGAActivityLogger()
