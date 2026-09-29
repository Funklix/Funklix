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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeWorkspaceRole(role) {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return WORKSPACE_ROLES.includes(normalized) ? normalized : null;
}

function evaluateWorkspacePermission({ identity, workspaceExists = true, membership, minimumRole = 'viewer' } = {}) {
  const identityId = typeof identity === 'string' ? identity : identity?.identityId;
  if (!identityId) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.UNAUTHENTICATED };
  if (!UUID.test(identityId) || identity?.status === 'disabled') return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.UNAUTHENTICATED };
  if (!workspaceExists) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.WORKSPACE_NOT_FOUND };
  if (!membership) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.MEMBERSHIP_MISSING };
  if (membership.identity_id !== identityId) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.MEMBERSHIP_MISSING };
  if (membership.status !== 'accepted') return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.MEMBERSHIP_INACTIVE };
  const role = normalizeWorkspaceRole(membership.role);
  const required = normalizeWorkspaceRole(minimumRole);
  if (!role || !required) return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.INVALID_ROLE };
  if (WORKSPACE_ROLE_RANK[role] < WORKSPACE_ROLE_RANK[required]) {
    return { allowed: false, category: WORKSPACE_AUTHORIZATION_ERRORS.INSUFFICIENT_ROLE, role };
  }
  return { allowed: true, category: null, role };
}

function protectsLastOwner({ membership, nextMembership = null, acceptedOwnerCount } = {}) {
  if (!membership || membership.role !== 'owner' || membership.status !== 'accepted') return false;
  const stillAcceptedOwner = nextMembership && nextMembership.role === 'owner'
    && nextMembership.status === 'accepted' && nextMembership.workspace_id === membership.workspace_id;
  return !stillAcceptedOwner && acceptedOwnerCount <= 1;
}

module.exports = {
  WORKSPACE_ROLES,
  WORKSPACE_AUTHORIZATION_ERRORS,
  normalizeWorkspaceRole,
  evaluateWorkspacePermission,
  protectsLastOwner
};
