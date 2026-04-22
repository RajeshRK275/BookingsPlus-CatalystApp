import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Share2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import axios from 'axios';
import PermissionGate from '../components/PermissionGate';
import { useWorkspace } from '../contexts/WorkspaceContext';

const Employees = () => {
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const wsSlug = activeWorkspace?.workspace_slug || '';
    const [searchQuery, setSearchQuery] = useState('');
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEmployees = async () => {
            try {
                const response = await axios.get('/server/bookingsplus/api/v1/users');
                
                if (response.data && response.data.success) {
                    setEmployees(response.data.data || []);
                }
            } catch (err) {
                console.error('Error fetching employees from Catalyst:', err);
                // Fallback for UI visualization if DB is strictly unreachable or table doesn't exist
                const fallback = localStorage.getItem('bp_employees');
                if (fallback) setEmployees(JSON.parse(fallback));
            } finally {
                setLoading(false);
            }
        };

        fetchEmployees();
    }, []);

    const filteredEmployees = employees.filter(emp => emp.name && emp.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="page-container">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <h1 style={{ fontSize: '18px', fontWeight: 600 }}>Active Employees</h1>
                    <span style={{
                        backgroundColor: '#F3F4F6', color: 'var(--pk-text-muted)',
                        padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600
                    }}>{employees.length}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--pk-border)',
                        borderRadius: '6px', padding: '7px 12px', backgroundColor: 'white', width: '220px'
                    }}>
                        <Search size={15} color="#9CA3AF" />
                        <input type="text" placeholder="Search" value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', backgroundColor: 'transparent' }} />
                    </div>
                    <PermissionGate permission="users.create">
                        <Button variant="primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Plus size={16} /> New Employee
                        </Button>
                    </PermissionGate>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#6B7280' }}>Loading Employees...</div>
            ) : (
                /* Employee Cards Grid */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                    {filteredEmployees.map(emp => (
                        <div key={emp.id || emp.user_id} 
                            onClick={() => navigate(`/ws/${wsSlug}/employees/${emp.id || emp.user_id}`)}
                            style={{
                                backgroundColor: 'white', borderRadius: '12px', padding: '20px',
                                border: '1px solid var(--pk-border)', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.1s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{
                                    width: '40px', height: '40px', borderRadius: '50%', backgroundColor: emp.color || '#E5E7EB',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
                                    fontSize: '14px', fontWeight: 600, flexShrink: 0
                                }}>
                                    {emp.initials || '👤'}
                                </div>
                                <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--pk-text-main)', marginBottom: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{emp.name}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{emp.email}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--pk-text-main)' }}>
                                    <span style={{color: 'var(--pk-text-muted)' }}>👤</span> {emp.role || 'Staff'}
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); }} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                                    backgroundColor: 'white', border: '1px solid var(--pk-border)', borderRadius: '6px',
                                    fontSize: '13px', fontWeight: 500, color: 'var(--pk-primary)', cursor: 'pointer'
                                }}>
                                    <Share2 size={13} /> Share
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Employees;
