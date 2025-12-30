// apps/frontend/src/app/courses/admin/new/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
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

const formSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  slug: z
    .string()
    .min(1, 'Slug 不能为空')
    .regex(/^[a-z0-9-]+$/, 'Slug 只能包含小写字母、数字和连字符'),
  summary: z.string().optional(),
  description: z.string().optional(),
  accessType: z.enum(['free', 'paid']),
  priceCents: z.coerce.number().min(0, '价格不能小于 0'),
  status: z.enum(['draft', 'published']),
});

type FormValues = z.infer<typeof formSchema>;

export default function NewCoursePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      slug: '',
      summary: '',
      description: '',
      accessType: 'paid',
      priceCents: 0,
      status: 'draft',
    },
  });

  async function onSubmit(values: FormValues) {
    setIsSubmitting(true);
    try {
      await apiClient.post('/admin/courses', values);

      toast.success('创建成功', {
        description: '课程已成功创建',
      });

      router.push('/courses/admin');
    } catch (error: any) {
      toast.error('创建失败', {
        description: error.response?.data?.message || '未知错误',
      });
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>课程标题</FormLabel>
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
                <FormLabel>URL 标识 (Slug)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="example-course-101"
                    {...field}
                    value={field.value as string}
                  />
                </FormControl>
                <FormDescription>唯一标识，只能包含小写字母、数字和连字符。</FormDescription>
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
                        <SelectValue placeholder="选择类型" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="free">免费</SelectItem>
                      <SelectItem value="paid">付费</SelectItem>
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
                  <FormDescription>例如：1000 表示 10.00 元</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>状态</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value as string}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="选择状态" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="draft">草稿</SelectItem>
                    <SelectItem value="published">发布</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>详细描述</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="详细介绍课程内容..."
                    className="h-32"
                    {...field}
                    value={(field.value as string) || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              创建课程
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
