import React, { useState, useEffect } from 'react';
import { checklistAPI, type Checklist } from '@/api/services';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

const Checklists: React.FC = () => {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const summaries = await checklistAPI.getAll();
        const details = await Promise.all(
          summaries.map(async (c) => {
            try {
              return await checklistAPI.getById(c.id);
            } catch {
              return c;
            }
          })
        );
        setChecklists(details);
      } catch (err) {
        setError((err as Error).message || 'Failed to fetch checklists');
      } finally {
        setLoading(false);
      }
    };
    fetchChecklists();
  }, []);

  if (loading) {
    return <div className="p-6">Loading checklists...</div>;
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-3xl font-bold tracking-tight">Checklists</h1>
      <div className="grid gap-6">
        {checklists.map((checklist) => (
          <Card key={checklist.id}>
            <CardHeader>
              <CardTitle>{checklist.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(checklist.checklist_items ?? checklist.items ?? []).map((item) => (
                  <li key={item.id} className="flex items-center space-x-2">
                    <Checkbox checked={Boolean(item.status?.checked ?? item.checked ?? item.is_completed)} disabled />
                    <span>{item.text ?? item.name ?? `Item ${item.id}`}</span>
                  </li>
                ))}
                {(checklist.checklist_items ?? checklist.items ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">No checklist items</li>
                )}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Checklists;
