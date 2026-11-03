import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../hooks/useAuth';
import { FormField } from '../../components/common/FormField';
import { useToast } from '../../hooks/useToast';

const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: 'shipping01',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoading(true);
    setApiError('');
    try {
      await login(data);
      showToast('Đăng nhập thành công', 'success');
      navigate('/overview');
    } catch (err: any) {
      const msg = err.message || 'Đăng nhập không thành công';
      setApiError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sub flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-border-ui rounded p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-[18px] font-bold text-content-main">
            CỔNG TÁC NGHIỆP HÃNG TÀU
          </h2>
          <p className="text-[13px] text-content-sub">
            Hệ thống quản lý hãng tàu & khai thác bến cảng
          </p>
        </div>

        {apiError && (
          <div className="p-2.5 rounded bg-status-redBg border border-red-200 text-status-redText text-[13px]">
            {apiError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Tên đăng nhập" required error={errors.username?.message}>
            <input
              type="text"
              {...register('username')}
              placeholder="Nhập tên đăng nhập"
              className="w-full h-9 px-3 border border-border-ui rounded text-[14px] bg-white text-content-main focus:outline-none focus:border-brand"
            />
          </FormField>

          <FormField label="Mật khẩu" required error={errors.password?.message}>
            <input
              type="password"
              {...register('password')}
              placeholder="Nhập mật khẩu"
              className="w-full h-9 px-3 border border-border-ui rounded text-[14px] bg-white text-content-main focus:outline-none focus:border-brand"
            />
          </FormField>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-9 bg-brand hover:bg-brand-hover text-white rounded font-medium text-[14px] transition-colors disabled:opacity-50 mt-2"
          >
            {loading ? 'Đang xử lý...' : 'Đăng nhập'}
          </button>
        </form>
      </div>
    </div>
  );
};

