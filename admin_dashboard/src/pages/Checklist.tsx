import React from 'react';
import { useChecklists } from '../hooks/useDashboardData';

const Checklists: React.FC = () => {
  const { data: checklists, isLoading, error } = useChecklists();

  if (isLoading) {
    return <div>Loading checklists...</div>;
  }

  if (error) {
    return <div>Error fetching checklists: {error.message}</div>;
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-800">Checklists</h1>
      {checklists.map((checklist: any) => (
        <div key={checklist.id} className="mt-4 p-4 border rounded">
          <h2 className="text-xl font-bold">{checklist.name}</h2>
          <ul>
            {checklist.items.map((item: any) => (
              <li key={item.id} className="flex items-center">
                <input type="checkbox" checked={item.is_completed} readOnly className="mr-2" />
                <span>{item.name}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default Checklists;
