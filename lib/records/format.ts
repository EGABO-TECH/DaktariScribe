import type { TemplateField } from '@/lib/templates/definition';

/** Formats a recorded field value for display and export. Never invents a value. */
export function formatFieldValue(field: Pick<TemplateField, 'type' | 'unit'>, value: string | number | boolean | null): string {
  if (value === null || value === '') return 'Not recorded';
  if (field.type === 'boolean' || typeof value === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
  if (field.type === 'date' && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${value}T00:00:00Z`),
    );
  }
  return field.unit ? `${value} ${field.unit}` : String(value);
}
