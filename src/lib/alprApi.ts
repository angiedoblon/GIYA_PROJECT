// src/lib/alprApi.ts

const ALPR_API_URL = "http://127.0.0.1:8000";
export interface AccessLog {
  id?: number;
  plate_number?: string;
  status?: string;
  timestamp?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface AccessLogsResponse {
  logs?: AccessLog[];
}

/**
 * Get access logs from the ALPR backend.
 */
export async function getAccessLogs(): Promise<AccessLog[]> {
  try {
    const response = await fetch(`${ALPR_API_URL}/access-logs`);

    if (!response.ok) {
      throw new Error(`ALPR API error: ${response.status}`);
    }

    const data: unknown = await response.json();

    // API directly returns an array
    if (Array.isArray(data)) {
      return data as AccessLog[];
    }

    // API returns { logs: [...] }
    if (
      typeof data === "object" &&
      data !== null &&
      "logs" in data
    ) {
      const result = data as AccessLogsResponse;
      return result.logs ?? [];
    }

    return [];
  } catch (error) {
    console.error("Failed to get access logs:", error);
    return [];
  }
}

/**
 * Check whether the ALPR backend is reachable.
 */
export async function checkAlprGateway(): Promise<boolean> {
  try {
    const response = await fetch(`${ALPR_API_URL}/health`);

    return response.ok;
  } catch (error) {
    console.error("ALPR gateway is unreachable:", error);
    return false;
  }
}

/**
 * Get the ALPR backend URL.
 */
export function getAlprApiUrl(): string {
  return ALPR_API_URL;
}