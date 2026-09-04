import React, { useState } from 'react';
import { TrendingUp, Users, Activity, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
export interface TrendDataPoint {
  label: string;
  critical: number;
  high: number;
  medium: number;
}

export interface DonorActivityDataPoint {
  bloodGroup: string;
  available: number;
  resting: number;
  avgResponseMins: number;
}

// -----------------------------------------------------------------------------
// 1. Emergency Request Trends Chart
// -----------------------------------------------------------------------------
export const EmergencyTrendsChart: React.FC<{
  data?: TrendDataPoint[];
  title?: string;
  description?: string;
}> = ({
  data = [
    { label: 'Mon', critical: 3, high: 5, medium: 2 },
    { label: 'Tue', critical: 1, high: 4, medium: 3 },
    { label: 'Wed', critical: 4, high: 6, medium: 4 },
    { label: 'Thu', critical: 2, high: 3, medium: 5 },
    { label: 'Fri', critical: 5, high: 7, medium: 3 },
    { label: 'Sat', critical: 3, high: 4, medium: 2 },
    { label: 'Sun', critical: 2, high: 3, medium: 1 },
  ],
  title = 'Emergency Request Volume Trends',
  description = '7-day breakdown of emergency blood requests by clinical urgency',
}) => {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const maxTotal = Math.max(
    ...data.map((d) => d.critical + d.high + d.medium),
    1
  );

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-emergency-600" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {/* Legend */}
          <div
            className="flex items-center gap-3 text-xs"
            role="region"
            aria-label="Chart legend"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emergency-600 inline-block" />
              <span className="text-slate-600 font-medium">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-amber-500 inline-block" />
              <span className="text-slate-600 font-medium">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-clinical-500 inline-block" />
              <span className="text-slate-600 font-medium">Medium</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Interactive Stacked Bar Chart */}
        <div
          className="h-48 sm:h-56 w-full flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-1"
          role="img"
          aria-label={`Emergency request trend chart showing volume over ${data.length} periods`}
        >
          {data.map((item, idx) => {
            const total = item.critical + item.high + item.medium;
            const isHovered = activeIdx === idx;

            return (
              <div
                key={item.label}
                className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none"
                onMouseEnter={() => setActiveIdx(idx)}
                onMouseLeave={() => setActiveIdx(null)}
                onFocus={() => setActiveIdx(idx)}
                onBlur={() => setActiveIdx(null)}
                tabIndex={0}
                aria-label={`${item.label}: ${total} total requests (${item.critical} critical, ${item.high} high, ${item.medium} medium)`}
              >
                {/* Hover Tooltip Capsule */}
                <div
                  className={`text-[10px] font-bold text-slate-800 mb-1 transition-opacity ${
                    isHovered ? 'opacity-100' : 'opacity-0 sm:group-hover:opacity-100'
                  }`}
                >
                  {total}
                </div>

                {/* Stacked Bar Container */}
                <div
                  className={`w-full max-w-[36px] rounded-t-md overflow-hidden flex flex-col-reverse transition-transform duration-150 ${
                    isHovered ? 'scale-105 shadow-md' : 'hover:scale-105'
                  }`}
                  style={{ height: `${Math.max((total / maxTotal) * 82, 6)}%` }}
                >
                  {/* Medium (Bottom) */}
                  <div
                    style={{ height: `${(item.medium / total) * 100}%` }}
                    className="bg-clinical-500 hover:bg-clinical-600 transition-colors"
                    title={`Medium: ${item.medium}`}
                  />
                  {/* High (Middle) */}
                  <div
                    style={{ height: `${(item.high / total) * 100}%` }}
                    className="bg-amber-500 hover:bg-amber-600 transition-colors"
                    title={`High: ${item.high}`}
                  />
                  {/* Critical (Top) */}
                  <div
                    style={{ height: `${(item.critical / total) * 100}%` }}
                    className="bg-emergency-600 hover:bg-emergency-700 transition-colors"
                    title={`Critical: ${item.critical}`}
                  />
                </div>

                {/* X-Axis Label */}
                <span
                  className={`mt-2 text-[11px] font-semibold transition-colors ${
                    isHovered ? 'text-slate-900 font-bold' : 'text-slate-500'
                  }`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dynamic Detail Card */}
        {activeIdx !== null && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-wrap items-center justify-between text-xs animate-in fade-in duration-150">
            <span className="font-bold text-slate-900">
              {data[activeIdx].label} Details:
            </span>
            <div className="flex items-center gap-3">
              <span className="text-emergency-700 font-semibold">
                Critical: {data[activeIdx].critical}
              </span>
              <span className="text-amber-700 font-semibold">
                High: {data[activeIdx].high}
              </span>
              <span className="text-clinical-700 font-semibold">
                Medium: {data[activeIdx].medium}
              </span>
              <span className="font-bold text-slate-800">
                Total:{' '}
                {data[activeIdx].critical +
                  data[activeIdx].high +
                  data[activeIdx].medium}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------------
// 2. Donor Activity & Availability Distribution Chart
// -----------------------------------------------------------------------------
export const DonorActivityChart: React.FC<{
  data?: DonorActivityDataPoint[];
  title?: string;
  description?: string;
}> = ({
  data = [
    { bloodGroup: 'O+', available: 28, resting: 12, avgResponseMins: 6.2 },
    { bloodGroup: 'O-', available: 14, resting: 5, avgResponseMins: 4.8 },
    { bloodGroup: 'A+', available: 22, resting: 9, avgResponseMins: 7.1 },
    { bloodGroup: 'A-', available: 11, resting: 4, avgResponseMins: 5.5 },
    { bloodGroup: 'B+', available: 18, resting: 7, avgResponseMins: 8.0 },
    { bloodGroup: 'B-', available: 8, resting: 3, avgResponseMins: 6.9 },
    { bloodGroup: 'AB+', available: 12, resting: 4, avgResponseMins: 9.4 },
    { bloodGroup: 'AB-', available: 6, resting: 2, avgResponseMins: 7.8 },
  ],
  title = 'Donor Availability & Response Times',
  description = 'Readiness and dispatch speed by ABO/Rh blood group',
}) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const maxAvailable = Math.max(...data.map((d) => d.available + d.resting), 1);

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-vitality-600" />
              {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {/* Legend */}
          <div
            className="flex items-center gap-3 text-xs"
            role="region"
            aria-label="Chart legend"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-vitality-600 inline-block" />
              <span className="text-slate-600 font-medium">Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-slate-300 inline-block" />
              <span className="text-slate-600 font-medium">Resting / Ineligible</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Horizontal Bar Breakdown */}
        <div
          className="space-y-2.5 pt-2"
          role="region"
          aria-label="Donor availability bar chart"
        >
          {data.map((item) => {
            const isSelected = selectedGroup === item.bloodGroup;
            const availablePct = (item.available / maxAvailable) * 100;
            const restingPct = (item.resting / maxAvailable) * 100;

            return (
              <div
                key={item.bloodGroup}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isSelected ? 'bg-vitality-50/70 ring-1 ring-vitality-300' : 'hover:bg-slate-50'
                }`}
                onClick={() =>
                  setSelectedGroup(isSelected ? null : item.bloodGroup)
                }
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${item.bloodGroup}: ${item.available} available, ${item.resting} resting, average response ${item.avgResponseMins} minutes`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedGroup(isSelected ? null : item.bloodGroup);
                  }
                }}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 w-8">
                      {item.bloodGroup}
                    </span>
                    <span className="text-vitality-700 font-bold">
                      {item.available} ready
                    </span>
                    <span className="text-slate-400 font-normal">
                      ({item.resting} resting)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-slate-500 font-medium">
                    <Clock className="h-3 w-3 text-slate-400" />
                    <span>~{item.avgResponseMins}m response</span>
                  </div>
                </div>

                {/* Stacked Progress Track */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 flex overflow-hidden">
                  <div
                    style={{ width: `${availablePct}%` }}
                    className="bg-vitality-500 hover:bg-vitality-600 transition-all rounded-l-full"
                    title={`Available: ${item.available}`}
                  />
                  <div
                    style={{ width: `${restingPct}%` }}
                    className="bg-slate-300 hover:bg-slate-400 transition-all rounded-r-full"
                    title={`Resting: ${item.resting}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------------
// 3. Request Fulfillment & Resolution Rate Chart
// -----------------------------------------------------------------------------
export const FulfillmentRateChart: React.FC<{
  fulfilledCount?: number;
  activeCount?: number;
  cancelledCount?: number;
  avgResponseMinutes?: number;
}> = ({
  fulfilledCount = 74,
  activeCount = 5,
  cancelledCount = 10,
  avgResponseMinutes = 8.4,
}) => {
  const total = fulfilledCount + activeCount + cancelledCount;
  const fulfillmentPct = total > 0 ? Math.round((fulfilledCount / total) * 100) : 0;
  const activePct = total > 0 ? Math.round((activeCount / total) * 100) : 0;
  const cancelledPct = total > 0 ? Math.round((cancelledCount / total) * 100) : 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-vitality-600" />
          Request Fulfillment & Resolution
        </CardTitle>
        <CardDescription>
          Clinical fulfillment outcomes across all emergency requests
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
          {/* Radial / Donut Visualizer */}
          <div className="relative flex items-center justify-center">
            <svg
              className="w-32 h-32 transform -rotate-90"
              viewBox="0 0 36 36"
              role="img"
              aria-label={`Fulfillment rate circle: ${fulfillmentPct}%`}
            >
              {/* Background Circle */}
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="transparent"
                stroke="#e2e8f0"
                strokeWidth="3.2"
              />
              {/* Fulfilled Segment */}
              <circle
                cx="18"
                cy="18"
                r="15.915"
                fill="transparent"
                stroke="#10b981"
                strokeWidth="3.2"
                strokeDasharray={`${fulfillmentPct} ${100 - fulfillmentPct}`}
                strokeDashoffset="0"
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {fulfillmentPct}%
              </span>
              <span className="text-[10px] font-bold text-vitality-700 uppercase tracking-wider mt-0.5">
                Resolved
              </span>
            </div>
          </div>

          {/* Metrics Column */}
          <div className="flex-1 w-full space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-vitality-50/60 border border-vitality-100 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-vitality-600" />
                <span className="font-semibold text-slate-700">Fulfilled Successfully</span>
              </div>
              <span className="font-extrabold text-slate-900">
                {fulfilledCount} ({fulfillmentPct}%)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-emergency-50/60 border border-emergency-100 text-xs">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-emergency-600 animate-pulse" />
                <span className="font-semibold text-slate-700">Active / In Progress</span>
              </div>
              <span className="font-extrabold text-slate-900">
                {activeCount} ({activePct}%)
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-slate-400" />
                <span className="font-semibold text-slate-700">Cancelled / Expired</span>
              </div>
              <span className="font-extrabold text-slate-900">
                {cancelledCount} ({cancelledPct}%)
              </span>
            </div>
          </div>
        </div>

        {/* Speed Callout */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Average Hospital Response Time</span>
          <span className="font-extrabold text-slate-900">~{avgResponseMinutes} minutes</span>
        </div>
      </CardContent>
    </Card>
  );
};
