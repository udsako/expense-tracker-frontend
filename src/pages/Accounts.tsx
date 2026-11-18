import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

type AccountCategory = 'commercial_bank' | 'mfb' | 'fintech';

interface Account {
  id: number;
  name: string;
  institution: string;
  type: AccountCategory;
  balance: string;
}

interface ReconcileResult {
  status: string;
  message: string;
  discrepancy?: number;
}

const INSTITUTIONS_BY_TYPE: Record<AccountCategory, string[]> = {
  commercial_bank: [
    'UBA',
    'Polaris Bank',
    'GTBank',
    'Access Bank',
    'Zenith Bank',
    'FirstBank',
    'Fidelity Bank',
    'Union Bank',
    'Stanbic IBTC',
    'Sterling Bank',
    'Wema Bank',
    'FCMB',
    'Ecobank',
    'Other',
  ],
  mfb: [
    'FairMoney MFB',
    'VFD MFB',
    'Lapo MFB',
    'Renmoney MFB',
    'Eyowo MFB',
    'Sparkle MFB',
    'Mintyn MFB',
    'Rubies MFB',
    'AB Microfinance Bank',
    'Other',
  ],
  fintech: ['OPAY', 'Kuda', 'PalmPay', 'Moniepoint', 'Carbon', 'Paga', 'Flutterwave Wallet', 'Other'],
};

const TYPE_LABELS: Record<AccountCategory, string> = {
  commercial_bank: 'Commercial Bank',
  mfb: 'Microfinance Bank (MFB)',
  fintech: 'Fintech Wallet',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff',
  padding: '1.5rem',
  borderRadius: '12px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  marginBottom: '1.5rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.6rem',
  border: '1px solid #d1d5db',
  borderRadius: '8px',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, backgroundColor: '#fff' };

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  marginBottom: '0.25rem',
};

const primaryButton = (bg: string): React.CSSProperties => ({
  padding: '0.65rem 1rem',
  backgroundColor: bg,
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
});

export default function Accounts() {
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Create account state
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountCategory>('commercial_bank');
  const [institution, setInstitution] = useState(INSTITUTIONS_BY_TYPE.commercial_bank[0]);
  const [customInstitution, setCustomInstitution] = useState('');
  const [creating, setCreating] = useState(false);

  // Reconciliation state
  const [reconcileAccountId, setReconcileAccountId] = useState('');
  const [actualBalance, setActualBalance] = useState('');
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [reconciling, setReconciling] = useState(false);

  const fetchAccounts = async () => {
    try {
      const [accountsRes, userRes] = await Promise.all([api.get('/accounts'), api.get('/user')]);
      setAccounts(accountsRes.data.accounts);
      setTotalBalance(accountsRes.data.total_balance);

      // Pre-fill the holder name with the logged-in user's name (only if still empty)
      if (userRes.data?.name) {
        setName((current) => current || userRes.data.name);
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        navigate('/login');
      } else {
        setError(err.response?.data?.message || 'Could not load your accounts.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTypeChange = (newType: AccountCategory) => {
    setType(newType);
    setInstitution(INSTITUTIONS_BY_TYPE[newType][0]);
    setCustomInstitution('');
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const finalInstitution = institution === 'Other' ? customInstitution.trim() : institution;
    if (!finalInstitution) {
      setError('Please enter your bank or wallet name.');
      return;
    }

    setCreating(true);
    try {
      const res = await api.post('/accounts', {
        name: name.trim(),
        institution: finalInstitution,
        type,
      });
      setMessage(res.data.message);
      setCustomInstitution('');
      await fetchAccounts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  const handleCheckReconcile = async (e: React.SyntheticEvent, autoLog = false) => {
    e.preventDefault();
    if (!reconcileAccountId) return;
    setError('');
    setMessage('');
    setReconciling(true);
    try {
      const res = await api.post(`/accounts/${reconcileAccountId}/reconcile`, {
        actual_balance: actualBalance,
        auto_log: autoLog,
      });
      if (autoLog) {
        setMessage(res.data.message);
        setActualBalance('');
        setReconcileResult(null);
        await fetchAccounts();
      } else {
        setReconcileResult(res.data);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!window.confirm('Delete this account and all transactions attached to it?')) return;
    setError('');
    setMessage('');
    try {
      await api.delete(`/accounts/${id}`);
      if (String(id) === reconcileAccountId) {
        setReconcileAccountId('');
        setReconcileResult(null);
      }
      await fetchAccounts();
    } catch {
      setError('Could not delete account');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading accounts...</div>;
  }

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header
        style={{
          ...cardStyle,
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Bank Accounts</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0.2rem 0 0' }}>
            Cumulative Net Balance:{' '}
            <strong style={{ color: '#111827' }}>₦{Number(totalBalance).toLocaleString()}</strong>
          </p>
        </div>
        <Link
          to="/dashboard"
          style={{
            padding: '0.55rem 1.1rem',
            backgroundColor: '#2563eb',
            color: '#fff',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          ← Back to Dashboard
        </Link>
      </header>

      {message && (
        <div
          style={{
            backgroundColor: '#dcfce7',
            color: '#166534',
            padding: '0.85rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            padding: '0.85rem',
            borderRadius: '8px',
            marginBottom: '1.25rem',
            fontSize: '0.9rem',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      {/* Existing Accounts Grid */}
      {accounts.length > 0 && (
        <section style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
            }}
          >
            {accounts.map((acc) => (
              <div
                key={acc.id}
                style={{
                  backgroundColor: '#fff',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: '#4f46e5',
                          backgroundColor: '#eef2ff',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                        }}
                      >
                        {TYPE_LABELS[acc.type] || acc.type}
                      </span>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: '0.4rem' }}>
                        {acc.name} - {acc.institution}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: '1.65rem',
                      fontWeight: 700,
                      color: Number(acc.balance) < 0 ? '#dc2626' : '#16a34a',
                      marginTop: '0.65rem',
                    }}
                  >
                    ₦{Number(acc.balance).toLocaleString()}
                  </div>
                </div>

                <Link
                  to={`/accounts/${acc.id}`}
                  style={{
                    marginTop: '1rem',
                    display: 'inline-block',
                    textAlign: 'center',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#f3f4f6',
                    color: '#1d4ed8',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                >
                  Open Statement &amp; Upload PDF/CSV →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add New Bank / MFB / Fintech Account Form */}
      <section style={cardStyle}>
        <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>
          Add Commercial Bank, MFB, or Fintech Account
        </h3>
        <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem' }}>
          Must match your registered legal name so uploaded bank statements can be verified securely.
        </p>

        <form
          onSubmit={handleCreateAccount}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <div>
            <label style={labelStyle}>Account Holder Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Institution Category</label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as AccountCategory)}
              style={selectStyle}
            >
              <option value="commercial_bank">Commercial Bank</option>
              <option value="mfb">Microfinance Bank (MFB)</option>
              <option value="fintech">Fintech Wallet</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Bank / Institution</label>
            <select
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              style={selectStyle}
            >
              {INSTITUTIONS_BY_TYPE[type].map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          </div>

          {institution === 'Other' && (
            <div>
              <label style={labelStyle}>Enter Bank / MFB Name</label>
              <input
                type="text"
                placeholder="Type institution name"
                required
                value={customInstitution}
                onChange={(e) => setCustomInstitution(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          <button type="submit" disabled={creating} style={primaryButton('#2563eb')}>
            {creating ? 'Adding...' : 'Create Account'}
          </button>
        </form>
      </section>

      {/* Missing Transaction Detector (Balance Reconciliation) */}
      {accounts.length > 0 && (
        <section style={cardStyle}>
          <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.25rem' }}>
            Balance Check &amp; Missing Transaction Detector
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '0 0 1rem' }}>
            Enter your real bank app balance to verify if any recent transactions occurred after your
            last statement upload.
          </p>

          <form
            onSubmit={(e) => handleCheckReconcile(e, false)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <div>
              <label style={labelStyle}>Select Account</label>
              <select
                required
                value={reconcileAccountId}
                onChange={(e) => {
                  setReconcileAccountId(e.target.value);
                  setReconcileResult(null);
                }}
                style={selectStyle}
              >
                <option value="">Choose account</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} - {acc.institution} (Tracked: ₦{Number(acc.balance).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Actual Bank Balance (₦)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter real bank balance"
                required
                value={actualBalance}
                onChange={(e) => {
                  setActualBalance(e.target.value);
                  setReconcileResult(null);
                }}
                style={inputStyle}
              />
            </div>

            <button type="submit" disabled={reconciling} style={primaryButton('#0f172a')}>
              {reconciling ? 'Checking...' : 'Check for Discrepancies'}
            </button>
          </form>

          {reconcileResult && (
            <div
              style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: reconcileResult.status === 'matched' ? '#dcfce7' : '#fef3c7',
                color: reconcileResult.status === 'matched' ? '#166534' : '#92400e',
              }}
            >
              <p style={{ fontSize: '0.9rem', fontWeight: 500, margin: 0 }}>{reconcileResult.message}</p>

              {(reconcileResult.status === 'missing_expense' ||
                reconcileResult.status === 'missing_income') && (
                <button
                  type="button"
                  disabled={reconciling}
                  onClick={(e) => handleCheckReconcile(e, true)}
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#d97706',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Log Missing Transaction &amp; Flag for Clarification
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}