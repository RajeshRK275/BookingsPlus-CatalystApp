import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import PublicBooking from './pages/PublicBooking';
import Appointments from './pages/Appointments';
import Calendar from './pages/Calendar';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';

// Query Client for API caching
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { refetchOnWindowFocus: false, retry: 1 }
    }
});

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <AuthProvider>
                    <Routes>
                        <Route path="/services/:serviceId" element={<ServiceDetail />} />
                        <Route path="/book/:serviceId" element={<PublicBooking />} />

                        <Route element={<MainLayout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/appointments" element={<Appointments />} />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/employees" element={<Employees />} />
                            <Route path="/employees/:employeeId" element={<EmployeeDetail />} />
                            <Route path="/customers" element={<div>Customers Page Placeholder</div>} />
                        </Route>
                    </Routes>
                </AuthProvider>
            </Router>
        </QueryClientProvider>
    );
}

export default App;

