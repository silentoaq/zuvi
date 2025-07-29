const API_BASE_URL = '/api'

class ApiService {
  private getAuthHeaders() {
    const token = localStorage.getItem('zuvi-auth-token')
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers
      }
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ 
        error: `HTTP ${response.status}: ${response.statusText}` 
      }))
      throw new Error(error.error || 'API request failed')
    }

    return response.json()
  }

  async getSignMessage(publicKey: string) {
    return this.request<{ message: string; instructions: string }>('/auth/message', {
      method: 'POST',
      body: JSON.stringify({ publicKey })
    })
  }

  async login(publicKey: string, signature: string, message: string) {
    return this.request<{
      success: boolean
      token: string
      user: {
        publicKey: string
        credentialStatus: {
          twfido?: {
            exists: boolean
            address?: string
            data?: any
            expiry?: number
          }
          twland?: {
            exists: boolean
            attestations?: any[]
            count?: number
          }
        }
        isArbitrator?: boolean
      }
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ publicKey, signature, message })
    })
  }

  async verifyToken() {
    return this.request<{
      valid: boolean
      user: {
        publicKey: string
        credentialStatus: any
        isArbitrator?: boolean
      }
    }>('/auth/verify')
  }

  async getCredentials() {
    return this.request<{
      credentialStatus: {
        twfido?: {
          exists: boolean
          address?: string
          data?: any
          expiry?: number
        }
        twland?: {
          exists: boolean
          attestations?: any[]
          count?: number
        }
      }
    }>('/user/credentials')
  }
}

export const apiService = new ApiService()