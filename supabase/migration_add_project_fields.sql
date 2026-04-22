-- 🔧 Migration: Add detailed fields to projects table
-- Run this in Supabase SQL Editor if the projects table was created from schema.sql v0.1
-- Safe to run multiple times (uses IF NOT EXISTS / DO blocks)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='client') THEN
    ALTER TABLE projects ADD COLUMN client TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='duration') THEN
    ALTER TABLE projects ADD COLUMN duration TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='size') THEN
    ALTER TABLE projects ADD COLUMN size TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='budget') THEN
    ALTER TABLE projects ADD COLUMN budget TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='building_usage') THEN
    ALTER TABLE projects ADD COLUMN building_usage TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='location') THEN
    ALTER TABLE projects ADD COLUMN location TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='remarks') THEN
    ALTER TABLE projects ADD COLUMN remarks TEXT;
  END IF;
END $$;
