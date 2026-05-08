"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { QueryProvider } from "@/providers/query-provider"
import { Toaster } from "sonner"

export function Providers({ children }: {
  children: React.ReactNode
}) {
  return (
    <QueryProvider>
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster />
      </NextThemesProvider>
    </QueryProvider>
  )
}
