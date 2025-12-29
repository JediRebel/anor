// apps/frontend/src/app/register/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { register } from '@/lib/api/auth';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 64;
const MAX_EMAIL_LENGTH = 128;

// 和后端 RegisterDto 保持一致的复杂度规则
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

export default function RegisterPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 密码显示/隐藏
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setErrorMsg(null);
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    setErrorMsg(null);

    const email = form.email.trim();
    const password = form.password;
    const confirmPassword = form.confirmPassword;

    // ===== 基础前端校验（与后端规则对齐） =====
    if (!email) {
      setErrorMsg('请输入邮箱');
      return;
    }
    if (email.length > MAX_EMAIL_LENGTH) {
      setErrorMsg(`邮箱长度不能超过 ${MAX_EMAIL_LENGTH} 个字符`);
      return;
    }

    if (!password) {
      setErrorMsg('请输入密码');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMsg(`密码长度至少 ${MIN_PASSWORD_LENGTH} 位`);
      return;
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      setErrorMsg(`密码长度不能超过 ${MAX_PASSWORD_LENGTH} 位`);
      return;
    }
    if (!PASSWORD_COMPLEXITY_REGEX.test(password)) {
      setErrorMsg('密码至少 8 位，且必须包含大写字母、小写字母、数字和特殊符号');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      // 调用后端 /auth/register（注册即登录）
      // 注册成功后：后端已通过 Set-Cookie 建立会话；前端不保存任何 token 或本地凭证，直接跳转到 /me
      await register({ email, password });

      // 注册后跳转到 /me（以后可以改成“我的课程”等页面）
      router.push('/me');
    } catch (err) {
      let msg = '注册失败，请稍后重试。';

      // 这里会优先展示后端返回的详细错误
      if (err instanceof Error && err.message) {
        msg = err.message;
      }

      setErrorMsg(msg);
      // 不 console.error，避免左下角红色 Issues
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-center text-2xl font-semibold">注册新账号</h1>

        <p className="mb-6 text-center text-xs text-slate-500">
          注册成功后会自动登录，并跳转到当前用户页面。
        </p>

        {errorMsg && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* 邮箱 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">邮箱</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="例如：user@example.com"
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">密码</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 pr-16 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="至少 8 位，包含大小写字母、数字和特殊符号"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 hover:text-slate-700"
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              密码需至少 8 位，并包含大写字母、小写字母、数字和特殊符号（例如 @、#、! 等）。
            </p>
          </div>

          {/* 确认密码 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">确认密码</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                className="block w-full rounded-md border border-slate-300 px-3 py-2 pr-16 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="再次输入密码"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                className="absolute inset-y-0 right-3 flex items-center text-xs text-slate-500 hover:text-slate-700"
              >
                {showConfirmPassword ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? '注册中…' : '注册并登录'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          已有账号？{' '}
          <Link href="/login" className="font-medium text-blue-600 underline underline-offset-2">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
