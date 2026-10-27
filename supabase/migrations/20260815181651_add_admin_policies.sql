/*
# Add admin access policies

## Overview
Grants admin users (role = 'admin' in profiles) elevated access to manage
parking slots, view all vehicles, view all violations, and issue violations
to any user. This powers the separate Admin Dashboard.

## Changes
- vehicles: admin can SELECT all rows (in addition to owners)
- violations: admin can SELECT all rows and INSERT for any user
- parking_slots: admin can UPDATE slot status (to toggle available/occupied)

## Security
- Admin check uses: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
- Regular users retain their existing owner-scoped access
- The role column itself is protected by the update policy from the previous migration
*/

-- Vehicles: admin can read all
DROP POLICY IF EXISTS "admin_read_all_vehicles" ON vehicles;
CREATE POLICY "admin_read_all_vehicles" ON vehicles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Violations: admin can read all
DROP POLICY IF EXISTS "admin_read_all_violations" ON violations;
CREATE POLICY "admin_read_all_violations" ON violations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Violations: admin can insert for any user
DROP POLICY IF EXISTS "admin_insert_violations" ON violations;
CREATE POLICY "admin_insert_violations" ON violations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Parking slots: admin can update status
DROP POLICY IF EXISTS "admin_update_parking_slots" ON parking_slots;
CREATE POLICY "admin_update_parking_slots" ON parking_slots
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
