export type UserRole = 'user' | 'admin';
export type VehicleType = 'private' | 'public' | 'essu-owned';
export type RegistrationStatus = 'registered' | 'unregistered';
export type SlotStatus = 'available' | 'occupied';
export type ViolationStatus = 'active' | 'warning';
export type NotificationType = 'violation' | 'general' | 'parking';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  college_department: string | null;
  notification_enabled: boolean;
  violation_alerts: boolean;
  role: UserRole;
  created_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  plate_number: string;
  make: string | null;
  model: string | null;
  color: string | null;
  type: VehicleType;
  registration_status: RegistrationStatus;
  is_primary: boolean;
  created_at: string;
}

export interface ParkingArea {
  id: string;
  name: string;
  code: string;
  description: string | null;
  location: string | null;
  department: string | null;
  total_slots: number;
  latitude: number | null;
  longitude: number | null;
  camera_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ParkingSlot {
  id: string;
  area_id: string;
  slot_number: number;
  status: SlotStatus;
  updated_at: string;
}

export interface Violation {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  plate_number: string;
  area_id: string | null;
  area_name: string | null;
  violation_type: string;
  violation_count: number;
  status: ViolationStatus;
  description: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export interface ParkingAreaWithStats extends ParkingArea {
  available_slots: number;
  occupied_slots: number;
}
