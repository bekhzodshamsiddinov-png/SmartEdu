'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactMoney, money } from '@/lib/format';

export const SERIES = { kirim: '#008A70', xarajat: '#C2862A' };

type Row = { label: string; kirim: number; xarajat: number };

export function MoneyBars({ data, height = 260 }: { data: Row[]; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-5 px-1 text-[13px] text-fg-muted">
        <Legend color={SERIES.kirim} label="Kirim" />
        <Legend color={SERIES.xarajat} label="Xarajat" />
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#E9EEEC" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#5E6E6B' }} dy={6} />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: '#8C9A97' }} tickFormatter={(v) => compactMoney(Number(v))} />
            <Tooltip
              cursor={{ fill: 'rgba(15,42,46,0.04)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] shadow-pop">
                    <div className="mb-1.5 font-bold">{label}</div>
                    {payload.map((p) => (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-6">
                        <span className="flex items-center gap-2 text-fg-muted">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: String(p.color) }} />
                          {p.dataKey === 'kirim' ? 'Kirim' : 'Xarajat'}
                        </span>
                        <span className="font-semibold tnum">{money(Number(p.value))}</span>
                      </div>
                    ))}
                    {payload.length === 2 && (
                      <div className="mt-1.5 flex justify-between gap-6 border-t border-line pt-1.5">
                        <span className="text-fg-muted">Sof foyda</span>
                        <span className="font-bold tnum">{money(Number(payload[0].value) - Number(payload[1].value))}</span>
                      </div>
                    )}
                  </div>
                ) : null
              }
            />
            <Bar dataKey="kirim" fill={SERIES.kirim} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar dataKey="xarajat" fill={SERIES.xarajat} radius={[4, 4, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
