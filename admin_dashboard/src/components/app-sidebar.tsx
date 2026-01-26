import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import {
  IconChartBar,
  IconDashboard,
  IconFolder,
  IconListDetails,
  IconUsers,
  IconBox,
} from "@tabler/icons-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { authAPI } from "@/api/services"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Jobs",
      url: "/dashboard/jobs",
      icon: IconListDetails,
    },
    {
      title: "IP personnel",
      url: "/dashboard/workers",
      icon: IconUsers,
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: IconChartBar,
    },
    {
      title: "Projects",
      url: "/dashboard/project-analytics",
      icon: IconFolder,
    },
    {
      title: "BOM Requests",
      url: "/dashboard/bom",
      icon: IconBox,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // Use React Query cached user data (already fetched by ProtectedRoute)
  const { data: userData } = useQuery({
    queryKey: ['auth', 'user'],
    queryFn: () => authAPI.getCurrentUser(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const user = {
    name: userData?.is_superadmin ? "Super Admin" : "Admin",
    email: userData?.email || "user@example.com",
    avatar: "/avatars/shadcn.jpg",
    is_superadmin: userData?.is_superadmin || false,
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/50 bg-gradient-to-b from-sidebar to-sidebar/80 pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-0 hover:bg-transparent"
            >
             <a
  href="https://www.modula.in/"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Visit Modula website"
  className="flex items-center justify-center overflow-visible"
>
  <img
    src="/logo.png"
    alt="Modula logo"
    className="h-10 object-contain transition-transform duration-200 hover:scale-105"
  />
</a>

            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-2 py-4">
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 bg-gradient-to-t from-sidebar to-sidebar/80 pt-3">
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
