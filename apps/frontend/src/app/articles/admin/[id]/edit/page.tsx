// apps/frontend/src/app/articles/admin/[id]/edit/page.tsx

'use client';

import { useEffect, useState, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save, Upload, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

// Zod Schema
const articleSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  slug: z
    .string()
    .min(1, 'Slug 不能为空')
    .regex(/^[a-z0-9-]+$/, 'Slug 只能包含小写字母、数字和连字符'),
  summary: z.string().optional(),
  content: z.string().optional(),
  coverImageUrl: z.string().optional(),
  status: z.enum(['draft', 'published']),
  isPinned: z.boolean().default(false),
});

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditArticlePage(props: PageProps) {
  const params = use(props.params);
  const articleId = params.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 移除泛型，让 hook 自动推断
  const form = useForm({
    resolver: zodResolver(articleSchema),
    defaultValues: {
      title: '',
      slug: '',
      summary: '',
      content: '',
      coverImageUrl: '',
      status: 'published',
      isPinned: false,
    },
  });

  // 加载数据
  useEffect(() => {
    async function fetchData() {
      try {
        const data = await apiClient.get<any>(`/admin/articles/${articleId}`);
        form.reset({
          title: data.title,
          slug: data.slug,
          summary: data.summary || '',
          content: data.content || '',
          coverImageUrl: data.coverImageUrl || '',
          status: data.status,
          isPinned: data.isPinned,
        });
      } catch (error) {
        toast.error('加载文章失败');
        router.push('/articles/admin');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [articleId, form, router]);

  // 图片上传逻辑
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/admin/uploads/article-cover`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 413) {
          throw new Error('文件过大，请上传不超过 5MB 的图片');
        }
        const errorData = await res.json().catch(() => ({}));
        const serverMsg = errorData.message;
        const displayMsg = Array.isArray(serverMsg) ? serverMsg.join(', ') : serverMsg;
        throw new Error(displayMsg || '上传失败');
      }

      const data = await res.json();
      form.setValue('coverImageUrl', data.url);
      setImgError(false);
      toast.success('图片上传成功');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '图片上传失败，请重试');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 参数类型设为 any
  const onSubmit = async (values: any) => {
    setIsSubmitting(true);
    try {
      // 数据清洗
      const payload = { ...values };
      if (!payload.coverImageUrl || payload.coverImageUrl.trim() === '') {
        delete payload.coverImageUrl;
      }

      // [核心修复] 使用 PUT 方法，与后端 @Put(':id') 保持一致
      await apiClient.put(`/admin/articles/${articleId}`, payload);

      toast.success('文章更新成功');
      router.push('/articles/admin');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.message || '更新失败';
      toast.error(`操作失败: ${Array.isArray(msg) ? msg.join(', ') : msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <Loader2 className="animate-spin h-8 w-8 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-3xl space-y-8">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/articles/admin')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
        </Button>
        <h1 className="text-2xl font-bold">编辑文章</h1>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 标题 */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    文章标题 <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="输入文章标题..." {...field} value={field.value as string} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Slug */}
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Slug (URL 片段) <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="example-article-slug"
                      {...field}
                      value={field.value as string}
                    />
                  </FormControl>
                  <FormDescription>仅允许小写字母、数字和连字符。</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 封面图片 */}
            <FormField
              control={form.control}
              name="coverImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>封面图片</FormLabel>
                  <div className="space-y-3">
                    <FormControl>
                      <Input
                        placeholder="https://..."
                        {...field}
                        value={field.value as string}
                        onChange={(e) => {
                          field.onChange(e);
                          setImgError(false);
                        }}
                      />
                    </FormControl>
                    <div>
                      <input
                        type="file"
                        className="hidden"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full sm:w-auto"
                        disabled={isUploading}
                      >
                        {isUploading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 上传中...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" /> 本地上传
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {field.value && (
                    <div className="mt-3 w-full h-48 bg-slate-100 rounded-md overflow-hidden border flex items-center justify-center relative">
                      {!imgError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={
                            (field.value as string).startsWith('http')
                              ? (field.value as string)
                              : `${process.env.NEXT_PUBLIC_API_BASE_URL}${field.value}`
                          }
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-400 gap-2">
                          <ImageIcon className="h-8 w-8" />
                          <span className="text-sm text-red-400">预览失败，请输入正确的 URL</span>
                        </div>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 摘要 */}
            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>摘要</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="文章简短摘要..."
                      className="resize-none"
                      {...field}
                      value={(field.value as string) || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 正文 */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>正文内容</FormLabel>
                  <FormControl>
                    <Textarea
                      className="h-64"
                      placeholder="在此输入文章内容..."
                      {...field}
                      value={(field.value as string) || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 状态与置顶 - 并排布局 */}
            <div className="flex flex-col sm:flex-row gap-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>状态</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="published">已发布</SelectItem>
                        <SelectItem value="draft">草稿</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isPinned"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm sm:mt-8">
                    <FormControl>
                      <Checkbox checked={field.value as boolean} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>置顶文章</FormLabel>
                      <FormDescription>该文章将显示在列表顶部</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

            {/* 底部按钮 */}
            <div className="flex justify-end gap-4 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isSubmitting}
              >
                取消
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                保存更新
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
