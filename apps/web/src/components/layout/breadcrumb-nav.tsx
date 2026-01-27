"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

const segmentLabels: Record<string, string> = {
  admin: "Admin",
  va: "VA",
  client: "Client",
  users: "Manage Users",
  accounts: "Manage Accounts",
  "department-roles": "Access Profiles",
  invites: "Manage Invites",
  "order-tracking": "Order Tracking",
  automation: "Automation Hub",
  bookkeeping: "Order Tracking",
}

function capitalizeSegment(segment: string): string {
  return segmentLabels[segment] || segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function BreadcrumbNav() {
  const pathname = usePathname()

  // SSR safety
  if (!pathname) return null

  // Split pathname and filter out empty strings and route groups (segments starting with "(")
  const segments = pathname
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("))

  // Don't show breadcrumbs on dashboard root (single segment)
  if (segments.length <= 1) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => {
          const href = "/" + segments.slice(0, index + 1).join("/")
          const label = capitalizeSegment(segment)
          const isLast = index === segments.length - 1

          if (isLast) {
            return (
              <BreadcrumbItem key={href}>
                <BreadcrumbPage>{label}</BreadcrumbPage>
              </BreadcrumbItem>
            )
          }

          return (
            <React.Fragment key={href}>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={href}>{label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
