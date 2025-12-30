// apps/frontend/src/app/courses/admin/page.tsx

'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type Course = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  accessType: 'free' | 'paid';
  priceCents: number;
  publishedAt: string | null;
  createdAt: string;
};

export default function CoursesAdminPage() {
  const {
    data: courses,
    isLoading,
    isError,
  } = useQuery<Course[]>({
    queryKey: ['admin', 'courses'],
    queryFn: async () => {
      // [修正]：直接返回 res，因为 apiClient 已经处理了解析
      const res = await apiClient.get<Course[]>('/admin/courses');
      return res;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-10 text-center text-red-500">加载失败，请检查登录状态或网络连接。</div>
    );
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">课程管理</h1>
          <p className="text-slate-500 mt-1">管理所有发布的课程与课节内容</p>
        </div>
        <Link href="/courses/admin/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> 新建课程
          </Button>
        </Link>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">课程标题</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>发布时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!courses || courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  暂无课程
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{course.title}</span>
                      <span className="text-xs text-slate-400 font-mono">
                        ID: {course.id.slice(0, 8)}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{course.slug}</TableCell>
                  <TableCell>
                    {course.accessType === 'free' ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-800 hover:bg-green-200"
                      >
                        免费
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-800 hover:bg-blue-200"
                      >
                        付费
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {course.accessType === 'free'
                      ? '-'
                      : `¥${(course.priceCents / 100).toFixed(2)}`}
                  </TableCell>
                  <TableCell>
                    {course.status === 'published' ? (
                      <Badge className="bg-green-600 hover:bg-green-700">已发布</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500">
                        草稿
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {course.publishedAt ? format(new Date(course.publishedAt), 'yyyy-MM-dd') : '-'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link href={`/courses/admin/${course.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-2 h-4 w-4" /> 编辑 & 课节
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
