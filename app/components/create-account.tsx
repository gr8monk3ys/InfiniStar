"use client"

import { Button } from "@/app/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card"
import { Label } from "@/app/components/ui/label"
import { Icons } from "@/app/components/icons"

export function DemoCreateAccount() {
  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Create an Account</CardTitle>
        <CardDescription>Enter your email below to create your account</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-6">
          <Button type="button" variant="outline">
            <Icons.gitHub className="mr-2 size-4" aria-hidden="true" />
            GitHub
          </Button>
          <Button type="button" variant="outline">
            <Icons.google className="mr-2 size-4" aria-hidden="true" />
            Google
          </Button>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            spellCheck={false}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button className="w-full">Create Account</Button>
      </CardFooter>
    </Card>
  )
}
