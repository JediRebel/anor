// apps/frontend/src/app/auth/login/page.tsx
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { login as loginApi, AuthResponse } from '../../../lib/api/auth';
const AUTH_STORAGE_KEY = 'anor_auth';

// 表单校验规则
const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  password: z.string().min(8, '密码至少 8 位'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [authResult, setAuthResult] = useState<AuthResponse | null>(null);
  const router = useRouter(); 

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

const onSubmit = async (values: LoginFormValues) => {
  setServerError(null);
  setAuthResult(null);

  try {
    const result = await loginApi(values);
    setAuthResult(result);

    // 登录成功后，将信息保存到 localStorage，方便后续页面读取
    try {
      const payload = {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        // 记录绝对过期时间，后面可以用来判断是否需要刷新 token
        accessTokenExpiresAt: Date.now() + result.expiresIn * 1000,
        refreshTokenExpiresAt: Date.now() + result.refreshExpiresIn * 1000,
      };

      window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    } catch (storageError) {
      console.warn('Failed to save auth info to localStorage:', storageError);
    }
        // 登录成功后跳转到“当前用户”页面
    router.push('/me');

    console.log('Login success:', result);

  } catch (err) {
    console.error(err);
    setServerError(
      err instanceof Error ? err.message : '登录失败，请稍后重试',
    );
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-center text-2xl font-semibold">登录 Anor 账号</h1>
        <p className="mb-6 text-center text-sm text-slate-600">
          使用在本站注册的邮箱和密码登录
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              邮箱
            </label>
            <input
              type="email"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              密码
            </label>
            <input
              type="password"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              placeholder="至少 8 位"
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {serverError && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? '登录中…' : '登录'}
          </button>
        </form>

        {authResult && (
          <div className="mt-6 rounded border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
            <div>登录成功：</div>
            <div>用户 ID：{authResult.user.id}</div>
            <div>邮箱：{authResult.user.email}</div>
            <div>角色：{authResult.user.role}</div>
            <div className="mt-1 break-all">
              Access Token（前端后面会用来调用受保护接口）：
              {authResult.accessToken}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}