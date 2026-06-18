"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";

import { api } from "~/trpc/react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "~/components/ui/sidebar";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: React.ReactNode;
  }[];
}) {
  const pathname = usePathname();
  const utils = api.useUtils();

  function prefetch(url: string) {
    if (url === "/dashboard") {
      void utils.dashboard.summary.prefetch();
      void utils.mail.list.prefetch({ limit: 25 });
      return;
    }
    if (url === "/dashboard/calendar") {
      const now = new Date();
      void utils.calendar.list.prefetch({
        timeMin: startOfWeek(startOfMonth(now)).toISOString(),
        timeMax: endOfWeek(endOfMonth(now)).toISOString(),
      });
      return;
    }
    if (url === "/dashboard/workflows") {
      void utils.workflows.list.prefetch();
      return;
    }
    if (url === "/dashboard/settings") {
      void utils.connections.status.prefetch();
      void utils.preferences.get.prefetch();
      return;
    }
    if (url === "/dashboard/agent") {
      void utils.agent.sessions.list.prefetch();
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          {items.map((item) => {
            const active =
              item.url === "/dashboard"
                ? pathname === item.url
                : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={active}
                  onFocus={() => prefetch(item.url)}
                  onMouseEnter={() => prefetch(item.url)}
                  render={<Link href={item.url} />}
                >
                  {item.icon}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
