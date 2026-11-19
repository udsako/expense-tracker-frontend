import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import { DashboardSkeleton } from '../components/Skeleton';

interface Transaction {
  id: number;
  title: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  date: string;
  is_excluded: boolean;
}

interface IncomeItem {
  id: number;
  date: string;
  title: string;
  category: string;
  amount: number;
}

interface CategoryBreakdownItem {
  category: string;
  total: number;
  count: number;
  transactions: {
    id: number;
    date: string;
    title: string;
    amount: number;
    is_excluded: boolean;
  }[];
}

interface PreviewRow {
  date: string;
  title: string;
  amount: number;
  type: 'income' | 'expense' | 'transfer';
  balance_after: number | null;
  category: string;
  is_unclear: boolean;
  selected: boolean;
}

const SUGGESTED_CATEGORIES = [
  'Food',
  'Household Items',
  'Utilities',
  'Subscriptions',
  'Personal Care',
  'Transport',
  'Gifts',
  'Loans & Bills',
  'Self-Transfer',
  'Miscellaneous',
];

const CHART_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#4b5563'];

export default function AccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [account, setAccount] = useState<{ id: number; name: string; institution: string; type: string; balance: string } | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomeOverview, setIncomeOverview] = useState<IncomeItem[]>([]);
  const [breakdown, setBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [summary, setSummary] = useState({ total_income: 0, total_expense: 0, current_balance: 0, unclarified_count: 0 });
  const [loading, setLoading] = useState(true);

  // Preview Table & Reconciliation Banner State
  const [statementFile, setStatementFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [closingBalance, setClosingBalance] = useState<number | null>(null);
  const [statementTotals, setStatementTotals] = useState<{ credit: number | null; debit: number | null }>({ credit: null, debit: null });
  const [parsing, setParsing] = useState(false);
  const [savingImport, setSavingImport] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Inline Clarification State
  const [clarifyingId, setClarifyingId] = useState<number | null>(null);
  const [clarifyTitle, setClarifyTitle] = useState('');
  const [clarifyCategory, setClarifyCategory] = useState('');
  const [savingClarification, setSavingClarification] = useState(false);

  const fetchAccountDetails = async (month = selectedMonth) => {
    try {
      const res = await api.get(`/accounts/${id}?month=${month}`);
      setAccount(res.data.account);
      setTransactions(res.data.transactions);
      setIncomeOverview(res.data.income_overview || []);
      setBreakdown(res.data.category_breakdown || []);
      setSummary(res.data.summary);
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountDetails(selectedMonth);
  }, [id, selectedMonth]);

  const handlePreviewStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statementFile) return;
    setError('');
    setMessage('');
    setParsing(true);

    const formData = new FormData();
    formData.append('statement', statementFile);

    try {
      const res = await api.post(`/accounts/${id}/preview-statement`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewRows(res.data.rows);
      setClosingBalance(res.data.closing_balance);
      setStatementTotals({
        credit: res.data.statement_total_credit ?? null,
        debit: res.data.statement_total_debit ?? null,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to parse bank statement.');
    } finally {
      setParsing(false);
    }
  };

  const togglePreviewRow = (index: number) => {
    setPreviewRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, selected: !row.selected } : row))
    );
  };

  const toggleRowDirection = (index: number) => {
    setPreviewRows((prev) =>
      prev.map((row, idx) =>
        idx === index ? { ...row, type: row.type === 'income' ? 'expense' : 'income' } : row
      )
    );
  };

  const handleConfirmImport = async () => {
    const selectedRows = previewRows.filter((r) => r.selected);
    if (selectedRows.length === 0) {
      setError('Please select at least one row to import.');
      return;
    }

    setSavingImport(true);
    setError('');
    try {
      const res = await api.post(`/accounts/${id}/confirm-import`, {
        rows: selectedRows,
        closing_balance: closingBalance,
      });
      setMessage(res.data.message);
      setPreviewRows([]);
      setStatementFile(null);
      await fetchAccountDetails(selectedMonth);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save imported transactions.');
    } finally {
      setSavingImport(false);
    }
  };

  const cancelClarifying = () => {
    setClarifyingId(null);
    setClarifyTitle('');
    setClarifyCategory('');
  };

  const handleSaveClarification = async (txId: number) => {
    if (!clarifyTitle.trim()) return;
    setError('');
    setSavingClarification(true);
    try {
      await api.put(`/expenses/${txId}`, {
        title: clarifyTitle,
        category: clarifyCategory.trim() || clarifyTitle,
        is_excluded: false,
      });
      cancelClarifying();
      await fetchAccountDetails(selectedMonth);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Could not save clarification.');
    } finally {
      setSavingClarification(false);
    }
  };

  if (loading || !account) {
    return <DashboardSkeleton />;
  }


  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '2rem 1rem' }}>
      <datalist id="suggested-categories">
        {SUGGESTED_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
            {account.type.replace('_', ' ')}
          </span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: '0.35rem' }}>
            {account.name} — {account.institution}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link to={`/budgets?account=${account.id}`} style={{ padding: '0.55rem 1rem', backgroundColor: '#059669', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            Account Budgets
          </Link>
          <Link to="/accounts" style={{ padding: '0.55rem 1rem', backgroundColor: '#e5e7eb', color: '#111827', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            All Accounts
          </Link>
          <Link to="/dashboard" style={{ padding: '0.55rem 1rem', backgroundColor: '#2563eb', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Main Dashboard
          </Link>
        </div>
      </header>

      {/* Account Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>{account.institution} Total Credit / Income ({selectedMonth})</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a', marginTop: '0.25rem' }}>
            ₦{Number(summary.total_income).toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>{account.institution} Total Debit / Expenses ({selectedMonth})</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#dc2626', marginTop: '0.25rem' }}>
            ₦{Number(summary.total_expense).toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>{account.institution} Current Balance</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>
            ₦{Number(summary.current_balance).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Bank Statement Upload & Table Preview */}
      <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>Upload {account.institution} Bank Statement (PDF or CSV)</h3>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Statement ownership and issuing bank are automatically verified before previewing.
        </p>

        {message && (
          <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {message}
          </div>
        )}
        {error && (
          <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handlePreviewStatement} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="file"
            accept=".csv,.txt,.pdf"
            required
            onChange={(e) => {
              setStatementFile(e.target.files?.item(0) || null);
              setPreviewRows([]);
            }}
            style={{ flex: 1, padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />
          <button
            type="submit"
            disabled={parsing || !statementFile}
            style={{ padding: '0.65rem 1.25rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            {parsing ? 'Verifying & Reading...' : 'Preview Statement Table'}
          </button>
        </form>

        {/* Interactive Credit / Debit Preview Table */}
        {previewRows.length > 0 && (
          <div style={{ marginTop: '1.5rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.85rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem' }}>
                  Detected {previewRows.length} Statement Entries
                  {closingBalance !== null && (
                    <span style={{ marginLeft: '0.75rem', color: '#059669' }}>
                      • Statement Closing Balance: ₦{Number(closingBalance).toLocaleString()}
                    </span>
                  )}
                </h4>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPreviewRows([])}
                  style={{ padding: '0.55rem 1rem', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={savingImport}
                  style={{ padding: '0.55rem 1.25rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {savingImport ? 'Saving...' : `Confirm & Import (${previewRows.filter((r) => r.selected).length})`}
                </button>
              </div>
            </div>

            {/* Live Statement Header vs. Parsed Totals Reconciliation Banner */}
            {(() => {
              const parsedCredit = previewRows
                .filter((r) => r.selected && r.type === 'income')
                .reduce((sum, r) => sum + Number(r.amount), 0);
              const parsedDebit = previewRows
                .filter((r) => r.selected && r.type === 'expense')
                .reduce((sum, r) => sum + Number(r.amount), 0);
              const creditMatches = statementTotals.credit === null || Math.abs(parsedCredit - statementTotals.credit) < 0.05;
              const debitMatches = statementTotals.debit === null || Math.abs(parsedDebit - statementTotals.debit) < 0.05;
              const allMatch = creditMatches && debitMatches;

              return (
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    marginBottom: '0.85rem',
                    fontSize: '0.85rem',
                    backgroundColor: allMatch ? '#dcfce7' : '#fef3c7',
                    color: allMatch ? '#166534' : '#92400e',
                  }}
                >
                  Parsed Totals: Credit ₦{parsedCredit.toLocaleString()} | Debit ₦{parsedDebit.toLocaleString()}
                  {(statementTotals.credit !== null || statementTotals.debit !== null) && (
                    <span>
                      {' '}• Statement Header: Credit ₦{Number(statementTotals.credit ?? 0).toLocaleString()} | Debit ₦{Number(statementTotals.debit ?? 0).toLocaleString()}
                      {allMatch ? ' (100% Match)' : ' (Mismatch detected — use ⇄ Flip on any swapped row before importing)'}
                    </span>
                  )}
                </div>
              );
            })()}

            <div style={{ overflowX: 'auto', maxHeight: '420px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb', backgroundColor: '#f9fafb', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '0.6rem' }}>Include</th>
                    <th style={{ padding: '0.6rem' }}>Date</th>
                    <th style={{ padding: '0.6rem' }}>Narration</th>
                    <th style={{ padding: '0.6rem' }}>Category</th>
                    <th style={{ padding: '0.6rem' }}>Credit (₦)</th>
                    <th style={{ padding: '0.6rem' }}>Debit (₦)</th>
                    <th style={{ padding: '0.6rem' }}>Balance (₦)</th>
                    <th style={{ padding: '0.6rem' }}>Swap</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        opacity: row.selected ? 1 : 0.45,
                        backgroundColor: row.is_unclear ? '#fffbeb' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '0.6rem' }}>
                        <input type="checkbox" checked={row.selected} onChange={() => togglePreviewRow(idx)} />
                      </td>
                      <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{row.date}</td>
                      <td style={{ padding: '0.6rem', minWidth: '220px' }}>{row.title}</td>
                      <td style={{ padding: '0.6rem' }}>{row.is_unclear ? 'Needs clarification' : row.category}</td>
                      <td style={{ padding: '0.6rem', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {row.type === 'income' ? `₦${Number(row.amount).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '0.6rem', color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {row.type === 'expense' ? `₦${Number(row.amount).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '0.6rem', color: '#374151', whiteSpace: 'nowrap' }}>
                        {row.balance_after !== null ? `₦${Number(row.balance_after).toLocaleString()}` : '—'}
                      </td>
                      <td style={{ padding: '0.6rem' }}>
                        <button
                          type="button"
                          onClick={() => toggleRowDirection(idx)}
                          style={{ padding: '0.3rem 0.7rem', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          ⇄ Flip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* Account Visual Analytics (Category Donut + Cashflow Bar Chart) */}
      {(breakdown.length > 0 || summary.total_income > 0 || summary.total_expense > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>{account.institution} Spending Share ({selectedMonth})</h3>
            <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
              Visual proportion of each expense category.
            </p>
            {breakdown.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', padding: '2rem 0', textAlign: 'center' }}>No expense categories to chart for this month.</p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {breakdown.map((entry, index) => (
                        <Cell key={entry.category} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `₦${Number(value).toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Inflow vs. Outflow ({selectedMonth})</h3>
            <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
              Total credits received vs. total debits spent in {account.institution}.
            </p>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart
                  data={[
                    { name: 'Total Credit (In)', amount: Number(summary.total_income) },
                    { name: 'Total Debit (Out)', amount: Number(summary.total_expense) },
                  ]}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(val) => `₦${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: any) => `₦${Number(value).toLocaleString()}`} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    <Cell fill="#16a34a" />
                    <Cell fill="#dc2626" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Income Overview & Inflow History */}
      {incomeOverview.length > 0 && (
        <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Income Overview & Inflows ({selectedMonth})</h3>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Complete record of all funds received into {account.institution} during this period ({incomeOverview.length} deposits).
              </p>
            </div>
            <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '1.1rem' }}>
              Total Inflow: +₦{Number(summary.total_income).toLocaleString()}
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem' }}>Date</th>
                  <th style={{ padding: '0.6rem' }}>Sender / Narration</th>
                  <th style={{ padding: '0.6rem' }}>Source Tag</th>
                  <th style={{ padding: '0.6rem' }}>Amount Received (₦)</th>
                </tr>
              </thead>
              <tbody>
                {incomeOverview.map((inc) => (
                  <tr key={inc.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{inc.date}</td>
                    <td style={{ padding: '0.6rem' }}>{inc.title}</td>
                    <td style={{ padding: '0.6rem' }}>{inc.category}</td>
                    <td style={{ padding: '0.6rem', fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>
                      +₦{Number(inc.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Spending Breakdown by Category */}
      {breakdown.length > 0 && (
        <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Spending Breakdown by Category ({selectedMonth})</h3>
              <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                Every debit accounted for by category. Unclarified expenses sit under Undocumented until clarified.
              </p>
            </div>
            <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '1.1rem' }}>
              Total Outflow: ₦{Number(summary.total_expense).toLocaleString()}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {breakdown.map((group) => {
              const isUndocumented = group.category === 'Undocumented';
              return (
                <div
                  key={group.category}
                  style={{
                    padding: '1.15rem',
                    borderRadius: '10px',
                    border: `1px solid ${isUndocumented ? '#fcd34d' : '#e5e7eb'}`,
                    backgroundColor: isUndocumented ? '#fffbeb' : '#f9fafb',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.6rem', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '1rem', color: isUndocumented ? '#b45309' : '#111827' }}>
                        {group.category}
                      </span>
                      <span style={{ marginLeft: '0.45rem', fontSize: '0.75rem', color: '#6b7280' }}>
                        ({group.count} {group.count === 1 ? 'item' : 'items'})
                      </span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem', color: isUndocumented ? '#b45309' : '#dc2626' }}>
                      ₦{Number(group.total).toLocaleString()}
                    </div>
                  </div>

                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.825rem' }}>
                    {group.transactions.map((item) => (
                      <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', color: '#374151' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.title}>
                          {item.date.slice(5)} • {item.title}
                        </span>
                        <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          ₦{Number(item.amount).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Saved Account Statement History */}
      <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>{account.institution} Full Statement History</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563' }}>Month:</label>
            <input
              type="month"
              max={currentMonth}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            />
          </div>
        </div>

        {transactions.length === 0 ? (
          <p style={{ color: '#6b7280' }}>No saved transactions for {account.institution} in {selectedMonth}.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem' }}>Date</th>
                  <th style={{ padding: '0.6rem' }}>Narration / Title</th>
                  <th style={{ padding: '0.6rem' }}>Category (Pick or Type Custom)</th>
                  <th style={{ padding: '0.6rem' }}>Credit (₦)</th>
                  <th style={{ padding: '0.6rem' }}>Debit (₦)</th>
                  <th style={{ padding: '0.6rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: tx.is_excluded ? '#fffbeb' : 'transparent' }}>
                    <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{tx.date}</td>
                    <td style={{ padding: '0.6rem', minWidth: '200px' }}>
                      {clarifyingId === tx.id ? (
                        <input
                          type="text"
                          value={clarifyTitle}
                          onChange={(e) => setClarifyTitle(e.target.value)}
                          placeholder="What was this spent on?"
                          style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                      ) : (
                        <>
                          {tx.title}
                          {tx.is_excluded && (
                            <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.45rem', backgroundColor: '#fde68a', color: '#92400e', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                              Needs clarification
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem', minWidth: '160px' }}>
                      {clarifyingId === tx.id ? (
                        <input
                          type="text"
                          list="suggested-categories"
                          value={clarifyCategory}
                          onChange={(e) => setClarifyCategory(e.target.value)}
                          placeholder="Select or type custom category"
                          style={{ width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                        />
                      ) : (
                        tx.category
                      )}
                    </td>
                    <td style={{ padding: '0.6rem', color: '#16a34a', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {tx.type === 'income' ? `₦${Number(tx.amount).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '0.6rem', color: '#dc2626', fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {tx.type === 'expense' ? `₦${Number(tx.amount).toLocaleString()}` : '—'}
                    </td>
                    <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>
                      {tx.is_excluded && (
                        clarifyingId === tx.id ? (
                          <>
                            <button
                              onClick={() => handleSaveClarification(tx.id)}
                              disabled={savingClarification || !clarifyTitle.trim()}
                              style={{ padding: '0.3rem 0.7rem', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', marginRight: '0.4rem' }}
                            >
                              {savingClarification ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelClarifying}
                              style={{ padding: '0.3rem 0.7rem', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setClarifyingId(tx.id);
                              setClarifyTitle(tx.title.replace(' - Needs Clarification', ''));
                              setClarifyCategory(tx.category === 'Uncategorized' ? '' : tx.category);
                            }}
                            style={{ padding: '0.3rem 0.7rem', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                          >
                            Clarify
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}