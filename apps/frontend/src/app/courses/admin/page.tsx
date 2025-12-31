// apps/frontend/src/app/courses/admin/page.tsx

'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'; // [修改] 引入 mutation 和 queryClient
import { Plus, Edit, Loader2, Trash2 } from 'lucide-react'; // [修改] 引入 Trash2 图标
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
import { toast } from 'sonner'; // [修改] 引入 toast

type Course = {
  id: string;
  title: string;
  slug: string;
  status: 'draft' | 'published';
  accessType: 'free' | 'paid';
  priceCents: number;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CoursesAdminPage() {
  const queryClient = useQueryClient(); // [新增]

  // 获取列表
  const {
    data: courses,
    isLoading,
    isError,
  } = useQuery<Course[]>({
    queryKey: ['admin', 'courses'],
    queryFn: async () => {
      const res = await apiClient.get<Course[]>('/admin/courses');
      return res;
    },
  });

  // [新增] 删除请求的 Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // 调用后端 DELETE 接口
      await apiClient.delete(`/admin/courses/${id}`);
    },
    onSuccess: () => {
      toast.success('课程已删除');
      // 刷新列表
      queryClient.invalidateQueries({ queryKey: ['admin', 'courses'] });
    },
    onError: (error: any) => {
      const msg = error.response?.data?.message || error.message || '删除失败';
      toast.error(`删除失败: ${msg}`);
    },
  });

  // [新增] 删除处理函数
  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个课程吗？与之相关的课节也将被删除，此操作无法撤销。')) {
      deleteMutation.mutate(id);
    }
  };

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
              <TableHead className="w-[250px]">课程标题</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>价格</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>发布时间</TableHead>
              <TableHead>最后更新</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!courses || courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
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
                    {formatDate(course.publishedAt)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    {formatDate(course.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Link href={`/courses/admin/${course.id}/edit`}>
                      <Button variant="outline" size="sm">
                        <Edit className="mr-2 h-4 w-4" /> 编辑 & 课节
                      </Button>
                    </Link>
                    {/* [新增] 删除按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600 hover:bg-red-50"
                      onClick={() => handleDelete(course.id)}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
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
