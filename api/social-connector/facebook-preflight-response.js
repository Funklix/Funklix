'use strict';

const approval = require('../../approval-material-contract');
const authoritative = require('../_authoritative-response');

const TEXT_LIMIT = 63206;
const LABEL_LIMIT = 256;
const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bounded(value, limit, nullable = false) {
  if (nullable && value === null) return null;
  return typeof value === 'string' && value.length <= limit && !value.includes('\0') ? value : undefined;
}

function project(result, context) {
  const caption = bounded(result?.caption, TEXT_LIMIT);
  const link = bounded(result?.link, 2048, true);
  const profileDisplayName = bounded(result?.profileDisplayName, LABEL_LIMIT);
  const destinationId = bounded(result?.destination?.id, 128);
  const destinationType = bounded(result?.destination?.type, 32);
  const destinationLabel = bounded(result?.destination?.label, LABEL_LIMIT);
  const fingerprint = bounded(result?.approvedFingerprint, 80);
  const readiness = bounded(result?.readiness, 32);
  const editorialStatus = bounded(result?.editorialStatus, 32);
  const confirmationToken = bounded(context?.confirmationToken, 4096);
  const clientRequestId = bounded(context?.clientRequestId, 128);
  const serverRequestId = bounded(context?.serverRequestId, 128);
  const count = result?.characterCount;
  if (result?.ok !== true || result?.status !== 'ready' || caption === undefined || link === undefined ||
      profileDisplayName === undefined || !UUID.test(destinationId || '') || destinationType !== 'page' ||
      destinationLabel === undefined || !approval.isFingerprint(fingerprint) || readiness === undefined ||
      editorialStatus !== 'Approved' || result?.confirmationRequired !== true || confirmationToken === undefined ||
      !REF.test(clientRequestId || '') || !authoritative.requestId(serverRequestId) ||
      !Number.isSafeInteger(count) || count < 0 || count !== [...caption].length) {
    const error = new TypeError('facebook_preflight_response_projection_invalid');
    error.code = 'response_projection_invalid';
    throw error;
  }
  return {
    ok: true, status: 'ready', classification: 'ready', caption, link, characterCount: count,
    profileDisplayName, destination: { id: destinationId, type: destinationType, label: destinationLabel },
    approvedFingerprint: fingerprint, readiness, editorialStatus, confirmationRequired: true,
    confirmationToken, clientRequestId, serverRequestId
  };
}

module.exports = { project };
