'use client';

import Modal from '@/app/components/modals/Modal';
import Image from 'next/image';

interface ImageModalProps {
  isOpen?: boolean;
  onClose: () => void;
  src?: string | null;
}

const ImageModal: React.FC<ImageModalProps> = ({ 
  isOpen, 
  onClose, 
  src
}) => {
  if (!src) {
    return null;
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="fixed inset-0 z-50 mx-auto flex items-center justify-center p-4">
        <div className="relative flex max-h-[90vh] max-w-[90vw] items-center">
          <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
            <h3 className="text-base font-semibold leading-6 text-gray-900">
              View image
            </h3>
            <div className="mt-2">
              <Image
                alt="Image"
                height="320"
                width="320"
                className="object-cover" 
                src={src}
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ImageModal;
