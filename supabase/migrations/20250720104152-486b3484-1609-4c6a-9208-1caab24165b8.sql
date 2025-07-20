-- Add foreign key constraints to link user_id columns to profiles table
-- First, add foreign key from comments to profiles
ALTER TABLE public.comments 
ADD CONSTRAINT fk_comments_user_id 
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from task_assignments to profiles  
ALTER TABLE public.task_assignments
ADD CONSTRAINT fk_task_assignments_user_id
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from project_members to profiles
ALTER TABLE public.project_members
ADD CONSTRAINT fk_project_members_user_id  
FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;

-- Add foreign key from tasks to profiles for created_by
ALTER TABLE public.tasks
ADD CONSTRAINT fk_tasks_created_by
FOREIGN KEY (created_by) REFERENCES public.profiles(user_id) ON DELETE CASCADE;