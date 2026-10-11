#!/usr/bin/env node
'use strict';
// Run refinement contracts against the shared, real-production Canvas fixture.
require('./check-bw36-16-adaptive-canvas-view-hierarchy').check({ refinement: true })
  .catch(error => { console.error(error); process.exitCode = 1; });
