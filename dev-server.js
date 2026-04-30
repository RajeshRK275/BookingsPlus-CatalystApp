/**
 * BookingsPlus Local Development Server
 * 
 * Simulates Catalyst Advanced I/O + Datastore locally.
 * Runs on port 5000, serves the backend under /server/bookingsplus/*
 * The React dev server (port 3000) proxies /server/* to this.
 * 
 * Uses in-memory data store to simulate Catalyst Datastore tables.
 */

// Use the backend's node_modules
const path = require('path');
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
    try {
        return originalResolveFilename.call(this, request, parent, isMain, options);
    } catch (e) {
        // Fallback to the functions directory's node_modules
        const functionsNodeModules = path.join(__dirname, 'functions', 'bookingsplus', 'node_modules');
        const altPath = path.join(functionsNodeModules, request);
        return originalResolveFilename.call(this, altPath, parent, isMain, options);
    }
};

const express = require(path.join(__dirname, 'functions', 'bookingsplus', 'node_modules', 'express'));
const cors = require(path.join(__dirname, 'functions', 'bookingsplus', 'node_modules', 'cors'));

// ── In-Memory Datastore ──
const DB = {
    Organization: [],
    Workspaces: [],
    Users: [],
    UserWorkspaces: [],
    Permissions: [],
    Roles: [],
    RolePermissions: [],
    Services: [],
    Staff: [],
    Availability: [],
    Customers: [],
    Appointments: [],
    Appointment_Approvals: [],
    Integrations: [],
    ServiceStaff: [],
    AuditLog: [],
    WorkspaceSettings: [],
    UserRoleMapping: [],
};

let rowIdCounter = 1000;
const nextRowId = () => String(++rowIdCounter);

/**
 * Mock Catalyst SDK that works with in-memory DB
 */
function createMockCatalystApp() {
    return {
        datastore: () => ({
            table: (tableName) => ({
                insertRow: async (data) => {
                    if (!DB[tableName]) DB[tableName] = [];
                    const row = { ...data, ROWID: nextRowId() };
                    DB[tableName].push(row);
                    return row;
                },
                insertRows: async (rows) => {
                    if (!DB[tableName]) DB[tableName] = [];
                    const inserted = rows.map(data => {
                        const row = { ...data, ROWID: nextRowId() };
                        DB[tableName].push(row);
                        return row;
                    });
                    return inserted;
                },
                updateRow: async (data) => {
                    if (!DB[tableName]) return data;
                    const idx = DB[tableName].findIndex(r => String(r.ROWID) === String(data.ROWID));
                    if (idx >= 0) {
                        DB[tableName][idx] = { ...DB[tableName][idx], ...data };
                        return DB[tableName][idx];
                    }
                    return data;
                },
                deleteRow: async (rowId) => {
                    if (!DB[tableName]) return;
                    DB[tableName] = DB[tableName].filter(r => String(r.ROWID) !== String(rowId));
                },
            }),
        }),
        zcql: () => ({
            executeZCQLQuery: async (query) => {
                return executeLocalZCQL(query);
            },
        }),
        userManagement: () => ({
            getCurrentUser: async () => {
                return {
                    user_id: 'dev-catalyst-user-1',
                    email_id: 'admin@bookingsplus.dev',
                    first_name: 'Admin',
                    last_name: 'User',
                    role_id: '1',
                    status: 'ACTIVE',
                };
            },
            registerUser: async (signupConfig, userConfig) => {
                return {
                    user_id: 'catalyst-user-' + Date.now(),
                    email_id: userConfig.email_id,
                    first_name: userConfig.first_name,
                    last_name: userConfig.last_name,
                };
            },
            updateUser: async (userId, data) => {
                return { user_id: userId, ...data };
            },
        }),
    };
}

/**
 * Minimal ZCQL parser for local development.
 * Supports: SELECT, INSERT, UPDATE, DELETE with basic WHERE, JOIN, LIMIT, ORDER BY
 */
function executeLocalZCQL(query) {
    query = query.trim();
    
    // SELECT queries
    if (query.toUpperCase().startsWith('SELECT')) {
        return handleSelect(query);
    }
    
    return [];
}

function handleSelect(query) {
    const upperQuery = query.toUpperCase();
    
    // Extract main table from FROM clause
    const fromMatch = query.match(/FROM\s+(\w+)/i);
    if (!fromMatch) return [];
    const mainTable = fromMatch[1];
    
    if (!DB[mainTable]) return [];
    
    // Handle COUNT — return both 'cnt' and the Catalyst-format keys
    // Catalyst ZCQL returns COUNT(ROWID) as { ROWID: "3" } in some formats
    if (upperQuery.includes('COUNT(')) {
        const whereFiltered = applyWhereClause(DB[mainTable], query, mainTable);
        const count = whereFiltered.length;
        const countColMatch = upperQuery.match(/COUNT\((\w+)\)/i);
        const countCol = countColMatch ? countColMatch[1] : 'ROWID';
        return [{ [mainTable]: { cnt: count, [countCol]: String(count), [`${countCol}.count`]: String(count) } }];
    }
    
    // Check for JOINs
    const joinMatches = [...query.matchAll(/(?:LEFT\s+)?JOIN\s+(\w+)\s+(\w+)\s+ON\s+([^\s]+)\s*=\s*([^\s]+)/gi)];
    
    let results = applyWhereClause(DB[mainTable], query, mainTable);
    
    // Apply LIMIT
    const limitMatch = query.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
        results = results.slice(0, parseInt(limitMatch[1]));
    }
    
    // If there are JOINs, perform them
    if (joinMatches.length > 0) {
        const joinedResults = results.map(row => {
            const result = { [mainTable]: { ...row } };
            
            for (const jm of joinMatches) {
                const joinTable = jm[1];
                const joinAlias = jm[2];
                const leftField = jm[3]; // e.g., uw.role_id
                const rightField = jm[4]; // e.g., r.ROWID
                
                // Parse field references
                const leftVal = resolveFieldValue(row, leftField, mainTable, result);
                
                if (!DB[joinTable]) {
                    result[joinTable] = {};
                    continue;
                }
                
                // Find matching row in joined table
                const rightFieldName = rightField.split('.').pop();
                const matchedRow = DB[joinTable].find(jr => {
                    const jrVal = rightFieldName === 'ROWID' ? jr.ROWID : jr[rightFieldName];
                    return String(jrVal) === String(leftVal);
                });
                
                result[joinTable] = matchedRow ? { ...matchedRow } : {};
            }
            
            return result;
        });
        
        // Apply WHERE clause for joined fields
        return applyJoinedWhereClause(joinedResults, query);
    }
    
    // No joins - wrap in table name
    return results.map(row => ({ [mainTable]: { ...row } }));
}

function resolveFieldValue(row, fieldRef, mainTable, joinedResult) {
    const parts = fieldRef.split('.');
    if (parts.length === 2) {
        const fieldName = parts[1];
        // Check if it's ROWID
        if (fieldName === 'ROWID') return row.ROWID;
        return row[fieldName];
    }
    return row[fieldRef];
}

function applyWhereClause(rows, query, tableName) {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+|\s+LIMIT\s+|\s+GROUP\s+|$)/i);
    if (!whereMatch) return [...rows];
    
    const conditions = whereMatch[1];
    
    return rows.filter(row => {
        return evaluateConditions(row, conditions, tableName);
    });
}

function applyJoinedWhereClause(joinedRows, query) {
    const whereMatch = query.match(/WHERE\s+(.+?)(?:\s+ORDER\s+|\s+LIMIT\s+|\s+GROUP\s+|$)/i);
    if (!whereMatch) return joinedRows;
    
    const conditions = whereMatch[1];
    
    // Split AND conditions
    const andParts = conditions.split(/\s+AND\s+/i);
    
    return joinedRows.filter(joinedRow => {
        return andParts.every(condition => {
            condition = condition.trim();
            
            // Handle table.field = 'value' pattern
            const eqMatch = condition.match(/(\w+)\.(\w+)\s*=\s*'([^']*)'/i) ||
                            condition.match(/(\w+)\s*=\s*'([^']*)'/i);
            
            if (eqMatch) {
                if (eqMatch.length === 4) {
                    // table.field = 'value'
                    const [, alias, field, value] = eqMatch;
                    // Find the table name from the joined row
                    for (const tableName of Object.keys(joinedRow)) {
                        const tableRow = joinedRow[tableName];
                        if (tableRow && (field === 'ROWID' ? String(tableRow.ROWID) === value : String(tableRow[field] || '') === value)) {
                            return true;
                        }
                    }
                    return false;
                } else {
                    // field = 'value'
                    const [, field, value] = eqMatch;
                    for (const tableName of Object.keys(joinedRow)) {
                        const tableRow = joinedRow[tableName];
                        if (tableRow && String(tableRow[field] || '') === value) return true;
                    }
                    return false;
                }
            }
            
            return true;
        });
    });
}

function evaluateConditions(row, conditions, tableName) {
    // Split by AND
    const andParts = conditions.split(/\s+AND\s+/i);
    
    return andParts.every(part => {
        part = part.trim();
        
        // Handle IN clause
        const inMatch = part.match(/(\w+(?:\.\w+)?)\s+IN\s+\(([^)]+)\)/i);
        if (inMatch) {
            const field = inMatch[1].split('.').pop();
            const values = inMatch[2].split(',').map(v => v.trim().replace(/'/g, ''));
            const rowVal = field === 'ROWID' ? row.ROWID : row[field];
            return values.includes(String(rowVal || ''));
        }
        
        // Handle = comparison
        const eqMatch = part.match(/(\w+(?:\.\w+)?)\s*=\s*'([^']*)'/i);
        if (eqMatch) {
            const field = eqMatch[1].split('.').pop();
            const value = eqMatch[2];
            const rowVal = field === 'ROWID' ? row.ROWID : row[field];
            return String(rowVal || '') === value;
        }
        
        return true;
    });
}

// ── Build Express App ──
const app = express();
app.use(cors());
app.use(express.json());

// Inject mock Catalyst SDK into every request
app.use((req, res, next) => {
    req.catalystApp = createMockCatalystApp();
    next();
});

// Force DEV_MODE
process.env.DEV_MODE = 'true';
process.env.ENABLE_AUDIT_LOG = 'true';
process.env.ADMIN_WEBHOOK_SECRET = 'bp-admin-secret-dev';
process.env.INITIAL_SUPER_ADMIN_EMAIL = 'admin@bookingsplus.dev';

// Mount the actual app routes under /server/bookingsplus
const bookingsPlusApp = require('./functions/bookingsplus/index.js');
app.use('/server/bookingsplus', bookingsPlusApp);

// Health check
app.get('/server/health', (req, res) => {
    res.json({ status: 'ok', tables: Object.keys(DB).map(t => `${t}: ${DB[t].length} rows`) });
});

// Debug: View DB state
app.get('/server/debug/db', (req, res) => {
    res.json(DB);
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 BookingsPlus Dev Server running on http://127.0.0.1:${PORT}`);
    console.log(`   Backend API: http://127.0.0.1:${PORT}/server/bookingsplus/api/v1/...`);
    console.log(`   Health Check: http://127.0.0.1:${PORT}/server/health`);
    console.log(`   DB Debug: http://127.0.0.1:${PORT}/server/debug/db`);
    console.log(`   DEV_MODE: true (mock user: admin@bookingsplus.dev)\n`);
});
