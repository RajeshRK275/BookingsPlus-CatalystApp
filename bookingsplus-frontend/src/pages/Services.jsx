import React, { useState } from 'react';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { Plus } from 'lucide-react';

const mockServices = [
    { id: 1, name: 'Initial Consultation', duration: 30, price: '$0.00', status: 'active' },
    { id: 2, name: 'Deep Cleaning', duration: 60, price: '$150.00', status: 'active' },
    { id: 3, name: 'Follow-up Review', duration: 15, price: '$50.00', status: 'inactive' }
];

const Services = () => {
    const [services] = useState(mockServices);

    const columns = [
        { label: 'Service Name', key: 'name', sortable: true },
        { label: 'Duration (mins)', key: 'duration', sortable: true },
        { label: 'Price', key: 'price' },
        { 
            label: 'Status', 
            key: 'status',
            render: (val) => (
                <span className={`status-badge status-${val}`}>
                    {val.toUpperCase()}
                </span>
            ) 
        }
    ];

    return (
        <div className="page-container">
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 className="page-title">Services</h1>
                    <p className="page-subtitle">Manage your bookable services and pricing.</p>
                </div>
                <Button variant="primary">
                    <Plus size={16} /> New Service
                </Button>
            </div>
            
            <div className="card" style={{ padding: 0 }}>
                <Table columns={columns} data={services} />
            </div>
        </div>
    );
};

export default Services;
