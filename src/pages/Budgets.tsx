import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';
import { PageCardsSkeleton } from '../components/Skeleton';


interface Account {
  id: number;
  name: string;
  institution: string;
  type: string;
  balance: string;
}

interface BudgetProgress {
  id: number;
  account_id: number | null;
  account?: { id: number; name: string; institution: string };
  category: string;
  period: 'monthly' | 'yearly';
  month: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
  is_exceeded: boolean;
}

const BUDGET_CATEGORIES = [
  'Food',
  'Household Items',
  'Utilities',
  'Subscriptions',
  'Personal Care',
  'Transport',
  'Gifts',
  'Loans & Bills',
  'Miscellaneous',
];

export default function Budgets() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(searchParams.get('account') || '');
  const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const [category, setCategory] = useState('Food');
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchBudgets = async (month = selectedMonth, accId = selectedAccountId) => {
    try {
      const accountQuery = accId ? `&account_id=${accId}` : '';
      const [budgetsRes, accountsRes] = await Promise.all([
        api.get(`/budgets?month=${month}${accountQuery}`),
        api.get('/accounts'),
      ]);
      setBudgets(budgetsRes.data.budgets || []);
      setAccounts(accountsRes.data.accounts || []);
    } catch {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessage('');
    setError('');
    fetchBudgets(selectedMonth, selectedAccountId);
  }, [selectedMonth, selectedAccountId]);

  const budgetChartData = useMemo(() => {
    return budgets.map((b) => ({
      category: `${b.category} (${b.period === 'yearly' ? 'Yearly' : 'Monthly'})`,
      Limit: Number(b.limit),
      Spent: Number(b.spent),
      is_exceeded: b.is_exceeded,
    }));
  }, [budgets]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      const res = await api.post('/budgets', {
        account_id: selectedAccountId ? Number(selectedAccountId) : null,
        category: category.trim(),
        amount: Number(amount),
        period,
        month: selectedMonth,
      });
      setMessage(res.data.message);
      setAmount('');
      await fetchBudgets(selectedMonth, selectedAccountId);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save budget.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id: number) => {
    if (!window.confirm('Delete this budget limit?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      await fetchBudgets(selectedMonth, selectedAccountId);
    } catch {
      setError('Could not delete budget.');
    }
  };

  if (loading) {
    return <PageCardsSkeleton />;
  }


  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '2rem 1rem' }}>
      <datalist id="budget-category-options">
        {BUDGET_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Account-Scoped Budgets</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Monthly budgets apply only to the selected month; Yearly budgets track across the full calendar year.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <Link to="/accounts" style={{ padding: '0.55rem 1rem', backgroundColor: '#e5e7eb', color: '#111827', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            Accounts
          </Link>
          <Link to="/dashboard" style={{ padding: '0.55rem 1rem', backgroundColor: '#2563eb', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}>
            ← Main Dashboard
          </Link>
        </div>
      </header>

      {/* Filter Bar */}
      <section style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'end' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Account Scope</label>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            style={{ width: '100%', padding: '0.55rem', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff' }}
          >
            <option value="">All Linked Accounts (Global Budget)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>{acc.name} — {acc.institution}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Viewing Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: '0.5rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
          />
        </div>
      </section>

      {/* Set / Update Budget Form */}
      <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '0.75rem' }}>Set Category Spending Limit ({selectedMonth})</h3>

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

        <form onSubmit={handleSaveBudget} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Category (Pick or Type Custom)</label>
            <input
              type="text"
              list="budget-category-options"
              required
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Budget Frequency</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'monthly' | 'yearly')}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff' }}
            >
              <option value="monthly">Monthly ({selectedMonth} only)</option>
              <option value="yearly">Yearly (All of {selectedMonth.slice(0, 4)})</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Spending Limit (₦)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="e.g. 50000"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px' }}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            style={{ padding: '0.65rem 1.25rem', backgroundColor: '#059669', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
          >
            {submitting ? 'Saving...' : 'Save Budget Limit'}
          </button>
        </form>
      </section>

      {/* Budget Visual Analytics Chart (Renders ONLY when budgets exist for the selected month/year!) */}
      {budgetChartData.length > 0 && (
        <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Budget Limit vs. Actual Spent ({selectedMonth})</h3>
          <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
            Blue shows your set limit; Green shows spending within budget; Red shows exceeded limits.
          </p>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={budgetChartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(val) => `₦${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: any) => `₦${Number(value).toLocaleString()}`} />
                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                <Bar dataKey="Limit" fill="#2563eb" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Spent" fill="#16a34a" radius={[6, 6, 0, 0]}>
                  {budgetChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.is_exceeded ? '#dc2626' : '#16a34a'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* Budget Progress Cards */}
      {budgets.length === 0 ? (
        <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', color: '#6b7280' }}>
          No budgets configured for {selectedMonth}. Set a Monthly or Yearly budget above to start tracking.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
          {budgets.map((b) => {
            const barWidth = Math.min(b.percentage, 100);
            const barColor = b.is_exceeded ? '#dc2626' : b.percentage >= 80 ? '#f59e0b' : '#16a34a';
            return (
              <div key={b.id} style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: b.is_exceeded ? '1px solid #fca5a5' : '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        {b.account ? `${b.account.institution}` : 'All Accounts'}
                      </span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                        {b.period === 'yearly' ? `Yearly (${b.month.slice(0, 4)})` : `Monthly (${b.month})`}
                      </span>
                    </div>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.4rem' }}>{b.category}</h4>
                  </div>
                  <button
                    onClick={() => handleDeleteBudget(b.id)}
                    style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Delete
                  </button>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.4rem' }}>
                  <span>Spent: ₦{Number(b.spent).toLocaleString()}</span>
                  <span>Limit: ₦{Number(b.limit).toLocaleString()}</span>
                </div>

                <div style={{ width: '100%', height: '10px', backgroundColor: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ width: `${barWidth}%`, height: '100%', backgroundColor: barColor, transition: 'width 0.3s ease' }} />
                </div>

                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: b.is_exceeded ? '#dc2626' : '#16a34a' }}>
                  {b.is_exceeded
                    ? `Over budget by ₦${Math.abs(b.remaining).toLocaleString()} (${b.percentage}%)`
                    : `₦${Number(b.remaining).toLocaleString()} remaining (${b.percentage}% used)`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}