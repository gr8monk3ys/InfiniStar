"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { toast } from "react-hot-toast"

interface LoginFormData {
  email: string
  password: string
}

const LoginPage = () => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: {
      email: "",
      password: "",
    },
  })

  const onSubmit = (data: LoginFormData) => {
    setIsLoading(true)

    signIn("credentials", {
      ...data,
      redirect: false,
    })
      .then((callback) => {
        if (callback?.error) {
          // Show the actual error message from the server
          const errorMessage = callback.error
          toast.error(errorMessage)

          // If the error is about email verification, show a link to resend
          if (errorMessage.includes("verify your email")) {
            setTimeout(() => {
              toast(
                (t) => (
                  <div className="flex flex-col gap-2">
                    <span>Need a new verification link?</span>
                    <button
                      onClick={() => {
                        toast.dismiss(t.id)
                        router.push("/resend-verification")
                      }}
                      className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
                    >
                      Resend Verification Email
                    </button>
                  </div>
                ),
                { duration: 8000 }
              )
            }, 500)
          }
        }

        if (callback?.ok) {
          toast.success("Logged in!")
          router.push("/dashboard")
        }
      })
      .finally(() => setIsLoading(false))
  }

  return (
    <div className="flex min-h-full flex-col justify-center bg-gray-100 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h1 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
          Sign in to your account
        </h1>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} aria-label="Sign in form">
            <div>
              <label htmlFor="email" className="block text-sm font-medium leading-6 text-gray-900">
                Email address
              </label>
              <div className="mt-2">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  disabled={isLoading}
                  {...register("email", { required: true })}
                  aria-required="true"
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                />
                {errors.email && (
                  <p id="email-error" className="mt-1 text-sm text-red-600" role="alert">
                    Email is required
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Password
                </label>
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="font-medium text-sky-600 hover:text-sky-500"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>
              <div className="mt-2">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  {...register("password", { required: true })}
                  aria-required="true"
                  aria-invalid={errors.password ? "true" : "false"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-sky-600 sm:text-sm sm:leading-6"
                />
                {errors.password && (
                  <p id="password-error" className="mt-1 text-sm text-red-600" role="alert">
                    Password is required
                  </p>
                )}
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                aria-busy={isLoading}
                aria-disabled={isLoading}
                className="flex w-full justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage
