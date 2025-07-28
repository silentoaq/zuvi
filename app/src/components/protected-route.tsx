import type { ReactNode } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"

interface ProtectedRouteProps {
  children: ReactNode
  requirePropertyCredential?: boolean
  requireCitizenCredential?: boolean
}

export function ProtectedRoute({
  children,
  requirePropertyCredential = false,
  requireCitizenCredential = false,
}: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (requireCitizenCredential && !user?.credentials.hasCitizenCredential) {
    return <Navigate to="/credentials-required" replace />
  }

  if (requirePropertyCredential && !user?.credentials.hasPropertyCredential) {
    return <Navigate to="/credentials-required" replace />
  }

  return <>{children}</>
}