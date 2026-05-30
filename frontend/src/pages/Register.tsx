import { Link, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { signupStart } from '@/store/slices/authSlice'
import { Text } from '@/components/ui/Text'
import { Heading } from '@/components/ui/Heading'

// Validation schema for registration
const registerSchema = z
  .object({
    name: z.string().min(2, { message: 'Full name must be at least 2 characters' }),
    email: z.string().email({ message: 'Enter a valid email address' }),
    password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
    confirmPassword: z.string(),
    agreeToTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must agree to the terms and conditions' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type RegisterFormValues = z.infer<typeof registerSchema>

export default function Register() {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { isAuthenticated, status } = useSelector((state: any) => state.auth)

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      agreeToTerms: true, // auto agree for seamless mock experience
    },
  })

  const onSubmit = (data: RegisterFormValues) => {
    dispatch(signupStart({ name: data.name, email: data.email, password: data.password }))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col items-center justify-center text-center">
        <div className="size-10 rounded-lg bg-accent flex items-center justify-center font-bold text-white shadow-none text-lg">
          FS
        </div>
        <Heading level={2} variant="sectionTitle" className="mt-4 text-xl font-bold tracking-tight text-textPrimary">
          Create your account
        </Heading>
        <Text variant="caption" className="mt-1 text-textMuted">
          Sign up to access 15-year histories and screeners
        </Text>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-1.5">
          <Text variant="label" as={Label} className="text-[10px] tracking-wide">
            Full Name
          </Text>
          <Input
            type="text"
            placeholder="John Doe"
            {...register('name')}
            className={errors.name ? 'border-negative focus:border-negative bg-surfaceMuted text-xs' : 'bg-surfaceMuted text-xs border-border'}
          />
          {errors.name && (
            <Text variant="caption" className="text-[10px] text-negative font-semibold">{errors.name.message}</Text>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Text variant="label" as={Label} className="text-[10px] tracking-wide">
            Email Address
          </Text>
          <Input
            type="email"
            placeholder="name@company.com"
            {...register('email')}
            className={errors.email ? 'border-negative focus:border-negative bg-surfaceMuted text-xs' : 'bg-surfaceMuted text-xs border-border'}
          />
          {errors.email && (
            <Text variant="caption" className="text-[10px] text-negative font-semibold">{errors.email.message}</Text>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Text variant="label" as={Label} className="text-[10px] tracking-wide">
            Password
          </Text>
          <Input
            type="password"
            placeholder="••••••••"
            {...register('password')}
            className={errors.password ? 'border-negative focus:border-negative bg-surfaceMuted text-xs' : 'bg-surfaceMuted text-xs border-border'}
          />
          {errors.password && (
            <Text variant="caption" className="text-[10px] text-negative font-semibold">{errors.password.message}</Text>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <Text variant="label" as={Label} className="text-[10px] tracking-wide">
            Confirm Password
          </Text>
          <Input
            type="password"
            placeholder="••••••••"
            {...register('confirmPassword')}
            className={errors.confirmPassword ? 'border-negative focus:border-negative bg-surfaceMuted text-xs' : 'bg-surfaceMuted text-xs border-border'}
          />
          {errors.confirmPassword && (
            <Text variant="caption" className="text-[10px] text-negative font-semibold">{errors.confirmPassword.message}</Text>
          )}
        </div>

        {/* Agree to terms */}
        <div className="flex items-start gap-2">
          <Checkbox id="agreeToTerms" {...register('agreeToTerms')} className="border-border data-[state=checked]:bg-accent data-[state=checked]:text-white" defaultChecked />
          <div className="flex flex-col gap-1">
            <Text variant="bodyMuted" as={Label} htmlFor="agreeToTerms" className="text-xs font-semibold select-none cursor-pointer text-textSecondary leading-tight">
              I agree to the terms of service and institutional data agreement
            </Text>
            {errors.agreeToTerms && (
              <Text variant="caption" className="text-[10px] text-negative font-semibold">{errors.agreeToTerms.message}</Text>
            )}
          </div>
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isSubmitting || status === 'loading'}
          className="w-full bg-accent hover:bg-accent/90 text-white font-bold text-xs uppercase h-10 shadow-none mt-2"
        >
          {isSubmitting || status === 'loading' ? 'Creating Account...' : 'Create Account'}
        </Button>
      </form>

      {/* Google OAuth Button */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/50" />
        </div>
        <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-wider">
          <Text variant="caption" as="span" className="bg-surface px-2.5 text-textMuted">Or sign up with</Text>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          navigate('/')
        }}
        className="w-full h-10 font-bold text-xs uppercase border-border hover:bg-surfaceMuted text-textSecondary shadow-none flex items-center justify-center gap-2"
      >
        <svg className="size-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign up with Google
      </Button>

      {/* Footer Link */}
      <div className="text-center text-xs font-semibold text-textSecondary">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign In
        </Link>
      </div>
    </div>
  )
}

