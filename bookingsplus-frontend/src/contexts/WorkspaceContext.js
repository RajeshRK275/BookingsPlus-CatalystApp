import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { workspacesApi } from '../services';
import { STORAGE_KEYS } from '../constants';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
    const { isAuthenticated, loading: authLoading, needsOnboarding, setupCompleted } = useAuth();
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [userWorkspaces, setUserWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch user's workspaces
    const fetchWorkspaces = useCallback(async () => {
        if (!isAuthenticated || authLoading) return [];
        try {
            console.log('[WorkspaceContext] Fetching workspaces from API...');
            const res = await workspacesApi.getMyWorkspaces();
            if (res.data?.success) {
                const workspaces = res.data.data || [];
                console.log('[WorkspaceContext] Fetched workspaces:', workspaces.length);
                setUserWorkspaces(workspaces);
                return workspaces;
            }
        } catch (err) {
            console.error('[WorkspaceContext] Error fetching workspaces:', err);
        }
        return [];
    }, [isAuthenticated, authLoading]);

    useEffect(() => {
        const init = async () => {
            // CRITICAL: If auth is still loading, keep workspace loading=true
            // so downstream guards (RootRedirect, WorkspaceGuard) don't render
            // with incomplete state and flash wrong screens.
            if (authLoading) {
                return; // Don't set loading=false — stay in loading state
            }

            // Auth finished but user is not authenticated — nothing to load
            if (!isAuthenticated) {
                setLoading(false);
                return;
            }

            // If onboarding is needed (no org exists), skip workspace fetch entirely.
            // The Workspaces table is empty/missing — no point querying it.
            // Set loading=false immediately so guards can redirect to /setup.
            if (needsOnboarding) {
                console.log('[WorkspaceContext] needsOnboarding=true, skipping workspace fetch');
                setUserWorkspaces([]);
                setActiveWorkspace(null);
                setLoading(false);
                return;
            }

            setLoading(true);
            const workspaces = await fetchWorkspaces();

            if (workspaces.length > 0) {
                // Restore last active workspace from localStorage
                const storedWsId = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE);
                const storedWs = storedWsId
                    ? workspaces.find(ws => String(ws.workspace_id) === storedWsId)
                    : null;
                const defaultWs = storedWs || workspaces[0];
                setActiveWorkspace(defaultWs);
                // Store in localStorage — the API interceptor reads this for X-Workspace-Id header
                localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(defaultWs.workspace_id));
                console.log('[WorkspaceContext] Active workspace set:', defaultWs.workspace_name, '| ID:', defaultWs.workspace_id);
            } else {
                console.log('[WorkspaceContext] No workspaces found after fetch');
            }
            setLoading(false);
        };
        init();
    }, [isAuthenticated, authLoading, needsOnboarding, fetchWorkspaces]);

    // ── Also re-fetch when setupCompleted changes from false→true ──
    // This handles the transition after onboarding completes:
    // 1. User starts onboarding (needsOnboarding=true → skipped workspace fetch)
    // 2. User completes org setup → markSetupComplete() → setupCompleted=true
    // 3. This effect triggers → fetches workspaces for the first time
    // 4. activeWorkspace gets populated → API calls now have X-Workspace-Id header
    useEffect(() => {
        if (setupCompleted && isAuthenticated && !authLoading && !needsOnboarding && userWorkspaces.length === 0) {
            console.log('[WorkspaceContext] setupCompleted changed to true, fetching workspaces...');
            const refetch = async () => {
                const workspaces = await fetchWorkspaces();
                if (workspaces.length > 0) {
                    const storedWsId = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE);
                    const storedWs = storedWsId
                        ? workspaces.find(ws => String(ws.workspace_id) === storedWsId)
                        : null;
                    const defaultWs = storedWs || workspaces[0];
                    setActiveWorkspace(defaultWs);
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(defaultWs.workspace_id));
                    console.log('[WorkspaceContext] Post-setup workspace set:', defaultWs.workspace_name, '| ID:', defaultWs.workspace_id);
                }
            };
            refetch();
        }
    }, [setupCompleted, isAuthenticated, authLoading, needsOnboarding, userWorkspaces.length, fetchWorkspaces]);

    const switchWorkspace = useCallback((workspaceId) => {
        const ws = userWorkspaces.find(w => String(w.workspace_id) === String(workspaceId));
        if (ws) {
            setActiveWorkspace(ws);
            localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(ws.workspace_id));
        }
    }, [userWorkspaces]);

    const refreshWorkspaces = useCallback(async () => {
        const workspaces = await fetchWorkspaces();
        if (workspaces.length > 0) {
            if (activeWorkspace) {
                // If we had an active workspace, verify it still exists
                const stillExists = workspaces.find(w => String(w.workspace_id) === String(activeWorkspace.workspace_id));
                if (!stillExists) {
                    const defaultWs = workspaces[0];
                    setActiveWorkspace(defaultWs);
                    localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(defaultWs.workspace_id));
                }
            } else {
                // No active workspace yet (first setup / onboarding) — auto-select one
                const storedWsId = localStorage.getItem(STORAGE_KEYS.ACTIVE_WORKSPACE);
                const storedWs = storedWsId
                    ? workspaces.find(ws => String(ws.workspace_id) === storedWsId)
                    : null;
                const defaultWs = storedWs || workspaces[0];
                setActiveWorkspace(defaultWs);
                localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(defaultWs.workspace_id));
                console.log('[WorkspaceContext] refreshWorkspaces — set active:', defaultWs.workspace_name, '| ID:', defaultWs.workspace_id);
            }
        }
        return workspaces;
    }, [fetchWorkspaces, activeWorkspace]);

    return (
        <WorkspaceContext.Provider value={{
            activeWorkspace,
            userWorkspaces,
            switchWorkspace,
            refreshWorkspaces,
            loading,
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
};

export const useWorkspace = () => useContext(WorkspaceContext);
