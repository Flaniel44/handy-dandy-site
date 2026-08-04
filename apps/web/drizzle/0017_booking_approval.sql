ALTER TYPE "appointment_status"
ADD VALUE IF NOT EXISTS 'pending_approval' BEFORE 'confirmed';
