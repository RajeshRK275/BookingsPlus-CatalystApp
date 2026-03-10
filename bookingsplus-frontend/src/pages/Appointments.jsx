import React, { useState } from 'react';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { Plus, Search, HelpCircle } from 'lucide-react';

const mockAppointments = []; // Set empty to show empty state like screenshot

const Appointments = () => {
    const [appointments] = useState(mockAppointments);
    const [activeTab, setActiveTab] = useState('Upcoming');

    return (
        <div className="page-container">
            <div className="page-header-flex">
                <h1 className="page-title">
                    Appointments
                </h1>
                <HelpCircle className="help-icon" size={20} />
            </div>
            
            <div className="tab-navigation">
                <div className="tabs-left">
                    <div 
                        className={`tab-item ${activeTab === 'Upcoming' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Upcoming')}
                    >
                        Upcoming
                    </div>
                    <div 
                        className={`tab-item ${activeTab === 'Past' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Past')}
                    >
                        Past
                    </div>
                    <div 
                        className={`tab-item ${activeTab === 'Custom Date' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Custom Date')}
                    >
                        Custom Date
                    </div>
                </div>
                <div className="tabs-right">
                    <div className="search-bar">
                        <Search className="icon" size={16} color="#9CA3AF" />
                        <input type="text" placeholder="Search" />
                    </div>
                </div>
            </div>

            {appointments.length === 0 ? (
                <div className="empty-state">
                    {/* SVG representation of the empty state illustration in Zoho */}
                    <svg className="empty-illustration" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="100" cy="80" r="50" fill="#F3F0FF"/>
                        <rect x="70" y="50" width="60" height="60" rx="6" fill="white" stroke="#E5E7EB" strokeWidth="2"/>
                        <path d="M70 65H130" stroke="#E5E7EB" strokeWidth="2"/>
                        <circle cx="85" cy="45" r="4" fill="#6B7280"/>
                        <circle cx="115" cy="45" r="4" fill="#6B7280"/>
                        <rect x="80" y="75" width="12" height="12" fill="#F3F4F6"/>
                        <rect x="95" y="75" width="12" height="12" fill="#F3F4F6"/>
                        <rect x="110" y="75" width="12" height="12" fill="#F3F4F6"/>
                        <rect x="80" y="90" width="12" height="12" fill="#F3F4F6"/>
                        <text x="101" y="85" fontSize="10" fill="#EF4444" fontWeight="bold">x</text>
                        <rect x="110" y="90" width="12" height="12" rx="2" fill="#5C44B5"/>
                        <text x="113" y="100" fontSize="10" fill="white" fontWeight="bold">?</text>
                        {/* decorative dots */}
                        <circle cx="45" cy="70" r="2" fill="#FCA5A5"/>
                        <circle cx="150" cy="40" r="2" fill="#FCA5A5"/>
                        <path d="M150 80L155 85M155 80L150 85" stroke="#FCA5A5" strokeWidth="1.5"/>
                    </svg>
                    
                    <h3>No upcoming appointments</h3>
                    <p>Organize your schedule by adding appointments here.</p>
                    
                    <Button variant="primary">
                        <Plus size={16} /> New Appointment
                    </Button>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <Table columns={[]} data={appointments} />
                </div>
            )}
        </div>
    );
};

export default Appointments;
