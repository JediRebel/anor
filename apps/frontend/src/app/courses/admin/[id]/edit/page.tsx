// apps/frontend/src/app/courses/admin/[id]/edit/page.tsx

'use client';

import { useEffect, useState, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Loader2,
  Plus,
  Trash2,
  ArrowLeft,
  Pencil,
  Save,
  Send,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const courseBaseSchema = z.object({
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
  priceCents: z.coerce.number().min(0),
  status: z.enum(['draft', 'published']),
});

const courseFormSchema = courseBaseSchema.superRefine((data, ctx) => {
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

const lessonFormSchema = z
  .object({
    title: z.string().min(1, '课节标题不能为空'),
    slug: z
      .string()
      .min(1, 'Slug 不能为空')
      .regex(/^[a-z0-9-]+$/, 'Slug 只能包含小写字母、数字和连字符'),
    type: z.enum(['video', 'text']),
    videoUrl: z.string().optional(),
    contentText: z.string().optional(),
    isFreePreview: z.boolean().default(false),
    status: z.enum(['draft', 'published']),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'video') {
      if (data.status === 'published' && (!data.videoUrl || data.videoUrl.trim() === '')) {
        ctx.addIssue({
          code: 'custom',
          message: '发布状态下，视频 URL 不能为空',
          path: ['videoUrl'],
        });
      }
      if (data.videoUrl && data.videoUrl.trim() !== '') {
        const result = z.string().url().safeParse(data.videoUrl);
        if (!result.success) {
          ctx.addIssue({ code: 'custom', message: '请输入有效的 URL 地址', path: ['videoUrl'] });
        }
      }
    }
  });

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditCoursePage(props: PageProps) {
  const params = use(props.params);
  const courseId = params.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [imgError, setImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLessonDialogOpen, setIsLessonDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);

  const courseForm = useForm({
    resolver: zodResolver(courseFormSchema),
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

  const lessonForm = useForm({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: {
      title: '',
      slug: '',
      type: 'video',
      videoUrl: '',
      contentText: '',
      isFreePreview: false,
      status: 'draft',
    },
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [courseRes, lessonsRes] = await Promise.all([
          apiClient.get<any>(`/admin/courses/${courseId}`),
          apiClient.get<any[]>(`/admin/courses/${courseId}/lessons`),
        ]);

        courseForm.reset({
          title: courseRes.title,
          slug: courseRes.slug,
          summary: courseRes.summary || '',
          description: courseRes.description || '',
          coverImageUrl: courseRes.coverImageUrl || '',
          accessType: courseRes.accessType,
          priceCents: courseRes.priceCents,
          status: courseRes.status,
        });

        setLessons(lessonsRes || []);
      } catch (error) {
        toast.error('加载失败，请重试');
        router.push('/courses/admin');
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [courseId, courseForm, router]);

  // [修改] 真实的图片上传逻辑
  // [修改] 优化后的图片上传逻辑
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

      // --------- 修改开始：精准处理错误信息 ---------
      if (!res.ok) {
        // 1. 专门处理 413 文件过大
        if (res.status === 413) {
          throw new Error('文件过大，请上传不超过 5MB 的图片');
        }

        // 2. 其他错误，尝试读取后端返回的 message
        const errorData = await res.json().catch(() => ({}));
        const serverMsg = errorData.message;
        // NestJS 有时返回数组，有时返回字符串，做一下兼容
        const displayMsg = Array.isArray(serverMsg) ? serverMsg.join(', ') : serverMsg;

        throw new Error(displayMsg || '上传失败');
      }
      // --------- 修改结束 ---------

      const data = await res.json();
      courseForm.setValue('coverImageUrl', data.url);
      setImgError(false);
      toast.success('图片上传成功');
    } catch (error: any) {
      console.error(error);
      // [修改] 显示具体的错误原因
      toast.error(error.message || '图片上传失败，请重试');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  async function onCourseSubmit(values: any, targetStatus: 'draft' | 'published') {
    courseForm.setValue('status', targetStatus);
    const isValid = await courseForm.trigger();
    if (!isValid) return;

    setIsSavingCourse(true);
    try {
      const payload = { ...values, status: targetStatus };

      // 数据清洗：避免空字符串导致 URL 校验失败
      if (!payload.coverImageUrl || payload.coverImageUrl.trim() === '') {
        delete payload.coverImageUrl;
      }

      if (targetStatus === 'draft' && (!payload.slug || payload.slug === '')) {
        payload.slug = `draft-${Date.now()}`;
      }

      await apiClient.patch(`/admin/courses/${courseId}`, payload);

      toast.success(targetStatus === 'published' ? '发布成功' : '草稿已保存');

      const updatedCourse = await apiClient.get<any>(`/admin/courses/${courseId}`);
      courseForm.reset({
        title: updatedCourse.title,
        slug: updatedCourse.slug,
        summary: updatedCourse.summary || '',
        description: updatedCourse.description || '',
        coverImageUrl: updatedCourse.coverImageUrl || '',
        accessType: updatedCourse.accessType,
        priceCents: updatedCourse.priceCents,
        status: updatedCourse.status,
      });

      router.refresh();
    } catch (error: any) {
      let msg = '更新失败';
      const resData = error.response?.data;
      if (resData) {
        if (Array.isArray(resData.message)) msg = resData.message.join(', ');
        else if (typeof resData.message === 'string') msg = resData.message;
      } else if (error.message) msg = error.message;
      toast.error('操作失败', { description: msg });
    } finally {
      setIsSavingCourse(false);
    }
  }

  // 课节逻辑
  async function onLessonSubmit(values: any) {
    try {
      const payload = { ...values };
      if (payload.type === 'video' && (!payload.videoUrl || payload.videoUrl.trim() === '')) {
        delete payload.videoUrl;
      }

      if (editingLesson) {
        await apiClient.patch(`/admin/courses/lessons/${editingLesson.id}`, payload);
        toast.success('课节更新成功');
      } else {
        await apiClient.post(`/admin/courses/${courseId}/lessons`, payload);
        toast.success('课节创建成功');
      }

      const updatedLessons = await apiClient.get<any[]>(`/admin/courses/${courseId}/lessons`);
      setLessons(updatedLessons || []);

      setIsLessonDialogOpen(false);
      setEditingLesson(null);
      lessonForm.reset();
    } catch (error: any) {
      let msg = '操作失败';
      if (error.response?.data?.message) {
        msg = Array.isArray(error.response.data.message)
          ? error.response.data.message[0]
          : error.response.data.message;
      }
      toast.error(msg);
    }
  }

  const openNewLessonDialog = () => {
    setEditingLesson(null);
    lessonForm.reset({
      title: '',
      slug: '',
      type: 'video',
      videoUrl: '',
      contentText: '',
      isFreePreview: false,
      status: 'draft',
    });
    setIsLessonDialogOpen(true);
  };

  const openEditLessonDialog = (lesson: any) => {
    setEditingLesson(lesson);
    lessonForm.reset({
      title: lesson.title,
      slug: lesson.slug,
      type: lesson.type,
      videoUrl: lesson.videoUrl || '',
      contentText: lesson.contentText || '',
      isFreePreview: lesson.isFreePreview,
      status: lesson.status,
    });
    setIsLessonDialogOpen(true);
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('确定要删除这个课节吗？此操作无法撤销。')) return;
    try {
      await apiClient.delete(`/admin/courses/lessons/${lessonId}`);
      toast.success('课节已删除');
      const updatedLessons = await apiClient.get<any[]>(`/admin/courses/${courseId}/lessons`);
      setLessons(updatedLessons || []);
    } catch (error: any) {
      toast.error('删除失败');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10 max-w-6xl space-y-8">
      {/* 顶部导航 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/courses/admin')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
        </Button>
        <h1 className="text-2xl font-bold">编辑课程</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>修改课程的标题、价格和内容</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...courseForm}>
                <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
                  <FormField
                    control={courseForm.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          课程标题{' '}
                          {courseForm.watch('status') === 'published' && (
                            <span className="text-red-500">*</span>
                          )}
                        </FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value as string} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={courseForm.control}
                      name="slug"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Slug{' '}
                            {courseForm.watch('status') === 'published' && (
                              <span className="text-red-500">*</span>
                            )}
                          </FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value as string} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={courseForm.control}
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
                    control={courseForm.control}
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
                            <SelectItem value="free">免费</SelectItem>
                            <SelectItem value="paid">付费</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={courseForm.control}
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
                                alt="Cover"
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                              />
                            ) : (
                              <div className="flex flex-col items-center text-slate-400 gap-2">
                                <ImageIcon className="h-8 w-8" />
                                <span className="text-sm text-red-400">预览失败</span>
                              </div>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={courseForm.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>摘要</FormLabel>
                        <FormControl>
                          <Textarea {...field} value={(field.value as string) || ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={courseForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>详细描述</FormLabel>
                        <FormControl>
                          <Textarea
                            className="h-32"
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
                      variant="secondary"
                      disabled={isSavingCourse}
                      onClick={() => onCourseSubmit(courseForm.getValues(), 'draft')}
                    >
                      {isSavingCourse ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      保存草稿
                    </Button>

                    <Button
                      type="button"
                      disabled={isSavingCourse}
                      onClick={() => onCourseSubmit(courseForm.getValues(), 'published')}
                    >
                      {isSavingCourse ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {courseForm.getValues('status') === 'published' ? '更新发布' : '立即发布'}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：课节管理列表 (占 1 列) */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">课节内容</CardTitle>
              <Dialog open={isLessonDialogOpen} onOpenChange={setIsLessonDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" onClick={openNewLessonDialog}>
                    <Plus className="h-4 w-4" /> 添加
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingLesson ? '编辑课节' : '新建课节'}</DialogTitle>
                  </DialogHeader>

                  {/* 课节表单 */}
                  <Form {...lessonForm}>
                    <form
                      onSubmit={lessonForm.handleSubmit(onLessonSubmit)}
                      className="space-y-4 py-4"
                    >
                      <FormField
                        control={lessonForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>课节标题</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value as string} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={lessonForm.control}
                        name="slug"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Slug</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value as string} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={lessonForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>类型</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value as string}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="video">视频</SelectItem>
                                  <SelectItem value="text">图文</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={lessonForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>状态</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value as string}
                              >
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
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
                      </div>
                      {lessonForm.watch('type') === 'video' && (
                        <FormField
                          control={lessonForm.control}
                          name="videoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>视频 URL</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="https://..."
                                  {...field}
                                  value={(field.value as string) || ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={lessonForm.control}
                        name="isFreePreview"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                              <FormLabel>免费试看</FormLabel>
                              <FormDescription>允许未购买用户查看</FormDescription>
                            </div>
                            <FormControl>
                              <input
                                type="checkbox"
                                checked={!!field.value}
                                onChange={field.onChange}
                                className="h-4 w-4"
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit">保存课节</Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto">
              {lessons.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm">
                  暂无课节，请点击右上角添加
                </div>
              ) : (
                <div className="space-y-2">
                  {lessons.map((lesson, index) => (
                    <div
                      key={lesson.id}
                      className="group flex items-center justify-between p-3 border rounded-md bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-mono text-xs w-6">#{index + 1}</span>
                        <div>
                          <div className="font-medium text-sm flex items-center gap-2">
                            {lesson.title}
                            {lesson.isFreePreview && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">
                                试看
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400">
                            {lesson.slug} · {lesson.type}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditLessonDialog(lesson)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteLesson(lesson.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
