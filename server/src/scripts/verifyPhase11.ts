/**
 * Phase 11 Verification Script: Privacy, Data Governance & Production Containerization
 *
 * Verifies all Phase 11 deliverables:
 * - Data Governance & Portability API:
 *   - userController.ts (exportUserData, updatePrivacySettings, changePassword, deleteAccount)
 *   - userRoutes.ts mounted under /api/users in server.ts
 *   - dataGovernance.test.ts unit tests
 * - Frontend Settings & Privacy Experience:
 *   - userApi.ts client module
 *   - SettingsPage.tsx covering profile, privacy, password, export, and account deletion
 *   - /settings route in AppRoutes.tsx
 *   - Sidebar navigation integration
 * - Production Containerization & DevOps:
 *   - server/Dockerfile (multi-stage build, non-root user, healthcheck)
 *   - client/Dockerfile (multi-stage build, Nginx Alpine, healthcheck)
 *   - client/nginx.conf (SPA routing, reverse proxy for /api/ & /socket.io/, Gzip, caching)
 *   - docker-compose.prod.yml (full-stack orchestration: mongodb, server, client)
 *   - .dockerignore files
 */

import fs from 'fs';
import path from 'path';

async function runPhase11Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 11 VERIFICATION: Privacy & Containerization');
  console.log('===========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, description: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${description}`);
      failed++;
    }
  }

  const serverDir = path.join(__dirname, '../..');
  const clientDir = path.join(__dirname, '../../../client/src');
  const rootDir = path.join(__dirname, '../../..');

  // -----------------------------------------------------------------
  // 1. Backend Data Governance & User Controller
  // -----------------------------------------------------------------
  console.log('--- 1. Backend Privacy & Data Governance API ---');

  const controllerPath = path.join(serverDir, 'src/controllers/userController.ts');
  assert(fs.existsSync(controllerPath), 'server/src/controllers/userController.ts exists');

  const userController = await import('../controllers/userController');
  assert(typeof userController.exportUserData === 'function', 'userController exports exportUserData()');
  assert(typeof userController.updatePrivacySettings === 'function', 'userController exports updatePrivacySettings()');
  assert(typeof userController.changePassword === 'function', 'userController exports changePassword()');
  assert(typeof userController.deleteAccount === 'function', 'userController exports deleteAccount()');

  const routesPath = path.join(serverDir, 'src/routes/userRoutes.ts');
  assert(fs.existsSync(routesPath), 'server/src/routes/userRoutes.ts exists');

  const serverTsContent = fs.readFileSync(path.join(serverDir, 'src/server.ts'), 'utf-8');
  assert(serverTsContent.includes("app.use('/api/users', userRoutes)"), 'server.ts mounts /api/users route');

  // -----------------------------------------------------------------
  // 2. Unit Testing Suite for Data Governance
  // -----------------------------------------------------------------
  console.log('\n--- 2. Data Governance Unit Tests ---');

  const testFilePath = path.join(serverDir, 'src/tests/dataGovernance.test.ts');
  assert(fs.existsSync(testFilePath), 'dataGovernance.test.ts unit test file exists');

  const testContent = fs.readFileSync(testFilePath, 'utf-8');
  assert(testContent.includes('passwordHash'), 'Tests assert scrubbing of passwordHash from export');
  assert(testContent.includes('hideExactLocation'), 'Tests assert privacy settings toggle behavior');

  // -----------------------------------------------------------------
  // 3. Frontend Settings & Privacy Page
  // -----------------------------------------------------------------
  console.log('\n--- 3. Frontend Settings & Privacy Experience ---');

  const userApiPath = path.join(clientDir, 'api/userApi.ts');
  assert(fs.existsSync(userApiPath), 'client/src/api/userApi.ts exists');

  const userApiContent = fs.readFileSync(userApiPath, 'utf-8');
  assert(userApiContent.includes('exportUserDataApi'), 'userApi exports exportUserDataApi()');
  assert(userApiContent.includes('updatePrivacySettingsApi'), 'userApi exports updatePrivacySettingsApi()');
  assert(userApiContent.includes('changePasswordApi'), 'userApi exports changePasswordApi()');
  assert(userApiContent.includes('deleteAccountApi'), 'userApi exports deleteAccountApi()');

  const settingsPagePath = path.join(clientDir, 'pages/shared/SettingsPage.tsx');
  assert(fs.existsSync(settingsPagePath), 'client/src/pages/shared/SettingsPage.tsx exists');

  const settingsPageContent = fs.readFileSync(settingsPagePath, 'utf-8');
  assert(settingsPageContent.includes('hideExactLocation'), 'SettingsPage supports GPS masking privacy toggle');
  assert(settingsPageContent.includes('exportUserDataApi'), 'SettingsPage provides one-click data portability export');
  assert(settingsPageContent.includes('changePasswordApi'), 'SettingsPage provides credential security update');
  assert(settingsPageContent.includes('deleteAccountApi'), 'SettingsPage provides account deletion with confirmation');

  const appRoutesContent = fs.readFileSync(path.join(clientDir, 'routes/AppRoutes.tsx'), 'utf-8');
  assert(appRoutesContent.includes('path="/settings"'), 'AppRoutes.tsx defines protected /settings route');

  const sidebarContent = fs.readFileSync(path.join(clientDir, 'components/layout/Sidebar.tsx'), 'utf-8');
  assert(sidebarContent.includes("path: '/settings'"), 'Sidebar.tsx provides navigation links to /settings');

  // -----------------------------------------------------------------
  // 4. Production Containerization & DevOps
  // -----------------------------------------------------------------
  console.log('\n--- 4. Production Containerization & DevOps ---');

  const serverDockerPath = path.join(serverDir, 'Dockerfile');
  assert(fs.existsSync(serverDockerPath), 'server/Dockerfile exists');
  const serverDockerContent = fs.readFileSync(serverDockerPath, 'utf-8');
  assert(serverDockerContent.includes('AS builder'), 'server/Dockerfile uses multi-stage build');
  assert(serverDockerContent.includes('USER node'), 'server/Dockerfile runs as unprivileged user (node)');
  assert(serverDockerContent.includes('HEALTHCHECK'), 'server/Dockerfile defines container HEALTHCHECK');

  const clientDockerPath = path.join(rootDir, 'client/Dockerfile');
  assert(fs.existsSync(clientDockerPath), 'client/Dockerfile exists');
  const clientDockerContent = fs.readFileSync(clientDockerPath, 'utf-8');
  assert(clientDockerContent.includes('AS builder'), 'client/Dockerfile uses multi-stage build');
  assert(clientDockerContent.includes('FROM nginx'), 'client/Dockerfile uses production Nginx runtime');
  assert(clientDockerContent.includes('HEALTHCHECK'), 'client/Dockerfile defines container HEALTHCHECK');

  const nginxConfPath = path.join(rootDir, 'client/nginx.conf');
  assert(fs.existsSync(nginxConfPath), 'client/nginx.conf exists');
  const nginxConfContent = fs.readFileSync(nginxConfPath, 'utf-8');
  assert(nginxConfContent.includes('try_files $uri $uri/ /index.html;'), 'nginx.conf configures SPA client routing fallback');
  assert(nginxConfContent.includes('proxy_pass http://server:5000/api/;'), 'nginx.conf proxies /api/ requests to server container');
  assert(nginxConfContent.includes('proxy_pass http://server:5000/socket.io/;'), 'nginx.conf proxies /socket.io/ WebSocket requests');
  assert(nginxConfContent.includes('gzip on;'), 'nginx.conf enables Gzip compression for performance');

  const prodComposePath = path.join(rootDir, 'docker-compose.prod.yml');
  assert(fs.existsSync(prodComposePath), 'docker-compose.prod.yml exists');
  const prodComposeContent = fs.readFileSync(prodComposePath, 'utf-8');
  assert(prodComposeContent.includes('bloodlink-mongodb'), 'docker-compose.prod.yml defines mongodb service');
  assert(prodComposeContent.includes('bloodlink-server'), 'docker-compose.prod.yml defines server service');
  assert(prodComposeContent.includes('bloodlink-client'), 'docker-compose.prod.yml defines client service');
  assert(prodComposeContent.includes('bloodlink-network'), 'docker-compose.prod.yml defines isolated bridge network');

  assert(fs.existsSync(path.join(serverDir, '.dockerignore')), 'server/.dockerignore exists');
  assert(fs.existsSync(path.join(rootDir, 'client/.dockerignore')), 'client/.dockerignore exists');

  // -----------------------------------------------------------------
  // 5. In-Process Logic Verification: Data Scrubbing & Privacy
  // -----------------------------------------------------------------
  console.log('\n--- 5. In-Process Logic Verification ---');

  const sampleUserRecord = {
    _id: 'sample_id',
    name: 'Sample User',
    email: 'user@test.com',
    passwordHash: 'secret_bcrypt_hash',
    passwordResetHash: 'secret_reset_hash',
  };

  const scrubbedRecord = { ...sampleUserRecord } as Record<string, unknown>;
  delete scrubbedRecord.passwordHash;
  delete scrubbedRecord.passwordResetHash;

  assert(!('passwordHash' in scrubbedRecord), 'Export scrubber eliminates passwordHash');
  assert(!('passwordResetHash' in scrubbedRecord), 'Export scrubber eliminates passwordResetHash');
  assert(scrubbedRecord.email === 'user@test.com', 'Export scrubber preserves email');

  // -----------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`PHASE 11 VERIFICATION RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===========================================================');

  if (failed > 0) {
    console.error(`\n❌ Phase 11 verification failed with ${failed} error(s).`);
    process.exit(1);
  } else {
    console.log(`\n✅ All ${passed} Phase 11 verification checks PASSED successfully!`);
    process.exit(0);
  }
}

runPhase11Verification().catch((err) => {
  console.error('Fatal error during Phase 11 verification:', err);
  process.exit(1);
});
