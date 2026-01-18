"use client"

import React, { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { type User } from "@prisma/client"
import axios from "axios"
import { CldUploadButton, type CloudinaryUploadWidgetResults } from "next-cloudinary"
import { useForm, type FieldValues, type SubmitHandler } from "react-hook-form"
import { toast } from "react-hot-toast"

import Button from "@/app/components/Button"
import StatusModal from "@/app/components/modals/StatusModal"

import Input from "../inputs/Input"
import Modal from "../modals/Modal"

interface SettingsModalProps {
  isOpen?: boolean
  onClose: () => void
  currentUser: User
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, currentUser = {} }) => {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FieldValues>({
    defaultValues: {
      name: currentUser?.name,
      image: currentUser?.image,
    },
  })

  const image = watch("image")

  const handleUpload = (result: CloudinaryUploadWidgetResults) => {
    if (result.info && typeof result.info !== "string" && result.info.secure_url) {
      setValue("image", result.info.secure_url, {
        shouldValidate: true,
      })
    }
  }

  const onSubmit: SubmitHandler<FieldValues> = (data) => {
    setIsLoading(true)

    axios
      .post("/api/settings", data)
      .then(() => {
        router.refresh()
        onClose()
      })
      .catch(() => toast.error("Something went wrong!"))
      .finally(() => setIsLoading(false))
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-12">
          <div className="border-b border-gray-900/10 pb-12">
            <h2
              className="
                text-base 
                font-semibold 
                leading-7 
                text-gray-900
              "
            >
              Profile
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">Edit your public information.</p>

            <div className="mt-10 flex flex-col gap-y-8">
              <Input
                disabled={isLoading}
                label="Name"
                id="name"
                errors={errors}
                required
                register={register}
              />
              <div>
                <label
                  htmlFor="photo"
                  className="
                    block 
                    text-sm 
                    font-medium 
                    leading-6 
                    text-gray-900
                  "
                >
                  Photo
                </label>
                <div className="mt-2 flex items-center gap-x-3">
                  <Image
                    width="48"
                    height="48"
                    className="rounded-full"
                    src={image || currentUser?.image || "/images/placeholder.jpg"}
                    alt="Avatar"
                  />
                  <CldUploadButton
                    options={{ maxFiles: 1 }}
                    onUpload={handleUpload}
                    uploadPreset="pgc9ehd5"
                  >
                    <Button disabled={isLoading} secondary type="button">
                      Change
                    </Button>
                  </CldUploadButton>
                </div>
              </div>
              <div>
                <label
                  htmlFor="status"
                  className="
                    block
                    text-sm
                    font-medium
                    leading-6
                    text-gray-900
                  "
                >
                  Status
                </label>
                <div className="mt-2 flex items-center gap-x-3">
                  <div className="flex-1">
                    {currentUser?.customStatus || currentUser?.customStatusEmoji ? (
                      <p className="text-sm text-gray-700">
                        {currentUser.customStatusEmoji && (
                          <span className="mr-1">{currentUser.customStatusEmoji}</span>
                        )}
                        {currentUser.customStatus || "No status message"}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">No status set</p>
                    )}
                  </div>
                  <Button
                    disabled={isLoading}
                    secondary
                    type="button"
                    onClick={() => setIsStatusModalOpen(true)}
                  >
                    Edit Status
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          className="
            mt-6 
            flex 
            items-center 
            justify-end 
            gap-x-6
          "
        >
          <Button disabled={isLoading} secondary onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isLoading} type="submit">
            Save
          </Button>
        </div>
      </form>
      <StatusModal isOpen={isStatusModalOpen} onClose={() => setIsStatusModalOpen(false)} />
    </Modal>
  )
}

export default SettingsModal
