import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Calendar, MessageSquare, User } from 'lucide-react';
import TaskModal from '@/components/TaskModal';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  position: number;
  due_date: string | null;
  created_at: string;
  assignees?: { user_id: string; profiles: { display_name: string | null } }[];
  comments_count?: number;
}

interface Board {
  id: string;
  name: string;
  description: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
}

const STATUS_COLUMNS = [
  { id: 'todo', title: 'To Do', color: 'bg-slate-100' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100' },
  { id: 'review', title: 'Review', color: 'bg-yellow-100' },
  { id: 'done', title: 'Done', color: 'bg-green-100' }
];

const ProjectBoard = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTaskStatus, setNewTaskStatus] = useState<string>('');
  const [newTask, setNewTask] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !projectId) {
      navigate('/auth');
      return;
    }
    fetchProjectData();
  }, [user, projectId, navigate]);

  const fetchProjectData = async () => {
    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch the first board for this project
      const { data: boardData, error: boardError } = await supabase
        .from('boards')
        .select('*')
        .eq('project_id', projectId)
        .order('position')
        .limit(1)
        .single();

      if (boardError) throw boardError;
      setBoard(boardData);

      // Fetch tasks for this board
      await fetchTasks(boardData.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load project data',
        variant: 'destructive'
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (boardId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignments!left(
            user_id,
            profiles!fk_task_assignments_user_id(display_name)
          ),
          comments!left(id)
        `)
        .eq('board_id', boardId)
        .order('position');

      if (error) throw error;

      const tasksWithAssignees = data.map(task => ({
        ...task,
        assignees: task.task_assignments || [],
        comments_count: task.comments?.length || 0
      }));

      setTasks(tasksWithAssignees);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch tasks',
        variant: 'destructive'
      });
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!board) return;

    try {
      const maxPosition = Math.max(...tasks.filter(t => t.status === newTaskStatus).map(t => t.position), -1);
      
      const { error } = await supabase
        .from('tasks')
        .insert([
          {
            board_id: board.id,
            title: newTask.title,
            description: newTask.description,
            status: newTaskStatus as 'todo' | 'in_progress' | 'review' | 'done',
            position: maxPosition + 1,
            created_by: user!.id
          }
        ]);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task created successfully!'
      });

      setNewTask({ title: '', description: '' });
      setIsCreateTaskOpen(false);
      await fetchTasks(board.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination || !board) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return;
    }

    try {
      const newStatus = destination.droppableId as Task['status'];
      
      // Update task status and position
      const { error } = await supabase
        .from('tasks')
        .update({
          status: newStatus,
          position: destination.index
        })
        .eq('id', draggableId);

      if (error) throw error;

      // Refresh tasks
      await fetchTasks(board.id);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update task',
        variant: 'destructive'
      });
    }
  };

  const openCreateTaskDialog = (status: string) => {
    setNewTaskStatus(status);
    setIsCreateTaskOpen(true);
  };

  const openTaskModal = (task: Task) => {
    setSelectedTask(task);
    setIsTaskModalOpen(true);
  };

  const getTasksByStatus = (status: string) => {
    return tasks.filter(task => task.status === status).sort((a, b) => a.position - b.position);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{project?.name}</h1>
              <p className="text-muted-foreground">{board?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {STATUS_COLUMNS.map((column) => (
              <div key={column.id} className={`rounded-lg p-4 ${column.color}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-lg">{column.title}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openCreateTaskDialog(column.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <Droppable droppableId={column.id}>
                  {(provided) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="space-y-3 min-h-[200px]"
                    >
                      {getTasksByStatus(column.id).map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(provided) => (
                            <Card
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className="cursor-pointer hover:shadow-md transition-shadow bg-card"
                              onClick={() => openTaskModal(task)}
                            >
                              <CardContent className="p-4">
                                <h4 className="font-medium mb-2 line-clamp-2">{task.title}</h4>
                                
                                {task.description && (
                                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                
                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                  <div className="flex items-center gap-2">
                                    {task.due_date && (
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{new Date(task.due_date).toLocaleDateString()}</span>
                                      </div>
                                    )}
                                    {task.comments_count > 0 && (
                                      <div className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        <span>{task.comments_count}</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {task.assignees && task.assignees.length > 0 && (
                                    <div className="flex -space-x-1">
                                      {task.assignees.slice(0, 3).map((assignee, idx) => (
                                        <Avatar key={idx} className="h-6 w-6">
                                          <AvatarFallback className="text-xs">
                                            {assignee.profiles?.display_name?.[0] || 'U'}
                                          </AvatarFallback>
                                        </Avatar>
                                      ))}
                                      {task.assignees.length > 3 && (
                                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
                                          +{task.assignees.length - 3}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      </main>

      {/* Create Task Dialog */}
      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to {STATUS_COLUMNS.find(col => col.id === newTaskStatus)?.title}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                placeholder="Enter task title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (Optional)</Label>
              <Textarea
                id="task-description"
                placeholder="Describe the task"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">Create Task</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onTaskUpdate={() => board && fetchTasks(board.id)}
          projectId={projectId!}
        />
      )}
    </div>
  );
};

export default ProjectBoard;