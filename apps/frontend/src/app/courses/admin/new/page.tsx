// apps/frontend/src/app/courses/admin/new/page.tsx

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, Save, Send, Upload, Image as ImageIcon } from 'lucide-react';
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
import { toast } from 'sonner';

// 基础 Schema
const baseSchema = z.object({
  title: z.string().optional(),
  slug: z
    .string()
    .optional()
    .refine((val) => !val || /^[a-z0-9-]+$/.test(val), {
      message: 'Slug 只能包含小写字母、数字和连字符',
    }),
  summary: z.string().optional(),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  accessType: z.enum(['free', 'paid']),
  priceCents: z.coerce.number().min(0, '价格不能小于 0'),
  status: z.enum(['draft', 'published']),
});

// 动态校验逻辑
const formSchema = baseSchema.superRefine((data, ctx) => {
  if (data.status === 'published') {
    if (!data.title || data.title.trim() === '') {
      ctx.addIssue({ code: 'custom', message: '发布时标题不能为空', path: ['title'] });
    }
    if (!data.slug || data.slug.trim() === '') {
      ctx.addIssue({ code: 'custom', message: '发布时 Slug 不能为空', path: ['slug'] });
    }
    if (!data.summary || data.summary.trim() === '') {
      ctx.addIssue({ code: 'custom', message: '发布时摘要不能为空', path: ['summary'] });
    }
  }
});

export default function NewCoursePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // 上传状态
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      slug: '',
      summary: '',
      description: '',
      coverImageUrl: '',
      accessType: 'paid',
      priceCents: 0,
      status: 'draft',
    },
  });

  // [修改] 真实的图片上传逻辑
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
      const res = await fetch(`${baseUrl}/admin/uploads/course-cover`, {
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

      // ✅ 这里改为 courseForm
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

  async function onSubmit(values: any, targetStatus: 'draft' | 'published') {
    form.setValue('status', targetStatus);

    const isValid = await form.trigger();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const payload = { ...values, status: targetStatus };

      // [关键] 数据清洗：如果是空字符串，删除该字段，避免后端校验报错
      if (!payload.coverImageUrl || payload.coverImageUrl.trim() === '') {
        delete payload.coverImageUrl;
      }

      if (targetStatus === 'draft') {
        if (!payload.slug || payload.slug === '') {
          if (!payload.title) payload.title = '未命名草稿';
          payload.slug = `draft-${Date.now()}`;
        }
        if (!payload.title) payload.title = '未命名草稿';
      }

      await apiClient.post('/admin/courses', payload);

      toast.success(targetStatus === 'published' ? '发布成功' : '草稿已保存', {
        description: `课程已${targetStatus === 'published' ? '发布' : '保存'}`,
      });

      router.push('/courses/admin');
    } catch (error: any) {
      let msg = '未知错误';
      const resData = error.response?.data;
      if (resData) {
        if (Array.isArray(resData.message)) msg = resData.message.join(', ');
        else if (typeof resData.message === 'string') msg = resData.message;
      } else if (error.message) msg = error.message;
      toast.error('操作失败', { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto py-10 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">新建课程</h1>
        <p className="text-slate-500">创建一个新的课程基础信息</p>
      </div>

      <Form {...form}>
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  课程标题{' '}
                  {form.watch('status') === 'published' && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input placeholder="输入课程标题..." {...field} value={field.value as string} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  URL 标识 (Slug){' '}
                  {form.watch('status') === 'published' && <span className="text-red-500">*</span>}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="example-course-101"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormDescription>唯一标识，草稿状态下必填（建议使用小写字母）。</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* 封面图片部分 */}
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
                        src={field.value as string}
                        alt="Cover Preview"
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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="accessType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>访问类型</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="paid">付费</SelectItem>
                      <SelectItem value="free">免费</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priceCents"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>价格 (分)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      value={field.value as number}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="summary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>简短摘要</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="课程的一句话介绍..."
                    className="resize-none"
                    {...field}
                    value={(field.value as string) || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              取消
            </Button>

            <Button
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => onSubmit(form.getValues(), 'draft')}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              保存草稿
            </Button>

            <Button
              type="button"
              disabled={isSubmitting}
              onClick={() => onSubmit(form.getValues(), 'published')}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              现在发布
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
