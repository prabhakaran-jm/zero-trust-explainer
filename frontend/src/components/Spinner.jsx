/**
 * CSS-only spinner component
 */
function Spinner({ size = '16px' }) {
  return (
    <span 
      className="spinner" 
      style={{ 
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid rgba(0, 0, 0, 0.1)',
        borderTop: '2px solid currentColor',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }}
      aria-label="Loading"
      role="status"
    />
  )
}

export default Spinner

