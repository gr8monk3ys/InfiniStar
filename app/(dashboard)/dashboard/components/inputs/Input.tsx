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
  const hasError = Boolean(errors[id])
  const errorId = `${id}-error`

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
          spellCheck={type === "email" ? false : undefined}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          {...register(id, { required })}
          className={clsx(
            `
            form-input
            block 
            w-full 
            rounded-md 
            border
            border-input
            bg-background
            py-1.5
            text-foreground
            shadow-sm
            placeholder:text-muted-foreground
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-ring
            focus-visible:ring-offset-2
            sm:text-sm 
            sm:leading-6`,
            errors[id] && "border-destructive focus-visible:ring-destructive",
            disabled && "opacity-50 cursor-default"
          )}
        />
      </div>
      {hasError ? (
        <p id={errorId} className="mt-1 text-sm text-destructive" aria-live="polite">
          Enter a {label.toLowerCase()}.
        </p>
      ) : null}
    </div>
  )
}

export default Input
