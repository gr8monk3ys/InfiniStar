import React from 'react';

interface ModalProps {
  isOpen?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-800/70 flex items-center justify-center overflow-x-hidden overflow-y-auto">
      <div className="relative mx-auto my-6 w-full max-w-lg p-4">
        <div className="relative flex w-full flex-col rounded-lg border-0 bg-white shadow-lg outline-none focus:outline-none">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Modal;
