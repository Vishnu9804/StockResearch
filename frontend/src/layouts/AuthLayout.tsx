import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'

export function AuthLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 select-none font-sans antialiased text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <div key={location.pathname} className="animate-fade-in-up">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

export default AuthLayout
