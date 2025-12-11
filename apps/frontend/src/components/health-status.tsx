// apps/frontend/src/components/health-status.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

type HealthResponse = {
  status: string;
  // 你后端 /health 返回什么字段都可以，这里只是示例
  timestamp?: string;
};

export function HealthStatus() {
  const { data, isLoading, isError, error } = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => apiClient.get<HealthResponse>("/health"),
  });

  if (isLoading) {
    return (
      <p className="text-xs text-slate-500">
        正在检查后端服务状态…
      </p>
    );
  }

  if (isError) {
    return (
      <p className="text-xs text-red-600">
        后端健康检查失败：
        {error instanceof Error ? error.message : "未知错误"}
      </p>
    );
  }

  return (
    <p className="text-xs text-emerald-600">
      后端健康检查正常
      {data?.status ? `（status: ${data.status}）` : ""}
    </p>
  );
}