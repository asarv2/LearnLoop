-- Insert statements for 2 scenarios with field information

-- First, let's create the fields for the interview scenario
INSERT INTO fields (id, name, description, field_type) VALUES
-- Interview scenario fields
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Candidate Information', 'Enter candidate''s full name', 'text'),
('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Position Type', 'e.g., Marketing Manager, Software Engineer, Sales Representative', 'text'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Position Level', 'Select the appropriate experience level', 'categorical'),
('d4e5f6a7-b8c9-0123-4def-456789012345', 'Candidate Resume', 'Upload the candidate''s resume document', 'document'),
('e5f6a7b8-c9d0-1234-ef01-567890123456', 'Voice', 'Select the interviewer persona voice', 'persona');

-- Create the interview scenario
INSERT INTO scenarios (id, title, description, training_id, field_ids) VALUES
('f6a7b8c9-d0e1-2345-6789-678901234567', 'Interview Training', 'Interview an AI candidate to help you practice your interview skills.', 
 '81233636-cf63-465f-b5d5-6d26de3b94e9',
 ARRAY[
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 
    'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid, 
    'c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, 
    'd4e5f6a7-b8c9-0123-4def-456789012345'::uuid, 
    'e5f6a7b8-c9d0-1234-ef01-567890123456'::uuid
 ]);
-- Create parameters for the categorical field (Position Level)
INSERT INTO parameters (field_id, name, description, value) VALUES
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Entry', 'New graduate or someone still new in the industry', 'Entry'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Intermediate', 'Someone who''s been in the industry for a few years', 'Intermediate'),
('c3d4e5f6-a7b8-9012-cdef-345678901234', 'Advanced', 'Many years of experience, likely a senior professional or leadership role', 'Advanced');

-- Create fields for the Employee Offboarding Training scenario
INSERT INTO fields (id, name, description, field_type) VALUES
-- Offboarding scenario fields
('f1a2b3c4-d5e6-7890-abcd-ef1234567890', 'Employee Information', 'Enter employee''s full name', 'text'),
('a2b3c4d5-e6f7-8901-bcde-f23456789012', 'Employee Role', 'e.g., Marketing Manager, Software Engineer, Sales Representative', 'text'),
('b3c4d5e6-f7a8-9012-cdef-345678901234', 'Offboarding Scenario', 'Select the type of offboarding scenario', 'categorical'),
('c4d5e6f7-a8b9-0123-defa-456789012345', 'Employee Level', 'Select the employee''s level in the organization', 'categorical'),
('d5e6f7a8-b9c0-1234-efab-567890123456', 'Voice', 'Select the offboarding manager persona voice', 'persona');

-- Create the Employee Offboarding Training scenario
INSERT INTO scenarios (id, title, description, training_id, field_ids) VALUES
('e6f7a8b9-c0d1-2345-6789-678901234567', 'Employee Offboarding Training', 'Practice conducting professional and empathetic employee departures.', 
 '81233636-cf63-465f-b5d5-6d26de3b94e9',
  ARRAY[
      'f1a2b3c4-d5e6-7890-abcd-ef1234567890'::uuid, 
      'a2b3c4d5-e6f7-8901-bcde-f23456789012'::uuid, 
      'b3c4d5e6-f7a8-9012-cdef-345678901234'::uuid, 
      'c4d5e6f7-a8b9-0123-defa-456789012345'::uuid, 
      'd5e6f7a8-b9c0-1234-efab-567890123456'::uuid
   ]);

-- Create parameters for the Offboarding Scenario field
INSERT INTO parameters (field_id, name, description, value) VALUES
('b3c4d5e6-f7a8-9012-cdef-345678901234', 'Complete', 'Complete offboarding process', 'Complete'),
('b3c4d5e6-f7a8-9012-cdef-345678901234', 'Voluntary Departure', 'Employee is leaving for new opportunities or personal reasons', 'Voluntary Departure'),
('b3c4d5e6-f7a8-9012-cdef-345678901234', 'Involuntary Termination', 'Employee is being terminated due to performance or conduct issues', 'Involuntary Termination'),
('b3c4d5e6-f7a8-9012-cdef-345678901234', 'Layoff', 'Employee is being laid off due to business restructuring or economic reasons', 'Layoff'),
('b3c4d5e6-f7a8-9012-cdef-345678901234', 'Retirement', 'Long-term employee is retiring after years of service', 'Retirement');

-- Create parameters for the Employee Level field
INSERT INTO parameters (field_id, name, description, value) VALUES
('c4d5e6f7-a8b9-0123-defa-456789012345', 'Junior', 'New employee or individual contributor (0-3 years)', 'Junior'),
('c4d5e6f7-a8b9-0123-defa-456789012345', 'Mid-Level', 'Experienced team member or specialist (3-7 years)', 'Mid-Level'),
('c4d5e6f7-a8b9-0123-defa-456789012345', 'Senior', 'Senior professional or team lead (7+ years)', 'Senior'),
('c4d5e6f7-a8b9-0123-defa-456789012345', 'Executive', 'Director, VP, or C-level executive', 'Executive'); 