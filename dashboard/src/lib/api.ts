export interface User {
  id: string;
  email: string;
  plan: 'FREE' | 'PRO';
  createdAt: string;
  firstName?: string;
  lastName?: string;
}

export interface Subdomain {
  id: string;
  userId: string;
  hostname: string;
  status: 'ACTIVE' | 'RESERVED' | 'SUSPENDED';
  createdAt: string;
}

export interface ApiKey {
  id: string;
  createdAt: string;
  key?: string; // only present on generation
}

export interface Tunnel {
  id: string;
  userId: string;
  subdomainId: string;
  localPort: number;
  status: 'ONLINE' | 'OFFLINE';
  connectedAt: string | null;
  subdomain: {
    hostname: string;
  };
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/') ? path : `/api/${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorMessage = 'An error occurred';
    try {
      const data = await response.json();
      errorMessage = data.message || errorMessage;
    } catch (_) {}
    throw new ApiError(errorMessage, response.status);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  // Auth
  async register(email: string, password: string, firstName?: string, lastName?: string): Promise<User> {
    return apiFetch<User>('auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    return apiFetch<{ user: User; token: string }>('auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>('auth/logout', {
      method: 'POST',
    });
  },

  async me(): Promise<User> {
    return apiFetch<User>('auth/me');
  },

  // Subdomains
  async listSubdomains(): Promise<Subdomain[]> {
    return apiFetch<Subdomain[]>('subdomains');
  },

  async claimSubdomain(hostname: string): Promise<Subdomain> {
    return apiFetch<Subdomain>('subdomains', {
      method: 'POST',
      body: JSON.stringify({ hostname }),
    });
  },

  async releaseSubdomain(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`subdomains/${id}`, {
      method: 'DELETE',
    });
  },

  // API Keys
  async listApiKeys(): Promise<ApiKey[]> {
    return apiFetch<ApiKey[]>('api-keys');
  },

  async generateApiKey(): Promise<ApiKey> {
    return apiFetch<ApiKey>('api-keys', {
      method: 'POST',
    });
  },

  async revokeApiKey(id: string): Promise<{ success: boolean }> {
    return apiFetch<{ success: boolean }>(`api-keys/${id}`, {
      method: 'DELETE',
    });
  },

  // Tunnels
  async listTunnels(): Promise<Tunnel[]> {
    return apiFetch<Tunnel[]>('tunnels');
  },
};
