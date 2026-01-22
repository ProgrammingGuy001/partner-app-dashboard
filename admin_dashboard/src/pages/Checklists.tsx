
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Checklists</h1>
        {/* <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Checklist
        </Button> */}
      </div>
      {isLoading ? (
        <p>Loading...</p>
      ) : (
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
      )}
    </div>
  );
};

export default Checklists;
