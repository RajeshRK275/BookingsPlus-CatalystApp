import React, { useEffect, useRef, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Waits for the Catalyst Web SDK (`window.catalyst`) to be ready.
 */
const waitForCatalystSDK = (timeoutMs = 10000) => {
    return new Promise((resolve, reject) => {
        if (window.catalyst && window.catalyst.auth) {
            return resolve(window.catalyst);
        }
        const start = Date.now();
        const check = setInterval(() => {
            if (window.catalyst && window.catalyst.auth) {
                clearInterval(check);
                resolve(window.catalyst);
            } else if (Date.now() - start > timeoutMs) {
                clearInterval(check);
                reject(new Error('Catalyst SDK failed to load within timeout'));
            }
        }, 150);
    });
};

// Signup uses the same Catalyst embedded widget as Login.
// When "Public Signup" is enabled in the Catalyst Console, the widget shows
// a "Sign Up" tab/link automatically — no separate API call needed.
const Signup = () => {
    const { isAuthenticated, loading, refreshUser } = useAuth();
    const containerRef = useRef(null);
    const widgetMounted = useRef(false);
    const pollRef = useRef(null);

    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(async () => {
            try {
                await refreshUser();
            } catch {
                // Not yet authenticated — expected
            }
        }, 2500);
    }, [refreshUser]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (loading || isAuthenticated) return;

        let cancelled = false;

        const mountWidget = async () => {
            try {
                const catalystSDK = await waitForCatalystSDK();
                if (cancelled || !containerRef.current) return;

                if (widgetMounted.current) return;

                // Clear any previous content
                containerRef.current.innerHTML = '';

                // Mount the Catalyst embedded sign-in/sign-up widget
                catalystSDK.auth.signIn('catalyst-signup-container');
                widgetMounted.current = true;

                startPolling();
            } catch (err) {
                console.error('Failed to mount Catalyst Auth widget:', err);
            }
        };

        mountWidget();

        return () => {
            cancelled = true;
            stopPolling();
        };
    }, [loading, isAuthenticated, startPolling, stopPolling]);

    // Stop polling as soon as the user becomes authenticated
    useEffect(() => {
        if (isAuthenticated) stopPolling();
    }, [isAuthenticated, stopPolling]);

    // Reset widgetMounted on unmount
    useEffect(() => {
        return () => { widgetMounted.current = false; };
    }, []);

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

                {/* Catalyst embedded sign-in/sign-up widget target */}
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
