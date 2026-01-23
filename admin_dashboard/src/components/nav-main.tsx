import type { LucideIcon } from "lucide-react"
import { Link, useLocation } from "react-router-dom"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: LucideIcon
  }[]
}) {
  const location = useLocation()

  const isActive = (url: string) => {
    if (url === '/dashboard') {
      return location.pathname === '/dashboard'
    }
    return location.pathname.startsWith(url)
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 px-3 mb-2">
        Navigation
      </SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu className="gap-1.5">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={isActive(item.url)}
                className="h-10 px-3 rounded-lg transition-all duration-200 hover:translate-x-0.5"
              >
                <Link to={item.url} className="flex items-center gap-3">
                  {item.icon && (
                    <item.icon
                      className="h-5 w-5 flex-shrink-0 transition-colors duration-200"
                      strokeWidth={isActive(item.url) ? 2.5 : 2}
                    />
                  )}
                  <span className="font-medium">{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
