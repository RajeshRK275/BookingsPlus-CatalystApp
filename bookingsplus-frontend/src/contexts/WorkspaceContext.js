import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { workspacesApi } from '../services';
import { STORAGE_KEYS } from '../constants';

const WorkspaceContext = createContext(null);

export const WorkspaceProvider = ({ children }) => {
    const { isAuthenticated, loading: authLoading } = useAuth();
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [userWorkspaces, setUserWorkspaces] = useState([]);
    const [loading, setLoading] = useState(true);

    // Fetch user's workspaces
    const fetchWorkspaces = useCallback(async () => {
        if (!isAuthenticated || authLoading) return;
        try {
            const res = await workspacesApi.getMyWorkspaces();
            if (res.data?.success) {
                setUserWorkspaces(res.data.data || []);
                return res.data.data || [];
            }
        } catch (err) {
            console.error('Error fetching workspaces:', err);
        }
        return [];
    }, [isAuthenticated, authLoading]);

    useEffect(() => {
        const init = async () => {
            if (!isAuthenticated || authLoading) {
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
                // Set axios default header
                axios.defaults.headers.common['X-Workspace-Id'] = defaultWs.workspace_id;
            }
            setLoading(false);
        };
        init();
    }, [isAuthenticated, authLoading, fetchWorkspaces]);

    const switchWorkspace = useCallback((workspaceId) => {
        const ws = userWorkspaces.find(w => String(w.workspace_id) === String(workspaceId));
        if (ws) {
            setActiveWorkspace(ws);
            axios.defaults.headers.common['X-Workspace-Id'] = ws.workspace_id;
            localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, String(ws.workspace_id));
        }
    }, [userWorkspaces]);

    const refreshWorkspaces = useCallback(async () => {
        const workspaces = await fetchWorkspaces();
        if (activeWorkspace) {
            const stillExists = workspaces.find(w => String(w.workspace_id) === String(activeWorkspace.workspace_id));
            if (!stillExists && workspaces.length > 0) {
                switchWorkspace(workspaces[0].workspace_id);
            }
        }
    }, [fetchWorkspaces, activeWorkspace, switchWorkspace]);

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
