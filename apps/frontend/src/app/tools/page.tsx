import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, Map } from 'lucide-react';

export const metadata = {
  title: '移民工具中心 | Anor',
  description: '提供专业的移民评估工具，包括 EE 分数计算器和移民路径智能规划。',
};

export default function ToolsPage() {
  const tools = [
    {
      title: 'EE 分数计算器',
      description: 'Express Entry CRS 官方打分模拟，实时计算您的年龄、学历、语言和工作经验得分。',
      href: '/tools/ee-score',
      icon: <Calculator className="h-8 w-8 text-blue-600" />,
      actionText: '开始计算',
    },
    {
      title: '移民路径智能规划',
      description: '回答几个简单问题，通过智能决策树为您推荐最适合的加拿大移民项目。',
      href: '/tools/path-selector',
      icon: <Map className="h-8 w-8 text-green-600" />,
      actionText: '开始规划',
    },
  ];

  return (
    <div className="container mx-auto py-12 px-4 space-y-8">
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          自助评估工具
        </h1>
        <p className="text-lg text-slate-600">
          我们开发了一系列免费工具，帮助您快速了解自己的移民优势和潜在方案。
          所有计算均在本地完成，保护您的隐私。
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:max-w-4xl lg:mx-auto">
        {tools.map((tool) => (
          <Card key={tool.href} className="flex flex-col hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mb-4">{tool.icon}</div>
              <CardTitle className="text-xl">{tool.title}</CardTitle>
              <CardDescription className="text-base mt-2">{tool.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto pt-6">
              <Button asChild size="lg" className="w-full">
                <Link href={tool.href}>{tool.actionText}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
