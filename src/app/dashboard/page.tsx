import { getSession } from '@auth0/nextjs-auth0'
import { redirect } from 'next/navigation'
import { SplitLayout } from '@/components/dashboard/SplitLayout'
import { AdminPanel } from '@/components/dashboard/AdminPanel'
import { ChatPanel } from '@/components/dashboard/ChatPanel'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session?.user) {
    redirect('/api/auth/login')
  }

  const userId = session.user.sub

  // Get organization ID from session or use agency-inc as default
  // In production, you'd let users select from their organizations
  const organizationId = session.user.org_id || 'org_0EgXDHCsaAtl5uhG' // agency-inc

  return (
    <div className="h-screen flex flex-col">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">
              Delegated Administration
            </h1>
            <span className="text-sm text-gray-500">
              {session.user.email}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/profile"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Profile
            </a>
            <a
              href="/api/auth/logout"
              className="text-sm text-red-600 hover:text-red-700"
            >
              Logout
            </a>
          </div>
        </div>
      </nav>

      {/* Main Content - Split Layout */}
      <div className="flex-1 overflow-hidden">
        <SplitLayout
          leftPanel={
            <AdminPanel userId={userId} organizationId={organizationId} />
          }
          rightPanel={
            <ChatPanel userId={userId} organizationId={organizationId} />
          }
        />
      </div>
    </div>
  )
}
