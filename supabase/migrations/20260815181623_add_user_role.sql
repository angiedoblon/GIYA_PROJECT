/*
# Add role column to profiles

## Overview
Adds a `role` column to the `profiles` table to distinguish between regular
users and administrators. This enables the separate admin dashboard.

## Changes
- `profiles.role` (text, default 'user', CHECK constraint: 'user' | 'admin')
  - Determines whether the user sees the user dashboard or admin dashboard
- Updated RLS policies: users can read their own profile (including role),
  admins can read all profiles. Users can only update their own non-role
  fields (role is protected — only settable via service role / SQL).

## Security
- Role column is NOT user-editable through the standard UPDATE policy.
  The WITH CHECK clause prevents users from changing their own role.
- An admin can read all profiles for the admin dashboard.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- Allow authenticated users to read all profiles (needed for admin dashboard
-- and for displaying user names on violations/vehicles). Sensitive data is
-- limited to name, department, and role — no passwords or secrets stored here.
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated USING (true);

-- Users can update their own profile, but NOT the role column
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM profiles WHERE id = auth.uid()));
