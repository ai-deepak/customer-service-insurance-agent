import React from "react";

// ---------------------------------------------------------------------------
// Lightweight UI components for rendering API results from your Agents backend
// - PolicySummaryCard
// - ClaimStatusTable
// Tailwind CSS classes are used for minimal styling.
// ---------------------------------------------------------------------------

// Shared formatters
export const formatCurrency = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

export const formatNumber = (n?: number) =>
  typeof n === "number" ? n.toLocaleString() : "—";

export const formatBool = (b?: boolean) =>
  b ? "Yes" : b === false ? "No" : "—";

export const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso; // fallback if server sends non-ISO
  return d.toLocaleString();
};

// ---------------------------------------------------------------------------
// PolicySummaryCard
// ---------------------------------------------------------------------------
export type PolicySummary = {
  user_id?: string;
  policy_id?: string;
  plan?: string; // e.g., "Silver", "Gold", "Platinum"
  collision_coverage?: number; // e.g., 30000
  roadside_assistance?: boolean; // true/false
  deductible?: number; // e.g., 750
};

// ---------------------------------------------------------------------------
// PremiumCalculationCard
// ---------------------------------------------------------------------------
export type PremiumCalculation = {
  policy_id?: string;
  current_premium?: number;
  new_premium?: number;
  _inputs?: {
    policy_id?: string;
    current_coverage?: number;
    new_coverage?: number;
  };
};

// ---------------------------------------------------------------------------
// Confirmation Card
// ---------------------------------------------------------------------------
export function ConfirmationCard({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b bg-gray-50 px-4 py-3">
        <div className="text-sm font-semibold text-gray-800">
          Confirmation Required
        </div>
      </div>
      <div className="p-4">
        <div className="mb-4 text-sm text-gray-700">{message}</div>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            Yes, Confirm
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400 transition-colors"
          >
            No, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function PremiumCalculationCard({
  data,
  title,
}: {
  data: PremiumCalculation;
  title?: string;
}) {
  const { policy_id, current_premium, new_premium, _inputs } = data || {};
  const { current_coverage, new_coverage } = _inputs || {};

  const premiumChange =
    new_premium && current_premium ? new_premium - current_premium : 0;
  const isIncrease = premiumChange > 0;
  const changePercentage =
    current_premium && new_premium
      ? ((premiumChange / current_premium) * 100).toFixed(1)
      : 0;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
        <div className="text-sm font-semibold text-gray-800">
          {title || "Premium Calculation"}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isIncrease
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}
        >
          {isIncrease ? "Increase" : "Decrease"}
        </span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {policy_id && (
          <KV
            label="Policy ID"
            value={<code className="text-[12px]">{policy_id}</code>}
          />
        )}
        <KV label="Current Premium" value={formatCurrency(current_premium)} />
        <KV label="New Premium" value={formatCurrency(new_premium)} />
        <KV
          label="Premium Change"
          value={
            <span
              className={`font-medium ${
                isIncrease ? "text-red-600" : "text-green-600"
              }`}
            >
              {isIncrease ? "+" : ""}
              {formatCurrency(premiumChange)} ({changePercentage}%)
            </span>
          }
        />
        {current_coverage && (
          <KV
            label="Current Coverage"
            value={formatCurrency(current_coverage)}
          />
        )}
        {new_coverage && (
          <KV label="New Coverage" value={formatCurrency(new_coverage)} />
        )}
      </div>
    </div>
  );
}

export function PolicySummaryCard({
  data,
  title,
}: {
  data: PolicySummary;
  title?: string;
}) {
  const {
    user_id,
    policy_id,
    plan,
    collision_coverage,
    roadside_assistance,
    deductible,
  } = data || {};

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
        <div className="text-sm font-semibold text-gray-800">
          {title || "Policy Summary"}
        </div>
        {plan && (
          <span className="rounded-full bg-blue-600/10 px-2.5 py-1 text-xs font-medium text-blue-700">
            {plan}
          </span>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {user_id && (
          <KV
            label="User ID"
            value={<code className="text-[12px]">{user_id}</code>}
          />
        )}
        {policy_id && (
          <KV
            label="Policy ID"
            value={<code className="text-[12px]">{policy_id}</code>}
          />
        )}
        <KV
          label="Collision Coverage"
          value={formatCurrency(collision_coverage)}
        />
        <KV
          label="Roadside Assistance"
          value={formatBool(roadside_assistance)}
        />
        <KV label="Deductible" value={formatCurrency(deductible)} />
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="text-[12px] font-medium text-gray-500">{label}</div>
      <div className="text-[13px] text-gray-800">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClaimStatusTable
// Accepts a single status object or a list. Renders responsive table.
// ---------------------------------------------------------------------------
export type ClaimStatus = {
  claim_id?: string;
  status?: string; // e.g., "Submitted", "In Review", "Approved", "Rejected"
  last_updated?: string; // ISO string or any date-like string
};

export function ClaimStatusTable({
  items,
  title,
}: {
  items: ClaimStatus[] | ClaimStatus;
  title?: string;
}) {
  const rows = Array.isArray(items) ? items : [items];

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-800">
        {title || "Claim Status"}
      </div>
      <div className="w-full overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white">
            <tr className="border-b">
              <TH>Claim ID</TH>
              <TH>Status</TH>
              <TH>Last Updated</TH>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={r.claim_id || i}
                className="border-b hover:bg-gray-50/60"
              >
                <TD>
                  {r.claim_id ? (
                    <code className="text-[12px]">{r.claim_id}</code>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>
                  {r.status ? (
                    <span className="rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      {r.status}
                    </span>
                  ) : (
                    "—"
                  )}
                </TD>
                <TD>{formatDate(r.last_updated)}</TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TH({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-[12px] font-semibold text-gray-500">
      {children}
    </th>
  );
}

function TD({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2 text-[13px] text-gray-800">{children}</td>;
}

// ---------------------------------------------------------------------------
// Knowledge Base Results Card
// ---------------------------------------------------------------------------
export type KnowledgeBaseResult = {
  results?: string[];
  sources?: string[];
  query?: string;
};

export function KnowledgeBaseCard({
  data,
  title,
}: {
  data: KnowledgeBaseResult;
  title?: string;
}) {
  const { results, sources, query } = data || {};

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
        <div className="text-sm font-semibold text-gray-800">
          {title || "Knowledge Base Results"}
        </div>
        {query && (
          <span className="rounded-full bg-green-600/10 px-2.5 py-1 text-xs font-medium text-green-700">
            {query}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {results && results.length > 0 ? (
          <>
            <div className="space-y-2">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg"
                >
                  {result}
                </div>
              ))}
            </div>
            {sources && sources.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <div className="text-xs font-medium text-gray-500 mb-2">
                  Sources:
                </div>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source, index) => (
                    <span
                      key={index}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                    >
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No relevant information found.
          </div>
        )}
      </div>
    </div>
  );
}
