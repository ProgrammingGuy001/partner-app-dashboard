import { useState } from "react"
import {
  IconDotsVertical,
  IconKey,
  IconLogout,
  IconUserCircle,
} from "@tabler/icons-react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Link, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { authAPI } from "@/api/services"
import { getApiErrorMessage } from "@/lib/apiError"

export function NavUser({
  user,
}: Readonly<{
  user: {
    name: string
    email: string
    is_superadmin?: boolean
    is_dev?: boolean
  }
}>) {
  const { isMobile } = useSidebar()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [resetOpen, setResetOpen] = useState(false)
  const [targetEmail, setTargetEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleLogout = async () => {
    let revoked = true
    try {
      await authAPI.logout()
    } catch {
      // Auth cookies are HttpOnly, so only the server can clear them. Still send the
      // user to /login, but say so — on a shared machine the session is live.
      revoked = false
    }
    queryClient.clear()
    navigate('/login')
    if (!revoked) toast.error('Signed out here, but the server session may still be active.')
  }

  const handleResetPassword = async () => {
    if (!targetEmail.trim() || newPassword.length < 8) {
      toast.error("Enter an email and a password of at least 8 characters")
      return
    }
    setSubmitting(true)
    try {
      await authAPI.resetPassword(targetEmail.trim(), newPassword)
      toast.success(`Password reset for ${targetEmail.trim()}`)
      setResetOpen(false)
      setTargetEmail("")
      setNewPassword("")
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Failed to reset password"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-9 w-9 rounded-lg ring-2 ring-sidebar-border/30 shadow-sm transition-transform group-hover:scale-105">
                <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary/80 to-primary text-primary-foreground font-medium">
                  {user.is_superadmin ? 'SA' : 'AD'}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight ml-0.5">
                <span className="truncate font-medium flex items-center gap-2">
                  {user.name}
                  
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarFallback className="rounded-lg">
                    {user.is_superadmin ? 'SA' : 'AD'}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="text-muted-foreground truncate text-xs">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/dashboard/profile">
                <IconUserCircle />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(user.is_superadmin || user.is_dev) && (
              <>
                <DropdownMenuItem onClick={() => setResetOpen(true)}>
                  <IconKey />
                  Reset admin password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={handleLogout}>
              <IconLogout />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset admin password</DialogTitle>
            <DialogDescription>
              Set a new password for another admin. Only their password changes — no other data is affected.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="reset-email">Admin email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="admin@ayena.in"
                value={targetEmail}
                onChange={(e) => setTargetEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reset-password">New password</Label>
              <Input
                id="reset-password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  )
}
