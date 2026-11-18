import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../api';

interface Account {
  id: number;
  name: string;
  institution: string;
  type: string;
  balance: string;
}

interface Expense {
  id: number;
  account_id: number | null;
  account?: { id: number; name: string; institution: string; type: string };
  title: string;
  amount: string;
  type: 'income' | 'expense' | 'transfer';
  category: string;
  date: string;
  is_excluded: boolean;
}

interface Summary {
  total_income: number;
  total_expense: number;
  balance: number;
  overall_balance: number;
  unclarified_count: number;
  unclarified_total: number;
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

export default function Dashboard() {
  const navigate = useNavigate();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [annualAccountId, setAnnualAccountId] = useState('');
  const [annualData, setAnnualData] = useState<{
    summary: { total_income: number; total_expense: number; net_savings: number; top_category: string; top_category_amount: number };
    monthly_trend: { month: string; Income: number; Expenses: number }[];
    category_breakdown: { category: string; total: number; count: number }[];
  } | null>(null);

  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_income: 0,
    total_expense: 0,
    balance: 0,
    overall_balance: 0,
    unclarified_count: 0,
    unclarified_total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Clarification-only state
  const [clarifyingItem, setClarifyingItem] = useState<Expense | null>(null);
  const [clarifyTitle, setClarifyTitle] = useState('');
  const [clarifyCategory, setClarifyCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchDashboardData = async (monthToFetch = selectedMonth) => {
    try {
      const [userRes, expensesRes, accountsRes] = await Promise.all([
        api.get('/user'),
        api.get(`/expenses?month=${monthToFetch}`),
        api.get('/accounts'),
      ]);
      setUser(userRes.data);
      setExpenses(expensesRes.data.expenses);
      setSummary(expensesRes.data.summary);
      setAccounts(accountsRes.data.accounts);
    } catch {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    const accQuery = annualAccountId ? `&account_id=${annualAccountId}` : '';
    api.get(`/annual-summary?year=${selectedYear}${accQuery}`)
      .then((res) => setAnnualData(res.data))
      .catch(() => setAnnualData(null));
  }, [selectedYear, annualAccountId, expenses]);

  // Compute Cumulative Category Spending Chart Data across all accounts for selected month
  const cumulativeCategoryData = useMemo(() => {
    const grouped: Record<string, number> = {};
    expenses
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        const key = tx.is_excluded || tx.category.toLowerCase() === 'uncategorized' ? 'Undocumented' : tx.category;
        grouped[key] = (grouped[key] || 0) + Number(tx.amount);
      });

    return Object.entries(grouped)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Compute Cross-Bank Balance vs Monthly Expense Bar Chart Data
  const bankComparisonData = useMemo(() => {
    return accounts.map((acc) => {
      const spentInMonth = expenses
        .filter((tx) => tx.account_id === acc.id && tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      return {
        bank: acc.institution,
        Balance: Number(acc.balance),
        Spent: spentInMonth,
      };
    });
  }, [accounts, expenses]);

  const openClarifyForm = (item: Expense) => {
    setClarifyingItem(item);
    setClarifyTitle(item.title.replace(' - Needs Clarification', ''));
    setClarifyCategory(item.category === 'Uncategorized' ? '' : item.category);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveClarification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clarifyingItem || !clarifyTitle.trim()) return;
    setError('');
    setSubmitting(true);

    try {
      await api.put(`/expenses/${clarifyingItem.id}`, {
        title: clarifyTitle,
        category: clarifyCategory.trim() || clarifyTitle,
        is_excluded: false,
      });
      setClarifyingItem(null);
      setClarifyTitle('');
      setClarifyCategory('');
      await fetchDashboardData(selectedMonth);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save clarification');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/logout');
    } finally {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      navigate('/login');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '2rem 1rem' }}>
      <datalist id="dashboard-categories">
        {SUGGESTED_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      {/* Top Navbar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Expense Tracker</h1>
          {user && <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.2rem' }}>Welcome, <strong>{user.name}</strong> ({user.email})</p>}
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            to="/accounts"
            style={{ padding: '0.55rem 1rem', backgroundColor: '#4f46e5', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Accounts & Statements
          </Link>
          <Link
            to="/budgets"
            style={{ padding: '0.55rem 1rem', backgroundColor: '#059669', color: '#fff', borderRadius: '8px', fontWeight: 600, textDecoration: 'none', fontSize: '0.9rem' }}
          >
            Manage Budgets
          </Link>
          <button
            onClick={handleLogout}
            style={{ padding: '0.55rem 1rem', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' }}
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Needs Clarification Alert Banner */}
      {summary.unclarified_count > 0 && (
        <div style={{ backgroundColor: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '1rem 1.25rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
          <strong>Action Needed:</strong> You have <strong>{summary.unclarified_count}</strong> statement transaction(s) totaling <strong>₦{Number(summary.unclarified_total).toLocaleString()}</strong> awaiting clarification. Click <strong>Clarify</strong> on any highlighted row below so every expense is documented accurately.
        </div>
      )}

      {/* Clarification Panel */}
      {clarifyingItem && (
        <section style={{ backgroundColor: '#fffbeb', border: '1px solid #f59e0b', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem', color: '#92400e' }}>
            Clarify Statement Transaction (₦{Number(clarifyingItem.amount).toLocaleString()} on {clarifyingItem.date})
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#78350f', marginBottom: '1rem' }}>
            Describe what this transaction was for (e.g., Yam, Tissue, Gift, Miscellaneous). Statement amounts remain locked for accuracy.
          </p>

          {error && (
            <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSaveClarification} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>What was this spent on?</label>
              <input
                type="text"
                required
                value={clarifyTitle}
                onChange={(e) => setClarifyTitle(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>Category (Pick or Type Any)</label>
              <input
                type="text"
                list="dashboard-categories"
                placeholder="Select or type custom category"
                value={clarifyCategory}
                onChange={(e) => setClarifyCategory(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '1px solid #d1d5db', borderRadius: '8px', backgroundColor: '#fff' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{ flex: 1, padding: '0.65rem 1rem', backgroundColor: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                {submitting ? 'Saving...' : 'Save Clarification'}
              </button>
              <button
                type="button"
                onClick={() => setClarifyingItem(null)}
                style={{ padding: '0.65rem 0.9rem', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Cumulative Summary Cards Across All Linked Accounts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>Cumulative Income ({selectedMonth})</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16a34a', marginTop: '0.25rem' }}>
            ₦{Number(summary.total_income).toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>Cumulative Expenses ({selectedMonth})</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#dc2626', marginTop: '0.25rem' }}>
            ₦{Number(summary.total_expense).toLocaleString()}
          </div>
        </div>
        <div style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 600 }}>Total Net Balance (All Banks)</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>
            ₦{Number(summary.overall_balance).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Executive Monthly Visual Analytics Charts */}
      {(accounts.length > 0 || cumulativeCategoryData.length > 0) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Monthly Spending by Category ({selectedMonth})</h3>
            <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
              Combined expenses across all your linked bank and fintech accounts.
            </p>
            {cumulativeCategoryData.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', padding: '2rem 0', textAlign: 'center' }}>No expenses recorded in {selectedMonth} yet.</p>
            ) : (
              <div style={{ width: '100%', height: 270 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={cumulativeCategoryData}
                      dataKey="total"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {cumulativeCategoryData.map((entry, index) => (
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
            <h3 style={{ fontSize: '1.05rem', marginBottom: '0.25rem' }}>Accounts Balance vs. Monthly Spent</h3>
            <p style={{ color: '#6b7280', fontSize: '0.825rem', marginBottom: '0.75rem' }}>
              Compare your current balance and {selectedMonth} outflow across every bank.
            </p>
            {bankComparisonData.length === 0 ? (
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', padding: '2rem 0', textAlign: 'center' }}>Link an account to view bank comparisons.</p>
            ) : (
              <div style={{ width: '100%', height: 270 }}>
                <ResponsiveContainer>
                  <BarChart data={bankComparisonData} margin={{ top: 10, right: 15, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="bank" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={(val) => `₦${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: any) => `₦${Number(value).toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Bar dataKey="Balance" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Spent" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Annual & End-of-Year Spending Review */}
      {annualData && (
        <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '0.2rem 0.6rem', borderRadius: '999px' }}>
                Annual Wrap-Up
              </span>
              <h3 style={{ fontSize: '1.15rem', marginTop: '0.35rem', marginBottom: 0 }}>
                {selectedYear} Full-Year Spending & Cashflow Review
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                value={annualAccountId}
                onChange={(e) => setAnnualAccountId(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', backgroundColor: '#fff' }}
              >
                <option value="">All Banks Combined</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.institution}</option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                style={{ padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, backgroundColor: '#fff' }}
              >
                {[currentYear, currentYear - 1, currentYear - 2].map((yr) => (
                  <option key={yr} value={String(yr)}>{yr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 4 Annual KPI Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
            <div style={{ backgroundColor: '#f0fdf4', padding: '0.9rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#166534' }}>{selectedYear} Total Inflow</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#16a34a', marginTop: '0.2rem' }}>
                ₦{Number(annualData.summary.total_income).toLocaleString()}
              </div>
            </div>
            <div style={{ backgroundColor: '#fef2f2', padding: '0.9rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#991b1b' }}>{selectedYear} Total Spent</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#dc2626', marginTop: '0.2rem' }}>
                ₦{Number(annualData.summary.total_expense).toLocaleString()}
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '0.9rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{selectedYear} Net Cashflow</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: annualData.summary.net_savings >= 0 ? '#16a34a' : '#dc2626', marginTop: '0.2rem' }}>
                ₦{Number(annualData.summary.net_savings).toLocaleString()}
              </div>
            </div>
            <div style={{ backgroundColor: '#fffbeb', padding: '0.9rem 1rem', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e' }}>Top Expense Category</div>
              <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b45309', marginTop: '0.2rem' }}>
                {annualData.summary.top_category} (₦{Number(annualData.summary.top_category_amount).toLocaleString()})
              </div>
            </div>
          </div>

          {/* 12-Month Trend Bar Chart + Full-Year Category Donut */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Month-by-Month Income vs. Spending ({selectedYear})</h4>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={annualData.monthly_trend} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(val) => `₦${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: any) => `₦${Number(value).toLocaleString()}`} />
                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Bar dataKey="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Annual Spending by Category ({selectedYear})</h4>
              {annualData.category_breakdown.length === 0 ? (
                <p style={{ color: '#9ca3af', fontSize: '0.85rem', padding: '2rem 0', textAlign: 'center' }}>No expenses recorded in {selectedYear}.</p>
              ) : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={annualData.category_breakdown}
                        dataKey="total"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        {annualData.category_breakdown.map((entry, index) => (
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
          </div>
        </section>
      )}

      {/* Clickable Linked Accounts Grid */}
      <section style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Your Linked Accounts (Click any bank to view breakdown & upload statement)</h3>
          <Link to="/accounts" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>
            + Add Account
          </Link>
        </div>

        {accounts.length === 0 ? (
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd', color: '#1e40af', padding: '1rem 1.25rem', borderRadius: '10px' }}>
            No bank accounts linked yet. <Link to="/accounts" style={{ fontWeight: 700, color: '#1d4ed8' }}>Add your Commercial Bank, MFB, or Fintech account to upload a statement →</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
            {accounts.map((acc) => (
              <Link
                key={acc.id}
                to={`/accounts/${acc.id}`}
                style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '0.15rem 0.5rem', borderRadius: '999px' }}>
                  {acc.type.replace('_', ' ')}
                </span>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '0.4rem' }}>
                  {acc.name} - {acc.institution}
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#16a34a', marginTop: '0.4rem' }}>
                  ₦{Number(acc.balance).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#2563eb', fontWeight: 600, marginTop: '0.5rem' }}>
                  View breakdown →
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Cumulative Statement Transactions History Table */}
      <section style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', margin: 0 }}>All Accounts Statement History</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 600 }}>Viewing Month:</label>
            <input
              type="month"
              max={currentMonth}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ padding: '0.45rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        {expenses.length === 0 ? (
          <p style={{ color: '#6b7280', padding: '1rem 0' }}>No imported statement transactions found for {selectedMonth}.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  <th style={{ padding: '0.6rem' }}>Date</th>
                  <th style={{ padding: '0.6rem' }}>Account</th>
                  <th style={{ padding: '0.6rem' }}>Narration / Title</th>
                  <th style={{ padding: '0.6rem' }}>Category</th>
                  <th style={{ padding: '0.6rem' }}>Amount</th>
                  <th style={{ padding: '0.6rem' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: item.is_excluded ? '#fffbeb' : 'transparent' }}>
                    <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>{item.date}</td>
                    <td style={{ padding: '0.6rem' }}>
                      {item.account ? `${item.account.name} - ${item.account.institution}` : 'Bank'}
                    </td>
                    <td style={{ padding: '0.6rem' }}>
                      {item.title}
                      {item.is_excluded && (
                        <span style={{ marginLeft: '0.5rem', padding: '0.1rem 0.45rem', backgroundColor: '#fde68a', color: '#92400e', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Needs clarification
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '0.6rem' }}>{item.is_excluded ? 'Undocumented' : item.category}</td>
                    <td style={{ padding: '0.6rem', fontWeight: 700, whiteSpace: 'nowrap', color: item.type === 'income' ? '#16a34a' : item.type === 'transfer' ? '#4f46e5' : '#dc2626' }}>
                      {item.type === 'income' ? '+' : item.type === 'transfer' ? '⇄ ' : '-'}₦{Number(item.amount).toLocaleString()}
                    </td>
                    <td style={{ padding: '0.6rem', whiteSpace: 'nowrap' }}>
                      {item.is_excluded ? (
                        <button
                          onClick={() => openClarifyForm(item)}
                          style={{ padding: '0.3rem 0.7rem', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Clarify
                        </button>
                      ) : (
                        <span style={{ padding: '0.15rem 0.55rem', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700 }}>
                          Documented
                        </span>
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