import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Share2, Plus, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';

const INITIAL_EMPLOYEES = [
    { id: 1, name: 'Jason Miller', email: 'pradhap.mm+user2@zohotest.com', role: 'Staff', initials: 'JM', color: '#E0E7FF', phone: '+919876543210', designation: '-', gender: 'Male', dob: '-', status: 'Active' },
    { id: 2, name: 'Emily Carter', email: 'pradhap.mm+user1@zohotest.com', role: 'Staff', initials: 'EC', color: '#E0E7FF', phone: '+919876543211', designation: '-', gender: 'Female', dob: '-', status: 'Active' },
    { id: 3, name: 'Michael Thompson', email: 'pradhap.mm+us@zohotest.com', role: 'Super Admin', initials: 'MT', color: '#E0E7FF', phone: '+919876543212', designation: '-', gender: 'Male', dob: '-', status: 'Active' },
    { id: 4, name: 'Sarah Johnson', email: 'sarah.j@zohotest.com', role: 'Staff', initials: 'SJ', color: '#E0E7FF', phone: '+919876543213', designation: '-', gender: 'Female', dob: '-', status: 'Active' },
    { id: 5, name: 'David Wilson', email: 'david.w@zohotest.com', role: 'Staff', initials: 'DW', color: '#E0E7FF', phone: '+919876543214', designation: '-', gender: 'Male', dob: '-', status: 'Active' }
];

export const getEmployees = () => {
    let emps = localStorage.getItem('bp_employees');
    if (!emps) {
        localStorage.setItem('bp_employees', JSON.stringify(INITIAL_EMPLOYEES));
        return INITIAL_EMPLOYEES;
    }
    return JSON.parse(emps);
};

export const saveEmployees = (emps) => {
    localStorage.setItem('bp_employees', JSON.stringify(emps));
};

const Employees = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [employees, setEmployees] = useState(getEmployees());

    const filteredEmployees = employees.filter(emp => emp.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
                    <Button variant="primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Plus size={16} /> New Employee
                    </Button>
                </div>
            </div>

            {/* Employee Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                {filteredEmployees.map(emp => (
                    <div key={emp.id} 
                        onClick={() => navigate(`/employees/${emp.id}`)}
                        style={{
                            backgroundColor: 'white', borderRadius: '12px', padding: '20px',
                            border: '1px solid var(--pk-border)', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#E5E7EB',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B7280',
                                fontSize: '14px', fontWeight: 600, flexShrink: 0
                            }}>
                                👤
                            </div>
                            <div style={{ overflow: 'hidden' }}>
                                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--pk-text-main)', marginBottom: '2px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{emp.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--pk-text-muted)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{emp.email}</div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--pk-text-main)' }}>
                                <span style={{color: 'var(--pk-text-muted)' }}>👤</span> {emp.role}
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
        </div>
    );
};

export default Employees;
