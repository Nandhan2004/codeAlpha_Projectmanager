-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

-- Create enum for project roles
CREATE TYPE public.project_role AS ENUM ('owner', 'admin', 'member');

-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create project_members table for managing project access
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Create boards table
CREATE TABLE public.boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status public.task_status NOT NULL DEFAULT 'todo',
  position INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_assignments table
CREATE TABLE public.task_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create comments table
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for projects
CREATE POLICY "Users can view projects they're members of" ON public.projects FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM public.project_members WHERE project_id = id
  ) OR owner_id = auth.uid()
);
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Project owners can update projects" ON public.projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Project owners can delete projects" ON public.projects FOR DELETE USING (auth.uid() = owner_id);

-- Create RLS policies for project_members
CREATE POLICY "Users can view project members for their projects" ON public.project_members FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM public.project_members WHERE project_id = project_members.project_id
  )
);
CREATE POLICY "Project owners can manage members" ON public.project_members FOR ALL USING (
  auth.uid() IN (
    SELECT owner_id FROM public.projects WHERE id = project_id
  )
);

-- Create RLS policies for boards
CREATE POLICY "Users can view boards for their projects" ON public.boards FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM public.project_members WHERE project_id = boards.project_id
  )
);
CREATE POLICY "Project members can manage boards" ON public.boards FOR ALL USING (
  auth.uid() IN (
    SELECT user_id FROM public.project_members WHERE project_id = boards.project_id
  )
);

-- Create RLS policies for tasks
CREATE POLICY "Users can view tasks for their projects" ON public.tasks FOR SELECT USING (
  auth.uid() IN (
    SELECT pm.user_id FROM public.project_members pm
    JOIN public.boards b ON b.project_id = pm.project_id
    WHERE b.id = tasks.board_id
  )
);
CREATE POLICY "Project members can manage tasks" ON public.tasks FOR ALL USING (
  auth.uid() IN (
    SELECT pm.user_id FROM public.project_members pm
    JOIN public.boards b ON b.project_id = pm.project_id
    WHERE b.id = tasks.board_id
  )
);

-- Create RLS policies for task_assignments
CREATE POLICY "Users can view task assignments for their projects" ON public.task_assignments FOR SELECT USING (
  auth.uid() IN (
    SELECT pm.user_id FROM public.project_members pm
    JOIN public.boards b ON b.project_id = pm.project_id
    JOIN public.tasks t ON t.board_id = b.id
    WHERE t.id = task_assignments.task_id
  )
);
CREATE POLICY "Project members can manage task assignments" ON public.task_assignments FOR ALL USING (
  auth.uid() IN (
    SELECT pm.user_id FROM public.project_members pm
    JOIN public.boards b ON b.project_id = pm.project_id
    JOIN public.tasks t ON t.board_id = b.id
    WHERE t.id = task_assignments.task_id
  )
);

-- Create RLS policies for comments
CREATE POLICY "Users can view comments for their projects" ON public.comments FOR SELECT USING (
  auth.uid() IN (
    SELECT pm.user_id FROM public.project_members pm
    JOIN public.boards b ON b.project_id = pm.project_id
    JOIN public.tasks t ON t.board_id = b.id
    WHERE t.id = comments.task_id
  )
);
CREATE POLICY "Project members can create comments" ON public.comments FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT pm.user_id FROM public.project_members pm
    JOIN public.boards b ON b.project_id = pm.project_id
    JOIN public.tasks t ON t.board_id = b.id
    WHERE t.id = comments.task_id
  ) AND auth.uid() = user_id
);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_boards_updated_at
  BEFORE UPDATE ON public.boards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();