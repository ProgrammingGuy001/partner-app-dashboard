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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="https://www.modula.in/">
                <div className="h-16 px-4 flex items-center justify-center">
                  <img
                    src="/logo.png"
                    alt="Logo"
                    className="max-h-4/6 max-w-3/4 object-contain"
                  />
                </div>

              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
