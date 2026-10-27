/*
# ESSU Smart Parking Guidance - Core Schema

## Overview
Creates the complete database schema for the ESSU Smart Parking Guidance App.
The app helps drivers find available parking across the ESSU campus, register
their vehicles, and receive parking violation notifications.

## New Tables

### profiles
Extends Supabase auth.users with app-specific user data.
- `id` (uuid, PK, references auth.users) - links to auth account
- `full_name` (text) - display name
- `phone` (text) - contact number
- `college_department` (text) - user's department (for students/faculty)
- `notification_enabled` (boolean, default true) - notification preference
- `violation_alerts` (boolean, default true) - violation alert preference
- `created_at` (timestamptz)

### vehicles
Vehicles registered by users.
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users ON DELETE CASCADE)
- `plate_number` (text, not null) - license plate
- `make` (text) - vehicle make (e.g. Toyota)
- `model` (text) - vehicle model
- `color` (text) - vehicle color
- `type` (text) - 'private' | 'public' | 'essu-owned'
- `registration_status` (text) - 'registered' | 'unregistered'
- `is_primary` (boolean, default false) - primary vehicle flag
- `created_at` (timestamptz)

### parking_areas
The 10 parking areas on campus.
- `id` (uuid, PK)
- `name` (text, not null) - display name
- `code` (text, unique, not null) - short code (e.g. P01)
- `description` (text)
- `location` (text) - general location text
- `department` (text) - nearest college department
- `total_slots` (integer, not null) - total capacity
- `latitude` (double precision) - for navigation
- `longitude` (double precision) - for navigation
- `camera_url` (text) - camera feed URL (connectable later)
- `is_active` (boolean, default true)
- `created_at` (timestamptz)

### parking_slots
Individual slots within each parking area.
- `id` (uuid, PK)
- `area_id` (uuid, references parking_areas ON DELETE CASCADE)
- `slot_number` (integer, not null)
- `status` (text, not null default 'available') - 'available' | 'occupied'
- `updated_at` (timestamptz)

### violations
Parking violations for a user's vehicle.
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users ON DELETE CASCADE)
- `vehicle_id` (uuid, references vehicles ON DELETE SET NULL)
- `plate_number` (text, not null)
- `area_id` (uuid, references parking_areas ON DELETE SET NULL)
- `area_name` (text) - denormalized for display
- `violation_type` (text, not null) - e.g. 'Wrong Parking', 'Over Time', 'No Permit'
- `violation_count` (integer, not null default 1) - 1st, 2nd, 3rd, then warning
- `status` (text, not null default 'active') - 'active' | 'warning'
- `description` (text)
- `created_at` (timestamptz)

### notifications
In-app notifications for users.
- `id` (uuid, PK)
- `user_id` (uuid, references auth.users ON DELETE CASCADE)
- `title` (text, not null)
- `message` (text, not null)
- `type` (text, not null) - 'violation' | 'general' | 'parking'
- `is_read` (boolean, default false)
- `created_at` (timestamptz)

## Security (RLS)
All tables have RLS enabled. Profiles, vehicles, violations, and notifications
are owner-scoped (user can only see/modify their own rows). Parking areas and
parking slots are public read (all authenticated users can see parking info)
but only modifiable via service role (server-side sensor integration later).
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  college_department text,
  notification_enabled boolean NOT NULL DEFAULT true,
  violation_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles
  FOR DELETE TO authenticated USING (auth.uid() = id);

-- ============ VEHICLES ============
CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  plate_number text NOT NULL,
  make text,
  model text,
  color text,
  type text NOT NULL DEFAULT 'private' CHECK (type IN ('private', 'public', 'essu-owned')),
  registration_status text NOT NULL DEFAULT 'registered' CHECK (registration_status IN ('registered', 'unregistered')),
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_vehicles" ON vehicles;
CREATE POLICY "select_own_vehicles" ON vehicles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_vehicles" ON vehicles;
CREATE POLICY "insert_own_vehicles" ON vehicles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_vehicles" ON vehicles;
CREATE POLICY "update_own_vehicles" ON vehicles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_vehicles" ON vehicles;
CREATE POLICY "delete_own_vehicles" ON vehicles
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ PARKING AREAS (public read) ============
CREATE TABLE IF NOT EXISTS parking_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE NOT NULL,
  description text,
  location text,
  department text,
  total_slots integer NOT NULL DEFAULT 0,
  latitude double precision,
  longitude double precision,
  camera_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parking_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_parking_areas" ON parking_areas;
CREATE POLICY "read_parking_areas" ON parking_areas
  FOR SELECT TO authenticated USING (true);

-- ============ PARKING SLOTS (public read) ============
CREATE TABLE IF NOT EXISTS parking_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id uuid NOT NULL REFERENCES parking_areas(id) ON DELETE CASCADE,
  slot_number integer NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied')),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE parking_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_parking_slots" ON parking_slots;
CREATE POLICY "read_parking_slots" ON parking_slots
  FOR SELECT TO authenticated USING (true);

-- ============ VIOLATIONS ============
CREATE TABLE IF NOT EXISTS violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  plate_number text NOT NULL,
  area_id uuid REFERENCES parking_areas(id) ON DELETE SET NULL,
  area_name text,
  violation_type text NOT NULL,
  violation_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'warning')),
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_violations" ON violations;
CREATE POLICY "select_own_violations" ON violations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_violations" ON violations;
CREATE POLICY "insert_own_violations" ON violations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_violations" ON violations;
CREATE POLICY "update_own_violations" ON violations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_violations" ON violations;
CREATE POLICY "delete_own_violations" ON violations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('violation', 'general', 'parking')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
CREATE POLICY "insert_own_notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_parking_slots_area_id ON parking_slots(area_id);
CREATE INDEX IF NOT EXISTS idx_violations_user_id ON violations(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Auto-update updated_at on parking_slots
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parking_slots_updated ON parking_slots;
CREATE TRIGGER trg_parking_slots_updated
  BEFORE UPDATE ON parking_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();