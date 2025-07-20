import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Calendar, MessageSquare, User, Plus, Send, Trash2 } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  due_date: string | null;
  created_at: string;
  assignees?: { user_id: string; profiles: { display_name: string | null } }[];
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  profiles: { display_name: string | null };
}

interface ProjectMember {
  user_id: string;
  profiles: { display_name: string | null };
}

interface TaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdate: () => void;
  projectId: string;
}

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' }
];

const TaskModal: React.FC<TaskModalProps> = ({ task, isOpen, onClose, onTaskUpdate, projectId }) => {
  const [editedTask, setEditedTask] = useState(task);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && task) {
      setEditedTask(task);
      fetchComments();
      fetchProjectMembers();
    }
  }, [isOpen, task]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          created_at,
          user_id,
          profiles!fk_comments_user_id(display_name)
        `)
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch comments',
        variant: 'destructive'
      });
    }
  };

  const fetchProjectMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          user_id,
          profiles!fk_project_members_user_id(display_name)
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      setProjectMembers(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to fetch project members',
        variant: 'destructive'
      });
    }
  };

  const handleSaveTask = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: editedTask.title,
          description: editedTask.description,
          status: editedTask.status,
          due_date: editedTask.due_date
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task updated successfully!'
      });

      onTaskUpdate();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .insert([
          {
            task_id: task.id,
            user_id: user!.id,
            content: newComment.trim()
          }
        ]);

      if (error) throw error;

      setNewComment('');
      await fetchComments();
      
      toast({
        title: 'Success',
        description: 'Comment added successfully!'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleAssignUser = async (userId: string) => {
    try {
      // Check if user is already assigned
      const isAssigned = task.assignees?.some(a => a.user_id === userId);
      
      if (isAssigned) {
        // Remove assignment
        const { error } = await supabase
          .from('task_assignments')
          .delete()
          .eq('task_id', task.id)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        // Add assignment
        const { error } = await supabase
          .from('task_assignments')
          .insert([
            {
              task_id: task.id,
              user_id: userId
            }
          ]);

        if (error) throw error;
      }

      onTaskUpdate();
      toast({
        title: 'Success',
        description: isAssigned ? 'User unassigned' : 'User assigned to task'
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTask = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task deleted successfully!'
      });

      onTaskUpdate();
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex justify-between items-start">
            <DialogTitle className="text-xl">{task.title}</DialogTitle>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTask}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="task-title">Title</Label>
                <Input
                  id="task-title"
                  value={editedTask.title}
                  onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  rows={4}
                  value={editedTask.description || ''}
                  onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                  placeholder="Add a description..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="task-status">Status</Label>
                  <Select
                    value={editedTask.status}
                    onValueChange={(value: any) => setEditedTask({ ...editedTask, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="task-due-date">Due Date</Label>
                  <Input
                    id="task-due-date"
                    type="date"
                    value={editedTask.due_date ? editedTask.due_date.split('T')[0] : ''}
                    onChange={(e) => setEditedTask({ 
                      ...editedTask, 
                      due_date: e.target.value ? new Date(e.target.value).toISOString() : null 
                    })}
                  />
                </div>
              </div>

              <Button onClick={handleSaveTask} disabled={isLoading} className="w-full">
                Save Changes
              </Button>
            </div>

            <Separator />

            {/* Comments Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({comments.length})
              </h3>

              <form onSubmit={handleAddComment} className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={!newComment.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>

              <div className="space-y-3">
                {comments.map((comment) => (
                  <Card key={comment.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {comment.profiles?.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.profiles?.display_name || 'Unknown User'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(comment.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{comment.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Assignees */}
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <User className="h-4 w-4" />
                Assignees
              </h4>
              
              <div className="space-y-2">
                {task.assignees && task.assignees.length > 0 && (
                  <div className="space-y-2">
                    {task.assignees.map((assignee) => (
                      <div key={assignee.user_id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {assignee.profiles?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {assignee.profiles?.display_name || 'Unknown User'}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAssignUser(assignee.user_id)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Add assignee:</Label>
                  <div className="space-y-1">
                    {projectMembers
                      .filter(member => !task.assignees?.some(a => a.user_id === member.user_id))
                      .map((member) => (
                        <Button
                          key={member.user_id}
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start h-8"
                          onClick={() => handleAssignUser(member.user_id)}
                        >
                          <Avatar className="h-5 w-5 mr-2">
                            <AvatarFallback className="text-xs">
                              {member.profiles?.display_name?.[0] || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          {member.profiles?.display_name || 'Unknown User'}
                        </Button>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Task Info */}
            <div className="space-y-3">
              <h4 className="font-medium">Task Info</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{new Date(task.created_at).toLocaleDateString()}</span>
                </div>
                {task.due_date && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Due Date:</span>
                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="secondary">
                    {STATUS_OPTIONS.find(s => s.value === task.status)?.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TaskModal;