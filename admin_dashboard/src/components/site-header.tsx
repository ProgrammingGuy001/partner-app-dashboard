import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { BreadcrumbNav } from "@/components/BreadcrumbNav"

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/60 bg-background/95 backdrop-blur-sm shadow-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height) sticky top-0 z-50">
      <div className="flex w-full items-center gap-3 px-5 lg:gap-4 lg:px-8">
        <SidebarTrigger className="-ml-1 hover:bg-accent/80 transition-colors duration-200" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-5 bg-border/60"
        />
        <BreadcrumbNav />
      </div>
    </header>
  )
}
