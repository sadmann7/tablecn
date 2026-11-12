"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";

import { ThemeColor } from "@/components/theme-color";
import { ThemeShortcut } from "@/components/theme-shortcut";
import { TooltipProvider } from "@/registry/bases/radix/ui/tooltip";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider {...props}>
        <TooltipProvider delayDuration={120}>
          <NuqsAdapter>
            <ThemeColor />
            <ThemeShortcut />
            {children}
          </NuqsAdapter>
        </TooltipProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  );
}
