import React from 'react'
import { cn } from '@/utils/cn'

const Input = React.forwardRef(({
  className,
  type = 'text',
  error,
  disabled,
  ...props
}, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-secondary-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-secondary-500',
        'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors duration-200',
        error && 'border-danger-500 focus:ring-danger-500',
        className
      )}
      ref={ref}
      disabled={disabled}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={error ? `${props.id}-error` : undefined}
      {...props}
    />
  )
})

Input.displayName = 'Input'

export default Input