// apps/frontend/src/app/page.tsx
import { Button } from "@/components/ui/button";
import { HealthStatus } from "@/components/health-status";

export default function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Anor 移民服务</h1>
      <p className="text-slate-600">
        这里将来会展示移民资讯、课程和工具的概览，作为网站首页入口。
      </p>
        <Button>
        查看移民课程（示例按钮）
      </Button>
      
      {/* 后端健康状态显示 */}
      <HealthStatus />

      {/* 这一段只是用来测试 Tailwind 是否生效，确认完可以删掉 */}
      <p className="rounded-md border border-dashed border-sky-400 bg-sky-50 px-3 py-2 text-sm">
        这是一个 Tailwind 样式测试块，如果你能看到浅蓝色背景和虚线边框，
        说明 Tailwind 已经正常工作。
      </p>
    </section>
  );
}