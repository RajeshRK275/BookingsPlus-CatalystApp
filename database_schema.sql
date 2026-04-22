-- ══════════════════════════════════════════════════════════════════
-- BookingsPlus Enterprise Schema
-- Per-Customer Catalyst Deployment with Multi-Workspace Support
-- Catalyst Auth (Embedded) + Admin-Driven Role Sync
-- ══════════════════════════════════════════════════════════════════

-- Organization: Exactly 1 row per deployment — the customer entity
CREATE TABLE Organization (
    organization_id     BIGINT PRIMARY KEY,
    org_name            VARCHAR(255),
    org_slug            VARCHAR(100),
    timezone            VARCHAR(100),
    currency            VARCHAR(10),
    subscription_plan   VARCHAR(50),
    owner_user_id       BIGINT,
    logo_url            VARCHAR(500),
    brand_color         VARCHAR(20),
    status              VARCHAR(20),
    setup_completed     VARCHAR(10),
    created_at          DATETIME,
    ROWID               BIGINT
);

-- Workspaces: Multiple per deployment (divisions/branches/departments)
CREATE TABLE Workspaces (
    workspace_id        BIGINT PRIMARY KEY,
    workspace_name      VARCHAR(255),
    workspace_slug      VARCHAR(100),
    description         VARCHAR(1000),
    logo_url            VARCHAR(500),
    brand_color         VARCHAR(20),
    timezone            VARCHAR(100),
    currency            VARCHAR(10),
    status              VARCHAR(20),
    created_by          BIGINT,
    created_at          DATETIME,
    ROWID               BIGINT
);

-- Users: Identity layer — workspace membership via UserWorkspaces
CREATE TABLE Users (
    user_id             BIGINT PRIMARY KEY,
    catalyst_user_id    VARCHAR(100),
    catalyst_role_id    VARCHAR(100),
    name                VARCHAR(255),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    avatar_url          VARCHAR(500),
    designation         VARCHAR(255),
    gender              VARCHAR(20),
    dob                 VARCHAR(50),
    color               VARCHAR(20),
    initials            VARCHAR(5),
    is_super_admin      VARCHAR(10),
    role_version        BIGINT,
    status              VARCHAR(20),
    created_at          DATETIME,
    ROWID               BIGINT
);

-- UserWorkspaces: M:N pivot — user can belong to many workspaces with different roles
CREATE TABLE UserWorkspaces (
    user_workspace_id   BIGINT PRIMARY KEY,
    user_id             BIGINT,
    workspace_id        BIGINT,
    role_id             BIGINT,
    status              VARCHAR(20),
    joined_at           DATETIME,
    ROWID               BIGINT
);

-- Permissions: Granular permission definitions — seeded on setup
CREATE TABLE Permissions (
    permission_id       BIGINT PRIMARY KEY,
    permission_key      VARCHAR(100),
    resource            VARCHAR(50),
    action              VARCHAR(50),
    description         VARCHAR(255),
    ROWID               BIGINT
);

-- Roles: Workspace-scoped — each workspace defines its own roles
CREATE TABLE Roles (
    role_id             BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    role_name           VARCHAR(100),
    role_level          INT,
    is_system           VARCHAR(10),
    description         VARCHAR(255),
    ROWID               BIGINT
);

-- RolePermissions: M:N — which permissions does a role grant?
CREATE TABLE RolePermissions (
    role_perm_id        BIGINT PRIMARY KEY,
    role_id             BIGINT,
    permission_id       BIGINT,
    ROWID               BIGINT
);

-- UserRoleMapping: Admin-driven Catalyst role sync (source of truth)
CREATE TABLE UserRoleMapping (
    mapping_id          BIGINT PRIMARY KEY,
    user_email          VARCHAR(255),
    catalyst_user_id    VARCHAR(100),
    catalyst_role_id    VARCHAR(100),
    subscription_type   VARCHAR(50),
    assigned_by         VARCHAR(255),
    role_version        BIGINT,
    updated_at          DATETIME,
    ROWID               BIGINT
);

-- Services: Workspace-scoped
CREATE TABLE Services (
    service_id          BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    name                VARCHAR(255),
    description         VARCHAR(1000),
    duration_minutes    INT,
    price               DECIMAL,
    service_type        VARCHAR(50),
    meeting_mode        VARCHAR(50),
    meeting_location    VARCHAR(255),
    seats               INT,
    status              VARCHAR(20),
    ROWID               BIGINT
);

-- Staff: Workspace-scoped
CREATE TABLE Staff (
    staff_id            BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    user_id             BIGINT,
    working_hours_profile_id BIGINT,
    service_ids         VARCHAR(1000),
    ROWID               BIGINT
);

-- Availability: Workspace-scoped
CREATE TABLE Availability (
    availability_id     BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    staff_id            BIGINT,
    day_of_week         INT,
    start_time          TIME,
    end_time            TIME,
    ROWID               BIGINT
);

-- Customers: Workspace-scoped
CREATE TABLE Customers (
    customer_id         BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    name                VARCHAR(255),
    email               VARCHAR(255),
    phone               VARCHAR(50),
    notes               VARCHAR(2000),
    ROWID               BIGINT
);

-- Appointments: Workspace-scoped
CREATE TABLE Appointments (
    appointment_id      BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    service_id          BIGINT,
    staff_id            BIGINT,
    customer_id         BIGINT,
    service_name        VARCHAR(255),
    staff_name          VARCHAR(255),
    customer_name       VARCHAR(255),
    appointment_status  VARCHAR(50),
    approval_status     VARCHAR(50),
    payment_status      VARCHAR(50),
    start_time          DATETIME,
    end_time            DATETIME,
    notes               VARCHAR(2000),
    ROWID               BIGINT
);

-- Appointment_Approvals: Workspace-scoped
CREATE TABLE Appointment_Approvals (
    approval_id         BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    appointment_id      BIGINT,
    approver_role       VARCHAR(100),
    approver_user_id    BIGINT,
    approval_status     VARCHAR(50),
    comments            VARCHAR(2000),
    approved_at         DATETIME,
    ROWID               BIGINT
);

-- Integrations: Workspace-scoped
CREATE TABLE Integrations (
    integration_id      BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    integration_type    VARCHAR(100),
    config_json         VARCHAR(4000),
    status              VARCHAR(50),
    ROWID               BIGINT
);

-- ServiceStaff: Workspace-scoped
CREATE TABLE ServiceStaff (
    service_id          BIGINT,
    staff_id            BIGINT,
    workspace_id        BIGINT,
    ROWID               BIGINT
);

-- AuditLog: Tracks all actions across all workspaces
CREATE TABLE AuditLog (
    log_id              BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    user_id             BIGINT,
    action              VARCHAR(100),
    resource_type       VARCHAR(50),
    resource_id         VARCHAR(100),
    details_json        VARCHAR(4000),
    ip_address          VARCHAR(50),
    created_at          DATETIME,
    ROWID               BIGINT
);

-- WorkspaceSettings: Per-workspace configuration key-value store
CREATE TABLE WorkspaceSettings (
    setting_id          BIGINT PRIMARY KEY,
    workspace_id        BIGINT,
    setting_key         VARCHAR(100),
    setting_value       VARCHAR(4000),
    ROWID               BIGINT
);
