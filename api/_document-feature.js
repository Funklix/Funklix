"use strict";

const DOCUMENT_IMPORT_DISABLED_ERROR = Object.freeze({
  code: "DOCUMENT_IMPORT_DISABLED",
  message: "Document import is no longer available."
});

function documentImportDisabled(res) {
  return res.status(410).json({ error: DOCUMENT_IMPORT_DISABLED_ERROR });
}

module.exports = { DOCUMENT_IMPORT_DISABLED_ERROR, documentImportDisabled };
