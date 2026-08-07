import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { authAPI, type User } from '@/api/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCircle2 } from 'lucide-react';

const Profile: React.FC = () => {
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-primary sm:text-3xl">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">
          Your name is shown wherever you're assigned to a job as its supervisor.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <UserCircle2 className="h-5 w-5" /> Account
          </CardTitle>
          <CardDescription>Update your display name</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading || !currentUser ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading...
            </div>
          ) : (
            <ProfileForm key={currentUser.id} currentUser={currentUser} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const ProfileForm: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(currentUser.name || '');

  const updateMutation = useMutation({
    mutationFn: () => authAPI.updateProfile({ name: name.trim() }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['auth', 'user'], updated);
      toast.success('Profile updated');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    updateMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={currentUser.email || ''} disabled className="bg-muted opacity-70" />
      </div>

      <div className="space-y-2">
        <Label>Role</Label>
        <div>
          <Badge variant={currentUser.is_superadmin ? 'default' : 'secondary'}>
            {currentUser.is_superadmin ? 'Superadmin' : 'Admin'}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          maxLength={255}
          required
        />
      </div>

      <Button type="submit" disabled={updateMutation.isPending}>
        {updateMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
          </>
        ) : (
          'Save changes'
        )}
      </Button>
    </form>
  );
};

export default Profile;
