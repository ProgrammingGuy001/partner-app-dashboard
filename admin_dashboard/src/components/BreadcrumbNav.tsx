import { useLocation } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

export const BreadcrumbNav = () => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);
  
  const breadcrumbItems = pathnames.map((name, index) => {
    const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
    const isLast = index === pathnames.length - 1;
    const displayName = name
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    if (isLast) {
      return (
        <BreadcrumbItem key={name}>
          <BreadcrumbPage>{displayName}</BreadcrumbPage>
        </BreadcrumbItem>
      );
    }

    return (
      <BreadcrumbItem key={name}>
        <BreadcrumbLink href={routeTo}>{displayName}</BreadcrumbLink>
      </BreadcrumbItem>
    );
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {breadcrumbItems}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
