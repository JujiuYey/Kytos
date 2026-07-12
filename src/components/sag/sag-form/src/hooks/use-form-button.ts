import type { FormProps } from '@/components/sag/sag-form/types';

export function useFormButton(props: FormProps) {
  const { config } = props;
  const { submitButton, resetButton } = config || {};

  const submitButtonText = submitButton?.text || '提交';
  const submitButtonShow = submitButton?.show || true;
  const resetButtonText = resetButton?.text || '重置';
  const resetButtonShow = resetButton?.show || true;

  return {
    submitButtonText,
    submitButtonShow,
    resetButtonText,
    resetButtonShow,
  };
}
