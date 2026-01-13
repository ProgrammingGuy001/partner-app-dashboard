"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

import { type Job } from "@/api/services"

export const description = "An interactive area chart"

const chartConfig = {
  jobs: {
    label: "Total Jobs",
    color: "var(--primary)",
  },
  assigned: {
    label: "Assigned Jobs",
    color: "hsl(var(--chart-2))",
  },
  ips: {
    label: "Active IPs",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ jobs }: { jobs: Job[] }) {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  // Process jobs into chart data with IP assignment tracking
  const chartData = React.useMemo(() => {
    const counts: Record<string, { total: number; assigned: number; ips: Set<number> }> = {}
    
    jobs.forEach(job => {
      const date = job.delivery_date.split('T')[0]
      if (!counts[date]) {
        counts[date] = { total: 0, assigned: 0, ips: new Set() }
      }
      counts[date].total += 1
      if (job.assigned_ip_id) {
        counts[date].assigned += 1
        counts[date].ips.add(job.assigned_ip_id)
      }
    })

    return Object.entries(counts)
      .map(([date, data]) => ({ 
        date, 
        jobs: data.total, 
        assigned: data.assigned,
        ips: data.ips.size 
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [jobs])

  const filteredData = React.useMemo(() => {
    return chartData.filter((item) => {
      const date = new Date(item.date)
      const referenceDate = new Date() // Use current date as reference
      let daysToSubtract = 90
      if (timeRange === "30d") {
        daysToSubtract = 30
      } else if (timeRange === "7d") {
        daysToSubtract = 7
      }
      const startDate = new Date(referenceDate)
      startDate.setDate(startDate.getDate() - daysToSubtract)
      return date >= startDate
    })
  }, [chartData, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Jobs & IP Assignment Overview</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Jobs, assignments, and active IPs by delivery date
          </span>
          <span className="@[540px]/card:hidden">Job & IP trends</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(val) => val && setTimeRange(val)}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillJobs" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-jobs)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-jobs)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="jobs"
              type="natural"
              fill="url(#fillJobs)"
              stroke="var(--color-jobs)"
              stackId="a"
            />
            <Area
              dataKey="assigned"
              type="natural"
              fill="hsl(var(--chart-2))"
              fillOpacity={0.4}
              stroke="var(--color-assigned)"
            />
            <Area
              dataKey="ips"
              type="natural"
              fill="hsl(var(--chart-3))"
              fillOpacity={0.3}
              stroke="var(--color-ips)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
