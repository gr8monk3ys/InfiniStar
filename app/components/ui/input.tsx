"use client"

import clsx from "clsx"
import { type FieldErrors, type FieldValues, type UseFormRegister } from "react-hook-form"

interface InputProps {
  label: string
  id: string
  type?: string
  required?: boolean
  register: UseFormRegister<FieldValues>
  errors: FieldErrors
  disabled?: boolean
}

const Input: React.FC<InputProps> = ({
  label,
  id,
  register,
  required,
  errors,
  type = "text",
  disabled,
}) => {
  return (
    <div>
      <label
        htmlFor={id}
        className="
          block
          text-sm
          font-medium
          leading-6
          text-foreground
        "
      >
        {label}
      </label>
      <div className="mt-2">
        <input
          id={id}
          type={type}
          autoComplete={id}
          disabled={disabled}
          {...register(id, { required })}
          className={clsx(
            `
            form-input
            block
            w-full
            rounded-lg
            border-0
            bg-background
            py-1.5
            text-foreground
            shadow-sm
            ring-1
            ring-inset
            ring-border
            placeholder:text-muted-foreground
            focus:ring-2
            focus:ring-inset
            focus:ring-ring
            sm:text-sm
            sm:leading-6`,
            errors[id] && "focus:ring-destructive",
            disabled && "opacity-50 cursor-default"
          )}
        />
      </div>
    </div>
  )
}

export default Input
