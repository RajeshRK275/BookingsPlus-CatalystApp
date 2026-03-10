-- Zoho Catalyst Datastore Schema Definition for BookingsPlus
-- Note: Catalyst Data Store tables should ideally be created via Catalyst Console, but here are the definitions to guide the setup.

CREATE TABLE Organizations (
    organization_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100), -- Used for strict partition/isolation
    org_name VARCHAR(255),
    timezone VARCHAR(100),
    currency VARCHAR(10),
    subscription_plan VARCHAR(50),
    owner_user_id BIGINT,
    status VARCHAR(20),
    ROWID BIGINT -- Native Catalyst RowID
);

CREATE TABLE Users (
    user_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    organization_id BIGINT,
    name VARCHAR(255),
    email VARCHAR(255),
    password_hash VARCHAR(255),
    role_id BIGINT,
    department_id BIGINT,
    status VARCHAR(20),
    ROWID BIGINT
);

CREATE TABLE Roles (
    role_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    role_name VARCHAR(100),
    role_level INT,
    description VARCHAR(255),
    ROWID BIGINT
);

CREATE TABLE Services (
    service_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    organization_id BIGINT,
    name VARCHAR(255),
    description VARCHAR(1000),
    duration_minutes INT,
    price DECIMAL,
    status VARCHAR(20),
    ROWID BIGINT
);

CREATE TABLE Staff (
    staff_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    organization_id BIGINT,
    user_id BIGINT,
    working_hours_profile_id BIGINT,
    service_ids VARCHAR(1000), -- JSON Stringified Array
    ROWID BIGINT
);

CREATE TABLE Availability (
    availability_id BIGINT PRIMARY KEY,
    staff_id BIGINT,
    day_of_week INT,
    start_time TIME,
    end_time TIME,
    ROWID BIGINT
);

CREATE TABLE Customers (
    customer_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    organization_id BIGINT,
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    notes VARCHAR(2000),
    ROWID BIGINT
);

CREATE TABLE Appointments (
    appointment_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    organization_id BIGINT,
    service_id BIGINT,
    staff_id BIGINT,
    customer_id BIGINT,
    appointment_status VARCHAR(50), -- pending, completed, cancelled
    approval_status VARCHAR(50),    -- awaiting_approval, approved, rejected
    payment_status VARCHAR(50),
    start_time DATETIME,
    end_time DATETIME,
    notes VARCHAR(2000),
    ROWID BIGINT
);

CREATE TABLE Appointment_Approvals (
    approval_id BIGINT PRIMARY KEY,
    appointment_id BIGINT,
    approver_role VARCHAR(100),
    approver_user_id BIGINT,
    approval_status VARCHAR(50),
    comments VARCHAR(2000),
    approved_at DATETIME,
    ROWID BIGINT
);

CREATE TABLE Integrations (
    integration_id BIGINT PRIMARY KEY,
    tenant_id VARCHAR(100),
    integration_type VARCHAR(100),
    config_json VARCHAR(4000),
    status VARCHAR(50),
    ROWID BIGINT
);
