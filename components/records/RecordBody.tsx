'use client';

import React, { useState } from 'react';
import RecordEditor from './RecordEditor';
import type { RefinedRecord } from '@/lib/records/refined-record';
import { NOTES_SECTION_KEY } from '@/lib/records/refined-record';
import type { TemplateDefinition } from '@/lib/templates/definition';
import { labelFor } from '@/lib/templates/definition';
import { formatFieldValue } from '@/lib/records/format';

/** Current version, shown like the exported report; the author can switch to edit mode while in review. */
export default function RecordBody({
  recordId,
  versionId,
  versionNo,
  content,
  definition,
  editable,
}: {
  recordId: string;
  versionId: string;
  versionNo: number;
  content: RefinedRecord;
  definition: TemplateDefinition;
  editable: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const lines = new Map(content.sections.map((s) => [s.key, s.lines]));
  const fields = new Map(content.fields.map((f) => [f.key, f]));
  const notes = lines.get(NOTES_SECTION_KEY) ?? [];

  return (
    <section aria-labelledby="current-version" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="current-version" className="font-headline-sm text-headline-sm text-primary">
          Record <span className="text-body-md font-normal text-on-surface-variant">· version {versionNo}</span>
        </h2>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-lg border border-outline px-4 font-semibold text-on-surface hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
              edit
            </span>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <RecordEditor recordId={recordId} baseVersionId={versionId} content={content} definition={definition} onCancel={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="mb-2 border-l-4 border-secondary bg-surface-container-low px-3 py-1.5 font-semibold text-primary">Clinical notes</h3>
            {notes.length ? (
              <div className="flex flex-col gap-3 px-1 text-body-lg text-on-surface">
                {notes.map((l, i) => (
                  <p key={i} className="whitespace-pre-wrap">
                    {l.text}
                  </p>
                ))}
              </div>
            ) : (
              <p className="px-1 italic text-on-surface-variant">Not recorded</p>
            )}
          </div>

          {definition.sections.map((sec) => {
            const secLines = lines.get(sec.key) ?? [];
            if (!sec.fields.length && !secLines.length) return null;
            return (
              <div key={sec.key}>
                <h3 className="mb-2 border-l-4 border-secondary bg-surface-container-low px-3 py-1.5 font-semibold text-primary">{labelFor(sec.label)}</h3>
                {secLines.map((l, i) => (
                  <p key={i} className="mb-2 px-1 text-body-lg text-on-surface">
                    {l.text}
                  </p>
                ))}
                {sec.fields.length > 0 && (
                  <dl className="divide-y divide-outline-variant rounded-lg border border-outline-variant">
                    {sec.fields.map((f) => {
                      const v = fields.get(f.key);
                      const recorded = v && v.status === 'recorded' && v.value !== null;
                      return (
                        <div key={f.key} className="grid grid-cols-2 gap-2 px-3 py-2.5">
                          <dt className="text-body-md text-on-surface-variant">{labelFor(f.label)}</dt>
                          <dd className={recorded ? 'text-body-md font-semibold text-on-surface' : 'text-body-md italic text-on-surface-variant'}>
                            {recorded ? formatFieldValue(f, v.value) : 'Not recorded'}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
