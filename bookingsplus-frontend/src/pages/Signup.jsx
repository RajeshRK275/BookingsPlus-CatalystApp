import React, { useEffect, useRef } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Signup uses the same Catalyst embedded widget as Login.
// When "Public Signup" is enabled in the Catalyst Console, the widget shows
// a "Sign Up" tab/link automatically — no separate API call needed.
const Signup = () => {
    const { isAuthenticated, loading, refreshUser } = useAuth();
    const containerRef = useRef(null);
    const mounted = useRef(false);

    useEffect(() => {
        if (loading || isAuthenticated || mounted.current) return;

        const tryMount = () => {
            if (window.catalyst && window.catalyst.auth && containerRef.current) {
                window.catalyst.auth.signIn('catalyst-signup-container');
                mounted.current = true;

                // Poll /me after sign-up so React state updates without a hard reload
                const interval = setInterval(async () => {
                    try {
                        await refreshUser();
                    } catch {
                        // not yet authenticated
                    }
                }, 2000);

                return () => clearInterval(interval);
            }
        };

        const timeout = setTimeout(tryMount, 300);
        return () => clearTimeout(timeout);
    }, [loading, isAuthenticated, refreshUser]);

    if (!loading && isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                {/* Branding */}
                <div style={styles.brand}>
                    <div style={styles.logo}>B+</div>
                    <h1 style={styles.appName}>BookingsPlus</h1>
                    <p style={styles.tagline}>Create your free workspace</p>
                </div>

                {/* Catalyst embedded iFrame target */}
                <div id="catalyst-signup-container" style={styles.widgetContainer} ref={containerRef} />

                {/* Footer link */}
                <p style={styles.footer}>
                    Already have an account?{' '}
                    <Link to="/login" style={styles.link}>Sign in</Link>
                </p>
            </div>
        </div>
    );
};

const styles = {
    page: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
    },
    card: {
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
        padding: '40px',
        width: '100%',
        maxWidth: '460px',
    },
    brand: {
        textAlign: 'center',
        marginBottom: '28px',
    },
    logo: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '56px',
        height: '56px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #667eea, #764ba2)',
        color: '#fff',
        fontSize: '20px',
        fontWeight: 700,
        marginBottom: '12px',
    },
    appName: {
        margin: '0 0 6px',
        fontSize: '24px',
        fontWeight: 700,
        color: '#111827',
    },
    tagline: {
        margin: 0,
        fontSize: '14px',
        color: '#6B7280',
    },
    widgetContainer: {
        minHeight: '340px',
        width: '100%',
        borderRadius: '8px',
        overflow: 'hidden',
    },
    footer: {
        textAlign: 'center',
        marginTop: '20px',
        fontSize: '14px',
        color: '#6B7280',
    },
    link: {
        color: '#667eea',
        fontWeight: 600,
        textDecoration: 'none',
    },
};

export default Signup;
