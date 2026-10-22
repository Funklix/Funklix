module.exports = require('../../_document-processing-route').handler('run');

// Preserve the handler's authentication and authorization before guarding database writes.
module.exports = require('../../_write-maintenance').withMaintenanceResponse(module.exports);
