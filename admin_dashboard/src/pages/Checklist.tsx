import React from 'react';
import { useChecklists } from '@/hooks/useChecklists';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

const Checklists: React.FC = () => {
  const { data: checklists = [], isLoading, error } = useChecklists();

  if (isLoading) {
    return <div className="p-3 sm:p-6">Loading checklists...</div>;
  }

  if (error) {
    return <div className="p-3 text-red-500 sm:p-6">Error: {(error).message}</div>;
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checklists</h1>
      <div className="grid gap-4 sm:gap-6">
        {checklists.map((checklist) => (
          <Card key={checklist.id}>
            <CardHeader>
              <CardTitle>{checklist.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(checklist.checklist_items ?? checklist.items ?? []).map((item) => (
                  <li key={item.id} className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3">
                    <Checkbox checked={Boolean(item.status?.checked ?? item.checked ?? item.is_completed)} disabled className="mt-0.5" />
                    <span className="min-w-0 break-words text-sm">{item.text ?? item.name ?? `Item ${item.id}`}</span>
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
