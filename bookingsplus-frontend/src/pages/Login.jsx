import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        // Simulate network call
        setTimeout(async () => {
            await login('admin@zappyworks.com', 'password');
            navigate('/');
        }, 800);
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="auth-header">
                    <h2>BookingsPlus</h2>
                    <p>Sign in to your organization</p>
                </div>
                
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group row-aligned">
                        <label>Email Address</label>
                        <input type="email" placeholder="admin@zappyworks.com" required className="input" defaultValue="admin@zappyworks.com" />
                    </div>
                    
                    <div className="form-group row-aligned">
                        <label>Password</label>
                        <input type="password" placeholder="••••••••" required className="input" defaultValue="password" />
                    </div>
                    
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
