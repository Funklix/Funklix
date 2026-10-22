module.exports = require('../_document-route').handler('download');

// Preserve the handler's authentication and authorization before guarding database writes.
module.exports = require('../_write-maintenance').withMaintenanceResponse(module.exports);
