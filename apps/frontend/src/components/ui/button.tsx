// apps/frontend/src/components/ui/button.tsx
"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

/**
 * 基础按钮组件
 * - 默认是蓝色主按钮
 * - 后面可以再扩展 variant / size 等
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm",
          "hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";