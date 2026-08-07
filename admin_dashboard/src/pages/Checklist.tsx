import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useChecklists } from '@/hooks/useChecklists';
import { authAPI, checklistAPI, type Checklist, type ChecklistItem } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/apiError';

const Checklists: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: checklists = [], isLoading, error, refetch } = useChecklists();
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 5 * 60 * 1000,
  });
  const canEdit = Boolean(currentUser?.is_superadmin);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newItems, setNewItems] = useState<Record<number, string>>({});
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [busy, setBusy] = useState('');

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['checklists'] });

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    try {
      await action();
      await refresh();
      toast.success(message);
      return true;
    } catch (actionError) {
      toast.error(getApiErrorMessage(actionError, 'Checklist update failed'));
      return false;
    } finally {
      setBusy('');
    }
  };

  const createChecklist = async () => {
    if (!newName.trim()) return;
    if (await run('new-checklist', () => checklistAPI.create({ name: newName.trim(), description: newDescription.trim() || undefined }), 'Checklist created')) {
      setNewName('');
      setNewDescription('');
    }
  };

  const saveChecklist = async () => {
    if (!editingChecklist?.name.trim()) return;
    if (await run(`checklist-${editingChecklist.id}`, () => checklistAPI.update(editingChecklist.id, {
      name: editingChecklist.name.trim(),
      description: editingChecklist.description?.trim() || undefined,
    }), 'Checklist updated')) setEditingChecklist(null);
  };

  const addItem = async (checklist: Checklist) => {
    const text = newItems[checklist.id]?.trim();
    if (!text) return;
    if (await run(`new-item-${checklist.id}`, () => checklistAPI.createItem(checklist.id, {
      text,
      position: checklist.checklist_items?.length || 0,
    }), 'Checklist item added')) setNewItems((current) => ({ ...current, [checklist.id]: '' }));
  };

  const saveItem = async () => {
    if (!editingItem?.text.trim()) return;
    if (await run(`item-${editingItem.id}`, () => checklistAPI.updateItem(editingItem.id, {
      text: editingItem.text.trim(),
      position: editingItem.position,
    }), 'Checklist item updated')) setEditingItem(null);
  };

  if (isLoading) {
    return <div className="p-3 sm:p-6">Loading checklists...</div>;
  }

  if (error) {
    return <div className="space-y-3 p-3 text-destructive sm:p-6"><p>Error: {(error).message}</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checklists</h1>
      {canEdit && (
        <Card>
          <CardHeader><CardTitle>Create global template</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Checklist name" maxLength={255} />
            <Input value={newDescription} onChange={(event) => setNewDescription(event.target.value)} placeholder="Description (optional)" maxLength={1000} />
            <Button className="md:w-fit" onClick={createChecklist} disabled={!newName.trim() || busy === 'new-checklist'}>
              {busy === 'new-checklist' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Create template
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Global templates, not a job's progress — so no per-item status here. */}
      <div className="grid gap-4 sm:gap-6">
        {checklists.map((checklist) => (
          <Card key={checklist.id}>
            <CardHeader>
              {editingChecklist?.id === checklist.id ? (
                <div className="space-y-3">
                  <Input value={editingChecklist.name} onChange={(event) => setEditingChecklist({ ...editingChecklist, name: event.target.value })} />
                  <Input value={editingChecklist.description || ''} onChange={(event) => setEditingChecklist({ ...editingChecklist, description: event.target.value })} placeholder="Description (optional)" />
                  <div className="flex gap-2"><Button size="sm" onClick={saveChecklist} disabled={!editingChecklist.name.trim() || busy === `checklist-${checklist.id}`}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditingChecklist(null)}>Cancel</Button></div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div><CardTitle>{checklist.name}</CardTitle>{checklist.description && <p className="mt-1 text-sm text-muted-foreground">{checklist.description}</p>}</div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" aria-label={`Edit ${checklist.name}`} onClick={() => setEditingChecklist({ ...checklist })}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" aria-label={`Delete ${checklist.name}`} disabled={busy === `delete-checklist-${checklist.id}`} onClick={() => {
                        if (window.confirm(`Delete checklist "${checklist.name}"?`)) run(`delete-checklist-${checklist.id}`, () => checklistAPI.delete(checklist.id), 'Checklist deleted');
                      }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {(checklist.checklist_items ?? []).map((item, index) => (
                  <li key={item.id} className="flex items-start gap-3 rounded-lg border bg-muted/20 p-3">
                    <span className="text-sm font-medium text-muted-foreground">{index + 1}.</span>
                    {editingItem?.id === item.id ? (
                      <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                        <Input value={editingItem.text} onChange={(event) => setEditingItem({ ...editingItem, text: event.target.value })} />
                        <Button size="sm" onClick={saveItem} disabled={!editingItem.text.trim() || busy === `item-${item.id}`}>Save</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingItem(null)}>Cancel</Button>
                      </div>
                    ) : (
                      <><span className="min-w-0 flex-1 break-words text-sm">{item.text}</span>{canEdit && <div className="flex gap-1"><Button size="icon" variant="ghost" aria-label={`Edit item ${index + 1}`} onClick={() => setEditingItem({ ...item })}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Delete item ${index + 1}`} onClick={() => { if (window.confirm('Delete this checklist item?')) run(`delete-item-${item.id}`, () => checklistAPI.deleteItem(item.id), 'Checklist item deleted'); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>}</>
                    )}
                  </li>
                ))}
                {(checklist.checklist_items ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">No checklist items</li>
                )}
              </ol>
              {canEdit && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Input value={newItems[checklist.id] || ''} onChange={(event) => setNewItems((current) => ({ ...current, [checklist.id]: event.target.value }))} placeholder="New checklist item" />
                  <Button onClick={() => addItem(checklist)} disabled={!newItems[checklist.id]?.trim() || busy === `new-item-${checklist.id}`}><Plus className="mr-2 h-4 w-4" />Add item</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {checklists.length === 0 && <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No global checklist templates yet.</CardContent></Card>}
      </div>
    </div>
  );
};

export default Checklists;
