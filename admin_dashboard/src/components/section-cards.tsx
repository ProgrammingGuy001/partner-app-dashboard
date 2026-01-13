import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface SectionCardsProps {
  totalJobs?: number
  assignedJobs?: number
  uniqueIPs?: number
}

export function SectionCards({ totalJobs = 0, assignedJobs = 0, uniqueIPs = 0 }: SectionCardsProps) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Total Jobs</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalJobs}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            All jobs in system
          </div>
          <div className="text-muted-foreground">
            Total count of all jobs
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Assigned Jobs</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {assignedJobs}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {totalJobs > 0 ? Math.round((assignedJobs / totalJobs) * 100) : 0}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Jobs assigned to IPs
          </div>
          <div className="text-muted-foreground">
            Jobs with assigned IP users
          </div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Active IP Users</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {uniqueIPs}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              Active
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Unique IP users working
          </div>
          <div className="text-muted-foreground">Total active IP users</div>
        </CardFooter>
      </Card>
      <Card className="@container/card">
        <CardHeader>
          <CardDescription>Unassigned Jobs</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {totalJobs - assignedJobs}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              {totalJobs > 0 ? Math.round(((totalJobs - assignedJobs) / totalJobs) * 100) : 0}%
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Jobs awaiting assignment
          </div>
          <div className="text-muted-foreground">Jobs without IP assignment</div>
        </CardFooter>
      </Card>
    </div>
  )
}
