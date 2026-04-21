import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const Onboarding = () => {
    const { user, refreshUser } = useAuth();
    const navigate = useNavigate();
    const [orgName, setOrgName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!orgName.trim()) {
            setError('Organization name is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await axios.post('/server/bookingsplus/api/v1/organizations/setup', {
                organization_name: orgName
            });

            if (response.data.success) {
                // Refresh the Auth context to clear needsOnboarding state, then go to Dashboard
                await refreshUser();
                navigate('/', { replace: true });
            } else {
                setError(response.data.message || 'Failed to setup organization');
            }
        } catch (err) {
            console.error('Onboarding Error:', err);
            setError('An error occurred during setup. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: '#F9FAFB' }}>
            <div className="login-card" style={{ maxWidth: '450px', width: '100%', padding: '40px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                <div className="auth-header" style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Welcome to BookingsPlus!</h2>
                    <p style={{ color: '#6B7280', fontSize: '14px' }}>Let's set up your workspace before we get started.</p>
                </div>
                
                {error && <div style={{ backgroundColor: '#FEE2E2', color: '#DC2626', padding: '12px', borderRadius: '6px', fontSize: '14px', marginBottom: '20px' }}>{error}</div>}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group" style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Your Name</label>
                        <input 
                            type="text" 
                            className="input" 
                            value={`${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email_id || 'Admin'}
                            disabled
                            style={{ backgroundColor: '#F3F4F6', color: '#6B7280', width: '100%' }}
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Organization Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g. ZappyWorks Salon" 
                            required 
                            className="input" 
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            style={{ width: '100%' }}
                            autoFocus
                        />
                    </div>
                    
                    <button 
                        type="submit" 
                        className="btn btn-primary btn-block" 
                        disabled={loading}
                        style={{ width: '100%', padding: '12px', fontSize: '16px' }}
                    >
                        {loading ? 'Setting up workspace...' : 'Complete Setup'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Onboarding;
