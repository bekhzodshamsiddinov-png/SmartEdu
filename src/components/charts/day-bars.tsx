'use client';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { compactMoney, money } from '@/lib/format';

export function DayBars({ data, height = 220 }: { data: { label: string; value: number; count: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="22%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E9EEEC" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#5E6E6B' }} interval={4} dy={6} />
          <YAxis tickLine={false} axisLine={false} width={66} tick={{ fontSize: 11, fill: '#8C9A97' }} tickFormatter={(v) => compactMoney(Number(v))} />
          <Tooltip
            cursor={{ fill: 'rgba(15,42,46,0.04)' }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-[13px] shadow-pop">
                  <div className="font-bold">{label}</div>
                  <div className="mt-1 tnum">{money(Number(payload[0].value))}</div>
                  <div className="text-xs text-fg-muted">{(payload[0].payload as { count: number }).count} ta sotuv</div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" fill="#008A70" radius={[4, 4, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
