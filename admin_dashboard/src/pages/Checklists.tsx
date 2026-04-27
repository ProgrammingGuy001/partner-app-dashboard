
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { checklistAPI } from '@/api/services';
// import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
// import { Plus } from 'lucide-react';

const Checklists: React.FC = () => {
  // const queryClient = useQueryClient();
  // const [showCreateModal, setShowCreateModal] = useState(false);

  const { data: checklists, isLoading } = useQuery({
    queryKey: ['checklists'],
    queryFn: () => checklistAPI.getAll(),
  });

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold sm:text-3xl">Checklists</h1>
        {/* <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Checklist
        </Button> */}
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <>
        <div className="divide-y rounded-md border md:hidden">
          {checklists?.map((checklist) => (
            <article key={checklist.id} className="p-4">
              <p className="text-xs text-muted-foreground">ID: {checklist.id}</p>
              <h3 className="mt-1 break-words text-sm font-semibold">{checklist.name}</h3>
            </article>
          ))}
        </div>
        <div className="hidden rounded-md border md:block md:overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checklists?.map((checklist) => (
              <TableRow key={checklist.id}>
                <TableCell>{checklist.id}</TableCell>
                <TableCell>{checklist.name}</TableCell>
                <TableCell>
                  {/* Actions will go here */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
        </>
      )}
    </div>
  );
};

export default Checklists;
