export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(145deg, #0a0a0a 0%, #1c1a16 50%, #0a0a0a 100%)',
      padding: '24px',
      overflow: 'auto',
    }}>
      {children}
    </div>
  )
}
