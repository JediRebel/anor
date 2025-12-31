// apps/frontend/src/app/articles/admin/page.tsx

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Loader2, Trash2, Pin, PinOff, ArrowUpDown, Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

// 类型定义
type Article = {
  id: number;
  title: string;
  slug: string;
  summary: string | null;
  coverImageUrl: string | null;
  status: 'draft' | 'published';
  isPinned: boolean;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
};

// 排序类型
type SortBy = 'title' | 'viewCount' | 'createdAt' | 'publishedAt';
type SortOrder = 'asc' | 'desc';

// 时间格式化
function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ArticlesAdminPage() {
  const queryClient = useQueryClient();

  // ==== 状态管理 ====
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [onlyWithCover, setOnlyWithCover] = useState(false);

  // ==== 1. 获取数据 (使用 React Query) ====
  const {
    data: articlesData,
    isLoading,
    isError,
  } = useQuery<any>({
    queryKey: ['admin', 'articles'],
    queryFn: async () => {
      // 注意：这里假设后端支持一次性拉取所有数据用于前端排序
      // 如果数据量巨大，后续需要在后端实现搜索和排序
      const res = await apiClient.get('/admin/articles?pageSize=1000');
      return res;
    },
  });

  // 处理后端返回结构 (可能是 { items: [...] } 或直接 [...])
  const articles: Article[] = Array.isArray(articlesData)
    ? articlesData
    : articlesData?.items || [];

  // ==== 2. 本地过滤与排序逻辑 ====
  const filteredAndSortedArticles = useMemo(() => {
    let list = [...articles];

    // 搜索过滤
    if (search.trim()) {
      const keyword = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(keyword) ||
          a.slug.toLowerCase().includes(keyword) ||
          (a.summary && a.summary.toLowerCase().includes(keyword)),
      );
    }

    // 封面过滤
    if (onlyWithCover) {
      list = list.filter((a) => !!a.coverImageUrl);
    }

    // 排序逻辑
    list.sort((a, b) => {
      // 1. 置顶优先
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      // 2. 字段排序
      const dir = sortOrder === 'asc' ? 1 : -1;
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      // 特殊处理日期字符串
      if (sortBy === 'createdAt' || sortBy === 'publishedAt') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      }

      if (valA === valB) return 0;
      return (valA > valB ? 1 : -1) * dir;
    });

    return list;
  }, [articles, search, onlyWithCover, sortBy, sortOrder]);

  // ==== 3. Mutation: 删除文章 ====
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/admin/articles/${id}`);
    },
    onSuccess: () => {
      toast.success('文章已删除');
      queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
    },
    onError: (error: any) => {
      toast.error(`删除失败: ${error.message || '未知错误'}`);
    },
  });

  // ==== 4. Mutation: 切换置顶 ====
  const pinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: number; isPinned: boolean }) => {
      await apiClient.patch(`/admin/articles/${id}/pin`, { isPinned });
    },
    onSuccess: () => {
      toast.success('置顶状态已更新');
      queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
    },
    onError: () => {
      toast.error('操作失败');
    },
  });

  // ==== 事件处理 ====
  const handleDelete = (id: number) => {
    if (confirm('确定要删除这篇文章吗？此操作无法撤销。')) {
      deleteMutation.mutate(id);
    }
  };

  const handleTogglePin = (id: number, currentStatus: boolean) => {
    pinMutation.mutate({ id, isPinned: !currentStatus });
  };

  const handleSort = (field: SortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // 渲染排序图标
  const SortIcon = ({ field }: { field: SortBy }) => {
    if (sortBy !== field) return <ArrowUpDown className="ml-1 h-3 w-3 text-slate-300" />;
    return (
      <ArrowUpDown
        className={`ml-1 h-3 w-3 ${sortOrder === 'asc' ? 'rotate-180' : ''} text-slate-900 transition-transform`}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
      </div>
    );
  }

  if (isError) {
    return <div className="py-10 text-center text-red-500">加载失败，请检查网络或权限。</div>;
  }

  return (
    <div className="container mx-auto py-10 space-y-6">
      {/* 顶部标题与操作 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">文章管理</h1>
          <p className="text-slate-500 mt-1">管理所有发布的文章内容与状态</p>
        </div>
        <Link href="/articles/admin/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> 新建文章
          </Button>
        </Link>
      </div>

      {/* 筛选工具栏 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-lg border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="搜索标题、Slug..."
            className="pl-8 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="cover-filter"
            checked={onlyWithCover}
            onCheckedChange={(checked) => setOnlyWithCover(checked as boolean)}
          />
          <label
            htmlFor="cover-filter"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            只看有封面的
          </label>
        </div>

        <div className="ml-auto text-xs text-slate-500">
          共 {filteredAndSortedArticles.length} 篇
        </div>
      </div>

      {/* 表格区域 */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">封面</TableHead>
              <TableHead
                className="w-[300px] cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('title')}
              >
                <div className="flex items-center">
                  标题 <SortIcon field="title" />
                </div>
              </TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>状态</TableHead>
              <TableHead
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('viewCount')}
              >
                <div className="flex items-center">
                  浏览 <SortIcon field="viewCount" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center">
                  创建时间 <SortIcon field="createdAt" />
                </div>
              </TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedArticles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-slate-500">
                  暂无匹配文章
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedArticles.map((article) => (
                <TableRow key={article.id}>
                  {/* 封面 */}
                  <TableCell>
                    {article.coverImageUrl ? (
                      <div className="h-10 w-16 overflow-hidden rounded border bg-slate-100 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            article.coverImageUrl.startsWith('http')
                              ? article.coverImageUrl
                              : `${process.env.NEXT_PUBLIC_API_BASE_URL}${article.coverImageUrl}`
                          }
                          alt="Cover"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-10 w-16 rounded border bg-slate-50 flex items-center justify-center text-[10px] text-slate-300">
                        无封面
                      </div>
                    )}
                  </TableCell>

                  {/* 标题 & 置顶 */}
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 font-medium">
                        {article.isPinned && (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-600 bg-amber-50 px-1 py-0 text-[10px] h-5"
                          >
                            置顶
                          </Badge>
                        )}
                        <span className="truncate max-w-[200px]" title={article.title}>
                          {article.title}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">ID: {article.id}</div>
                    </div>
                  </TableCell>

                  {/* Slug */}
                  <TableCell className="font-mono text-xs text-slate-600">{article.slug}</TableCell>

                  {/* 状态 */}
                  <TableCell>
                    {article.status === 'published' ? (
                      <Badge className="bg-green-600 hover:bg-green-700">已发布</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500">
                        草稿
                      </Badge>
                    )}
                  </TableCell>

                  {/* 浏览量 */}
                  <TableCell className="text-sm font-mono">{article.viewCount}</TableCell>

                  {/* 时间 */}
                  <TableCell className="text-xs text-slate-500">
                    <div>发: {formatDateTime(article.publishedAt)}</div>
                    <div>创: {formatDateTime(article.createdAt)}</div>
                  </TableCell>

                  {/* 操作 */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* 置顶按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-amber-600"
                        title={article.isPinned ? '取消置顶' : '置顶文章'}
                        onClick={() => handleTogglePin(article.id, article.isPinned)}
                        disabled={pinMutation.isPending}
                      >
                        {article.isPinned ? (
                          <PinOff className="h-4 w-4" />
                        ) : (
                          <Pin className="h-4 w-4" />
                        )}
                      </Button>

                      {/* 编辑按钮 */}
                      <Link href={`/articles/admin/${article.id}/edit`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-500 hover:text-blue-600"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>

                      {/* 删除按钮 */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(article.id)}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
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
