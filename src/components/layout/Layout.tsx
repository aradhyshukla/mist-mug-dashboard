import { Outlet, useLocation } from 'react-router-dom'

export function Layout() {
  const location = useLocation()
  return (
    <div className="flex h-screen bg-paper">
      <div className="flex flex-col">
        <Outlet context={{ activePath: location.pathname }} />
      </div>
    </div>
  )
}
