"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";

export function ProfileSection({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar size="lg">
              <AvatarImage src={user.image ?? undefined} alt={user.name} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <span className="text-base font-medium">{user.name}</span>
              <span className="text-muted-foreground text-sm">
                {user.email}
              </span>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Email</span>
              <span className="text-sm">{user.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Provider</span>
              <Badge variant="secondary">Google</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
