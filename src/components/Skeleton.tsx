interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = '100%', height = '16px', borderRadius = '8px', style }: SkeletonProps) {
  return (
    <>
      <style>{`
        @keyframes pulseSkeleton {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
      <div
        style={{
          width,
          height,
          borderRadius,
          backgroundColor: '#e5e7eb',
          animation: 'pulseSkeleton 1.5s ease-in-out infinite',
          ...style,
        }}
      />
    </>
  );
}

export function DashboardSkeleton() {
  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ width: '45%' }}>
          <Skeleton width="180px" height="24px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton width="240px" height="14px" />
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <Skeleton width="140px" height="36px" />
          <Skeleton width="120px" height="36px" />
          <Skeleton width="85px" height="36px" />
        </div>
      </div>

      {/* 3 Summary Cards Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Skeleton width="65%" height="14px" style={{ marginBottom: '0.75rem' }} />
            <Skeleton width="80%" height="28px" />
          </div>
        ))}
      </div>

      {/* 2 Charts Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Skeleton width="55%" height="18px" style={{ marginBottom: '0.5rem' }} />
            <Skeleton width="75%" height="12px" style={{ marginBottom: '1.25rem' }} />
            <Skeleton width="100%" height="220px" borderRadius="10px" />
          </div>
        ))}
      </div>

      {/* Transactions Table Skeleton */}
      <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Skeleton width="220px" height="20px" style={{ marginBottom: '1.25rem' }} />
        {[1, 2, 3, 4, 5].map((row) => (
          <div key={row} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 2fr 1fr 1fr', gap: '0.75rem', padding: '0.75rem 0', borderBottom: '1px solid #f3f4f6' }}>
            <Skeleton height="16px" />
            <Skeleton height="16px" />
            <Skeleton height="16px" />
            <Skeleton height="16px" />
            <Skeleton height="16px" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageCardsSkeleton() {
  return (
    <div style={{ maxWidth: '1040px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '1.25rem 1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <div style={{ width: '50%' }}>
          <Skeleton width="210px" height="24px" style={{ marginBottom: '0.5rem' }} />
          <Skeleton width="280px" height="14px" />
        </div>
        <Skeleton width="130px" height="36px" />
      </div>

      <div style={{ backgroundColor: '#fff', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '1.5rem' }}>
        <Skeleton width="200px" height="18px" style={{ marginBottom: '1rem' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
          <Skeleton height="40px" />
          <Skeleton height="40px" />
          <Skeleton height="40px" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3].map((card) => (
          <div key={card} style={{ backgroundColor: '#fff', padding: '1.25rem', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <Skeleton width="90px" height="16px" borderRadius="999px" style={{ marginBottom: '0.6rem' }} />
            <Skeleton width="70%" height="20px" style={{ marginBottom: '0.75rem' }} />
            <Skeleton width="100%" height="12px" style={{ marginBottom: '0.5rem' }} />
            <Skeleton width="50%" height="14px" />
          </div>
        ))}
      </div>
    </div>
  );
}
