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
      <label htmlFor={id} className="block text-sm font-medium leading-6 text-foreground">
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
            "form-input block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm leading-6 text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background sm:text-sm",
            errors[id] && "border-destructive focus-visible:ring-destructive",
            disabled && "opacity-50 cursor-default"
          )}
        />
      </div>
    </div>
  )
}

export default Input
