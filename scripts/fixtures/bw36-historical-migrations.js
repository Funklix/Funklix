'use strict';
// Frozen from main a1f72e6. Later migrations do not authorize rewriting deployed SQL.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const frozen={
  "migrations/20260911_bw33_5_supabase_rls_hardening.rollback.sql": "2016039b0ff5cd759639dceef818352ac2402140d3b4a7b74e397f4a22e50819",
  "migrations/20260911_bw33_5_supabase_rls_hardening.sql": "7ceb2d22647d1c5bc0526ff9f1d72698d5f37086c573c4d2db763e44af561b27",
  "migrations/20260914_bw33_5_1_social_publishing_destinations_rls.rollback.sql": "79e84bf7c3cd5a47fd711d409ddae3690b227c35fee721250bda58813576f4f8",
  "migrations/20260914_bw33_5_1_social_publishing_destinations_rls.sql": "cdac20118495ea9f5d1b2acbed2be80aeef899b8169a3d8dec3a8b5123ffb773",
  "migrations/20260914_bw33_5_1_social_publishing_destinations_rls.verify.sql": "05a7c679f15d1a74c0b5a624c9c5f3f3b75794a561a20edfdcebaef9f7486497",
  "migrations/20260928_bw36_6_workspace_schema_foundation.sql": "d7832add0dd280a05a420fad42c90b81929dae5e72eae9ccc5a7377b1d49a35c",
  "migrations/20260929_bw36_7r2_application_identity_bridge.sql": "cbe66bcd7a69f01c2755aac159df86dfba8dd86b70347e6504e9b418d0489557",
  "migrations/20260929_bw36_8_transactional_workspace_backfill.sql": "c59e5b48d68361c4284301805a475635e8b77f612e5aa911c90131e3a6bf39c8",
  "migrations/20261001_bw36_12_brand_logo.sql": "3af072177ec35291dea018f46058d3c4f73a33ff147f129b759b71e3927dcc2d",
  "migrations/20261006_bw36_13r3_project_commands.sql": "ced05ccc20cfc248de10401473a777e7185bf7cd2e378c8f6ebae7e5b1e03f43",
  "migrations/20261011_bw36_17_governed_brand_learnings.sql": "cbb8998793444a128118aff57e47618fb02005bd6fec072ccf42f67592d00bee",
  "migrations/20261011_bw36_17r1_learning_provenance_schema.sql": "749615765bfac9f34314d72a171f10c3aa2cd730e7192c223ceb8af7a3fa037f",
  "migrations/20261012_bw36_17r2_learning_provenance_recovery.sql": "57010ac2abd5df09a7d69c4e46374da7506691c290e2a2628a68de1e7dd8eb9d"
};
module.exports=function assertHistoricalMigrations(){for(const [file,digest] of Object.entries(frozen))assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',file))).digest('hex'),digest,'Historical migration changed: '+file);};
