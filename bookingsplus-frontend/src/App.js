import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import Appointments from './pages/Appointments';

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
            <AuthProvider>
                <Router basename="/app">
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        
                        <Route element={<MainLayout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/appointments" element={<Appointments />} />
                            <Route path="/services" element={<Services />} />
                            <Route path="/staff" element={<div>Staff Page Placeholder</div>} />
                            <Route path="/customers" element={<div>Customers Page Placeholder</div>} />
                        </Route>
                    </Routes>
                </Router>
            </AuthProvider>
        </QueryClientProvider>
    );
}

export default App;
