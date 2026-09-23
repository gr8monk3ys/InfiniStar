"use client"

import { useId } from "react"
import type { ActionMeta, MultiValue } from "react-select"

import { LazySelect } from "@/app/components/ui/LazySelect"
import { type SelectOption, type SelectProps } from "@/app/types"

const Select: React.FC<SelectProps> = ({ label, value, onChange, options, disabled }) => {
  const inputId = useId()

  const handleChange = (newValue: unknown, _actionMeta: ActionMeta<unknown>) => {
    // Cast through unknown since LazySelect uses generic unknown type
    const typedValue = newValue as MultiValue<SelectOption>
    // Convert readonly array to mutable array for the callback
    onChange([...typedValue])
  }

  return (
    <div className="z-[100]">
      <label
        htmlFor={inputId}
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
        <LazySelect
          inputId={inputId}
          isDisabled={disabled}
          value={value}
          onChange={handleChange}
          isMulti
          options={options}
          // Guarded: this component also renders on the server, where there is no document.
          menuPortalTarget={typeof document === "undefined" ? undefined : document.body}
          styles={{
            menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 9999 }),
          }}
          classNames={{
            control: () => "text-sm",
          }}
        />
      </div>
    </div>
  )
}

export default Select
