import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminAccess.css';

function AdminAccess() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Contraseña del administrador (puedes cambiarla)
  const ADMIN_PASSWORD = 'admin123';

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (password === ADMIN_PASSWORD) {
      // Guardar en sessionStorage que el admin está autenticado
      sessionStorage.setItem('isAdmin', 'true');
      navigate('/display');
    } else {
      setError('Contraseña incorrecta');
      setPassword('');
    }
  };

  return (
    <div className="admin-access">
      <div className="admin-box">
        <h1>🔐 Acceso Administrativo</h1>
        <p>Ingresa la contraseña para acceder al display</p>
        
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          
          {error && <p className="error-message">{error}</p>}
          
          <button type="submit">Acceder</button>
        </form>

        <button 
          className="back-btn"
          onClick={() => navigate('/')}
        >
          ← Volver a inicio
        </button>

        <div className="admin-hint">
          <small>💡 Tip: La contraseña por defecto es "admin123"</small>
        </div>
      </div>
    </div>
  );
}

export default AdminAccess;
