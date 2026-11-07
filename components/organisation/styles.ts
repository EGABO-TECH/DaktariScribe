/** The app's standard card, field and button styles, shared with components/ui/kit. */
import { btn, field } from '@/components/ui/kit';

export const cardCls = 'rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[0_1px_2px_rgba(0,29,61,0.04)] md:p-6';
export const headingCls = 'font-headline-sm text-[18px] font-semibold text-primary';
export const labelCls = field.label;
export const fieldCls = field.input;
export const primaryBtnCls = btn.primary;
export const secondaryBtnCls = btn.outline;
export const dangerBtnCls = btn.danger;
export const errorCls = 'rounded-xl border border-error/40 bg-error-container p-4 text-on-error-container';
export const successCls = 'rounded-xl border border-secondary/40 bg-success-container p-4 text-on-success-container';
