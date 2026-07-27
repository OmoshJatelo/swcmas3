import React from 'react';
import Modal from './Modal.jsx';
import LoadingSpinner from './LoadingSpinner.jsx';
import { AlertTriangle } from 'lucide-react';

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  isConfirming = false,
}) => {
  const descId = `confirm-desc-${title?.replace(/\s/g, '-').toLowerCase()}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-sm">
      <div className="flex flex-col items-center text-center">
        {isDestructive && (
          <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/20 sm:h-10 sm:w-10 mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
          </div>
        )}
        <div className="mt-2">
          <p id={descId} className="text-sm text-gray-500 dark:text-gray-400">
            {message}
          </p>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isConfirming}
          className="btn inline-flex justify-center rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-600 focus-ring transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          aria-describedby={descId}
          disabled={isConfirming}
          onClick={() => {
            onConfirm();
            if (!isConfirming) onClose();
          }}
          className={`btn inline-flex justify-center rounded-lg border border-transparent px-4 py-2 text-sm font-medium text-white shadow-sm focus-ring transition-colors disabled:opacity-70 ${
            isDestructive
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {isConfirming ? <LoadingSpinner size="sm" /> : confirmText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
