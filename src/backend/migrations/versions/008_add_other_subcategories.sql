-- Migration: Add "Other" subcategory to all categories
-- Description: Ensures all categories have an "Other" subcategory for fallback scenarios in UI selection logic

INSERT OR IGNORE INTO Categories (category, subcategory)
VALUES
  ('Business Development', 'Other'),
  ('Development', 'Other'),
  ('Economy', 'Other'),
  ('Outreach', 'Other'),
  ('Research', 'Other'),
  ('Talent & Education', 'Other');
