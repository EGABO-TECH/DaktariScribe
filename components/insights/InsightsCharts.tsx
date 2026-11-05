'use client';

/**
 * Insights charts (Recharts). Single series per chart: one brand hue, no legend box (the title
 * names the measure), 2px line, thin bars with rounded data ends, recessive grid, one axis,
 * tooltips on hover, and a table view for every chart. Colours come from CSS tokens so dark
 * mode uses its own steps.
 */
import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { InsightsData } from '@/lib/insights';

const SERIES = 'var(--color-secondary)';
const GRID = 'var(--color-outline-variant)';
const INK = 'var(--color-on-surface-variant)';

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));
}

function ChartCard({ title, children, table }: { title: string; children: React.ReactNode; table: React.ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4" aria-label={title}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-headline-sm text-[18px] font-semibold text-primary">{title}</h2>
        <button type="button" onClick={() => setAsTable((v) => !v)} className="min-h-12 rounded-lg px-3 text-[14px] font-semibold text-secondary hover:bg-secondary/10" aria-pressed={asTable}>
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {asTable ? table : <div className="h-72 w-full">{children}</div>}
    </section>
  );
}

const tooltipStyle = {
  contentStyle: { background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)', borderRadius: 8, color: 'var(--color-on-surface)' },
  labelStyle: { color: 'var(--color-on-surface)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-on-surface)' },
};

export default function InsightsCharts({ data }: { data: InsightsData }) {
  const numeric = data.metric.kind === 'numeric';
  const unit = data.metric.unit ? ` (${data.metric.unit})` : '';
  const measure = numeric ? `Average ${data.metric.label.toLowerCase()}${unit}` : `Records with ${data.metric.label.toLowerCase()} recorded`;
  const valueName = numeric ? `Average${unit}` : 'Records';

  return (
    <div className="grid grid-cols-1 gap-gutter xl:grid-cols-2">
      <ChartCard
        title={`${measure} over time`}
        table={
          <table className="w-full text-left text-body-md">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="py-2">Date</th>
                <th className="py-2">{valueName}</th>
                <th className="py-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {data.overTime.map((r) => (
                <tr key={r.date} className="border-b border-outline-variant/60">
                  <td className="py-1.5">{fmtDate(r.date)}</td>
                  <td className="py-1.5 font-semibold">{r.value}</td>
                  <td className="py-1.5">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.overTime} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke={GRID} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: INK, fontSize: 12 }} stroke={GRID} minTickGap={24} />
            <YAxis tick={{ fill: INK, fontSize: 12 }} stroke={GRID} width={44} allowDecimals={numeric} />
            <Tooltip {...tooltipStyle} labelFormatter={(d) => fmtDate(String(d))} formatter={(v) => [v, valueName]} cursor={{ stroke: INK, strokeWidth: 1 }} />
            <Line type="monotone" dataKey="value" name={valueName} stroke={SERIES} strokeWidth={2} dot={{ r: 4, fill: SERIES, strokeWidth: 2, stroke: 'var(--color-surface-container-lowest)' }} activeDot={{ r: 6 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        title={`${measure} by site`}
        table={
          <table className="w-full text-left text-body-md">
            <thead>
              <tr className="border-b border-outline-variant">
                <th className="py-2">Site</th>
                <th className="py-2">{valueName}</th>
                <th className="py-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {data.bySite.map((r) => (
                <tr key={r.site} className="border-b border-outline-variant/60">
                  <td className="py-1.5">{r.site}</td>
                  <td className="py-1.5 font-semibold">{r.value}</td>
                  <td className="py-1.5">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.bySite} margin={{ top: 8, right: 16, bottom: 8, left: 0 }} barCategoryGap="30%">
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="site" tick={{ fill: INK, fontSize: 12 }} stroke={GRID} interval={0} />
            <YAxis tick={{ fill: INK, fontSize: 12 }} stroke={GRID} width={44} allowDecimals={numeric} />
            <Tooltip {...tooltipStyle} formatter={(v) => [v, valueName]} cursor={{ fill: 'var(--color-surface-container-high)' }} />
            <Bar dataKey="value" name={valueName} fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {!numeric && data.byValue.length > 0 && (
        <ChartCard
          title={`${data.metric.label}: records by recorded value`}
          table={
            <table className="w-full text-left text-body-md">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="py-2">Value</th>
                  <th className="py-2">Records</th>
                </tr>
              </thead>
              <tbody>
                {data.byValue.map((r) => (
                  <tr key={r.value} className="border-b border-outline-variant/60">
                    <td className="py-1.5">{r.value}</td>
                    <td className="py-1.5 font-semibold">{r.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.byValue} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }} barCategoryGap="30%">
              <CartesianGrid stroke={GRID} horizontal={false} />
              <XAxis type="number" tick={{ fill: INK, fontSize: 12 }} stroke={GRID} allowDecimals={false} />
              <YAxis type="category" dataKey="value" tick={{ fill: INK, fontSize: 12 }} stroke={GRID} width={110} />
              <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Records']} cursor={{ fill: 'var(--color-surface-container-high)' }} />
              <Bar dataKey="n" name="Records" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={32} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}
