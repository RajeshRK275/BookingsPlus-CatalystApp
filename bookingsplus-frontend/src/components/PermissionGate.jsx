import { usePermissions } from '../contexts/PermissionContext';

/**
 * PermissionGate — Renders children only if the user has the required permission.
 * 
 * Usage:
 *   <PermissionGate permission="services.create">
 *       <Button>New Service</Button>
 *   </PermissionGate>
 * 
 *   <PermissionGate anyOf={['services.create', 'services.update']}>
 *       <Button>Manage Service</Button>
 *   </PermissionGate>
 */
const PermissionGate = ({ permission, anyOf, allOf, children, fallback = null }) => {
    const { hasPermission, hasAnyPermission, hasAllPermissions } = usePermissions();

    let allowed = false;

    if (permission) {
        allowed = hasPermission(permission);
    } else if (anyOf) {
        allowed = hasAnyPermission(anyOf);
    } else if (allOf) {
        allowed = hasAllPermissions(allOf);
    } else {
        allowed = true; // No permission specified = always show
    }

    return allowed ? children : fallback;
};

export default PermissionGate;
