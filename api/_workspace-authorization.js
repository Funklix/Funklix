const WORKSPACE_ROLES = Object.freeze(['owner', 'admin', 'member', 'viewer']);
const WORKSPACE_ROLE_RANK = Object.freeze({ viewer: 1, member: 2, admin: 3, owner: 4 });
const WORKSPACE_AUTHORIZATION_ERRORS = Object.freeze({
  UNAUTHENTICATED: 'unauthenticated',
  WORKSPACE_NOT_FOUND: 'workspace_not_found',
  MEMBERSHIP_MISSING: 'membership_missing',
  MEMBERSHIP_INACTIVE: 'membership_inactive',
  INSUFFICIENT_ROLE: 'insufficient_workspace_role',
  LAST_OWNER_PROTECTED: 'last_owner_protected',
  INVALID_ROLE: 'invalid_role',
  CONFLICT: 'conflict',
  STORAGE_FAILURE: 'storage_failure'
});

function normalizeWorkspaceRole(role) {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return WORKSPACE_ROLES.includes(normalized) ? normalized : null;
}

function evaluateWorkspacePermission({ identity, workspaceExists = true, membership, minimumRole = 'viewer' } = {}) {
  if (!identity) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.UNAUTHENTICATED };
  if (!workspaceExists) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.WORKSPACE_NOT_FOUND };
  if (!membership) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.MEMBERSHIP_MISSING };
  if (membership.status !== 'accepted') return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.MEMBERSHIP_INACTIVE };
  const role = normalizeWorkspaceRole(membership.role);
  const required = normalizeWorkspaceRole(minimumRole);
  if (!role || !required) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.INVALID_ROLE };
  if (WORKSPACE_ROLE_RANK[role] < WORKSPACE_ROLE_RANK[required]) {
    return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.INSUFFICIENT_ROLE, role };
  }
  return { allowed: true, category: null, role };
}

module.exports = {
  WORKSPACE_ROLES,
  WORKSPACE_AUTHORIZATION_ERRORS,
  normalizeWorkspaceRole,
  evaluateWorkspacePermission
};
