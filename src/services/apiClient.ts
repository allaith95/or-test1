// API Client for Server-Authoritative v2
// Used in parallel with vpsSyncEngine during migration.

const API_BASE = '/api/v2';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      return {
        success: false,
        error: `HTTP ${res.status}: ${errBody.slice(0, 100)}`,
      };
    }

    return await res.json();
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error',
    };
  }
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  governorate: string;
  type: string;
  boxSypBalance: number;
  boxUsdBalance: number;
  isActive: boolean;
  [key: string]: any;
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: string;
  branchId: string | null;
  phone: string;
  isActive: boolean;
  [key: string]: any;
}

export interface Parcel {
  id: string;
  trackingNumber: string;
  originBranchId: string;
  destinationHubId: string;
  handlingStatus: string;
  paymentType: string;
  shippingCost: number;
  codAmount: number;
  [key: string]: any;
}

export const apiClient = {
  // Branches
  async getBranches(): Promise<ApiResponse<Branch[]>> {
    return request<Branch[]>('/branches');
  },

  // Users
  async getUsers(params?: {
    branchId?: string;
    role?: string;
    q?: string;
  }): Promise<ApiResponse<User[]>> {
    const query = new URLSearchParams();
    if (params?.branchId) query.set('branchId', params.branchId);
    if (params?.role) query.set('role', params.role);
    if (params?.q) query.set('q', params.q);
    const queryString = query.toString();
    return request<User[]>(`/users${queryString ? `?${queryString}` : ''}`);
  },

  // Parcels
  async getParcels(params?: {
    page?: number;
    limit?: number;
    status?: string;
    originBranchId?: string;
    destinationHubId?: string;
    q?: string;
  }): Promise<ApiResponse<Parcel[]>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.status) query.set('status', params.status);
    if (params?.originBranchId) query.set('originBranchId', params.originBranchId);
    if (params?.destinationHubId) query.set('destinationHubId', params.destinationHubId);
    if (params?.q) query.set('q', params.q);
    const queryString = query.toString();
    return request<Parcel[]>(`/parcels${queryString ? `?${queryString}` : ''}`);
  },
};
