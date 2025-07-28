const API_BASE_URL = '/api'

export class ApiService {
  private static getToken(): string | null {
    return localStorage.getItem('zuvi-auth')
      ? JSON.parse(localStorage.getItem('zuvi-auth')!).state.token
      : null
  }

  private static async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || 'Request failed')
    }

    return response.json()
  }

  static async generateLoginMessage(publicKey: string) {
    return this.request<{ message: string; instructions: string }>('/auth/message', {
      method: 'POST',
      body: JSON.stringify({ publicKey }),
    })
  }

  static async login(publicKey: string, did: string, signature: string, message: string) {
    return this.request<{
      success: boolean
      token: string
      user: {
        publicKey: string
        did: string
        credentials: {
          hasPropertyCredential: boolean
          hasCitizenCredential: boolean
          propertyCount: number
        }
      }
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ publicKey, did, signature, message }),
    })
  }

  static async verifyToken() {
    return this.request<{
      valid: boolean
      user?: {
        publicKey: string
        did: string
        credentials: {
          hasPropertyCredential: boolean
          hasCitizenCredential: boolean
          propertyCount: number
        }
      }
    }>('/auth/verify')
  }
}