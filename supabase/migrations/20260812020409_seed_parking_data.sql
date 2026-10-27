/*
# Seed Parking Areas and Slots

## Overview
Populates the 10 parking areas for ESSU campus with their slots.
Each area gets a realistic set of slots with a mix of available/occupied
status so the app demonstrates available, occupied, and full states.

## Parking Areas (10 total)
1. P01 - Administration Building Parking
2. P02 - College of Engineering Parking
3. P03 - College of Business Parking
4. P04 - College of Education Parking
5. P05 - College of Arts Parking
6. P06 - College of Sciences Parking
7. P07 - Library Building Parking
8. P08 - Student Center Parking
9. P09 - Gymnasium Parking
10. P10 - Faculty Center Parking

## Notes
- Uses ON CONFLICT to be idempotent (safe to re-run)
- Slot statuses are randomized with a realistic distribution
- Camera URLs are placeholder paths ready for real feeds
*/

INSERT INTO parking_areas (name, code, description, location, department, total_slots, latitude, longitude, camera_url, is_active)
VALUES
  ('Administration Building Parking', 'P01', 'Main administration parking near the entrance gate', 'East Gate, Building A', 'Administration', 40, 14.0783, 121.5545, '/camera/p01/feed', true),
  ('College of Engineering Parking', 'P02', 'Parking for Engineering students and faculty', 'Engineering Building', 'College of Engineering', 60, 14.0788, 121.5550, '/camera/p02/feed', true),
  ('College of Business Parking', 'P03', 'Parking for Business students and faculty', 'Business Building', 'College of Business Administration', 50, 14.0790, 121.5540, '/camera/p03/feed', true),
  ('College of Education Parking', 'P04', 'Parking for Education students and faculty', 'Education Building', 'College of Education', 35, 14.0780, 121.5560, '/camera/p04/feed', true),
  ('College of Arts Parking', 'P05', 'Parking for Arts and Humanities students', 'Arts Building', 'College of Arts and Sciences', 30, 14.0785, 121.5565, '/camera/p05/feed', true),
  ('College of Sciences Parking', 'P06', 'Parking for Sciences students and faculty', 'Sciences Building', 'College of Arts and Sciences', 45, 14.0792, 121.5555, '/camera/p06/feed', true),
  ('Library Building Parking', 'P07', 'Parking near the main library', 'Central Library', 'Library Services', 25, 14.0787, 121.5558, '/camera/p07/feed', true),
  ('Student Center Parking', 'P08', 'Parking for the student center and cafeteria', 'Student Center', 'Student Affairs', 55, 14.0782, 121.5552, '/camera/p08/feed', true),
  ('Gymnasium Parking', 'P09', 'Parking for the gymnasium and sports complex', 'Sports Complex', 'Athletics Department', 40, 14.0795, 121.5548, '/camera/p09/feed', true),
  ('Faculty Center Parking', 'P10', 'Reserved parking for faculty members', 'Faculty Center', 'Faculty Affairs', 20, 14.0786, 121.5543, '/camera/p10/feed', true)
ON CONFLICT (code) DO NOTHING;

-- Generate slots for each parking area
DO $$
DECLARE
  area RECORD;
  i integer;
  status text;
  rand_val double precision;
BEGIN
  FOR area IN SELECT id, total_slots FROM parking_areas LOOP
    FOR i IN 1..area.total_slots LOOP
      rand_val := random();
      IF rand_val < 0.35 THEN
        status := 'available';
      ELSIF rand_val < 0.95 THEN
        status := 'occupied';
      ELSE
        status := 'available';
      END IF;
      
      INSERT INTO parking_slots (area_id, slot_number, status)
      VALUES (area.id, i, status)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;