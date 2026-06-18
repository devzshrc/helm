"use client";

import * as React from "react";
import Link from "next/link";

import { BRAND } from "~/lib/brand";
import { HelmMark } from "~/components/helm-mark";
import { NavMain } from "~/components/nav-main";
import { NavUser } from "~/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  InboxIcon,
  Calendar03Icon,
  AiChat02Icon,
  Settings02Icon,
  WorkflowSquare03Icon,
} from "@hugeicons/core-free-icons";

const navMain = [
  {
    title: "Agent",
    url: "/dashboard/agent",
    icon: <HugeiconsIcon icon={AiChat02Icon} strokeWidth={2} />,
  },
  {
    title: "Inbox",
    url: "/dashboard",
    icon: <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />,
  },
  {
    title: "Calendar",
    url: "/dashboard/calendar",
    icon: <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />,
  },
  {
    title: "Workflows",
    url: "/dashboard/workflows",
    icon: <HugeiconsIcon icon={WorkflowSquare03Icon} strokeWidth={2} />,
  },
  {
    title: "Settings",
    url: "/dashboard/settings",
    icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />,
  },
];

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user?: { name: string; email: string; avatar: string };
}) {
  return (
    <Sidebar collapsible="offcanvas" className="premium-sidebar" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href="/dashboard/agent" />}
            >
              <HelmMark className="size-5!" />
              <span className="from-foreground to-foreground/50 bg-gradient-to-r bg-clip-text font-serif text-xl text-transparent">
                {BRAND}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
      </SidebarContent>
      <SidebarFooter>{user ? <NavUser user={user} /> : null}</SidebarFooter>
    </Sidebar>
  );
}
