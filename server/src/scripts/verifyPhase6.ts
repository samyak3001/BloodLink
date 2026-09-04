/**
 * Phase 6 Verification Script: Real-Time Sockets & Notification Center
 *
 * Verifies all Phase 6 deliverables:
 * - JWT token payload structure matches socket auth (userId, role, email)
 * - Socket service emission helpers and initialization exports
 * - Socket authentication bug fix: verify decoded.userId attaches to socket.data.userId
 * - Notification model schema and enum constraints
 * - Notification controller endpoints and pushUnreadCount integration
 * - Privacy: EmergencyAlertPayload contract excludes raw GPS coordinates
 * - Client-side component and hook architecture
 */

import fs from 'fs';
import path from 'path';
import { generateToken, verifyToken } from '../utils/jwt';
import {
  initSocketIO,
  getIO,
  emitEmergencyAlert,
  broadcastEmergencyAlertToDonors,
  emitDonorResponse,
  emitRequestUpdated,
  pushUnreadCount,
} from '../services/socketService';
import { Notification } from '../models/Notification';
import { AuthTokenPayload } from '../types';

async function runPhase6Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 6 VERIFICATION: Real-Time Sockets & Notification Center');
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

  // -----------------------------------------------------------------
  // 1. JWT & Socket Authentication Contract & Bug Fix Verification
  // -----------------------------------------------------------------
  console.log('\n--- 1. Socket Authentication & Room Contract ---');

  const testPayload: AuthTokenPayload = {
    userId: '65f1a2b3c4d5e6f7a8b9c0d1',
    role: 'DONOR',
    email: 'donor.test@example.com',
  };

  const token = generateToken(testPayload);
  assert(typeof token === 'string' && token.length > 20, 'generateToken returns valid JWT string');

  const decoded = verifyToken(token);
  assert(decoded.userId === testPayload.userId, 'verifyToken returns payload with userId');
  assert(decoded.role === testPayload.role, 'verifyToken returns payload with role');
  assert(decoded.email === testPayload.email, 'verifyToken returns payload with email');

  // Verify that decoded does NOT use 'id' (which was the source of the critical bug)
  const rawDecoded = decoded as unknown as Record<string, unknown>;
  assert(rawDecoded.id === undefined, 'Decoded token does NOT have .id property (must use .userId)');
  assert(rawDecoded.userId !== undefined, 'Decoded token has .userId property');

  // Verify socketService.ts source code uses decoded.userId instead of decoded.id
  const socketServiceSource = fs.readFileSync(
    path.join(__dirname, '../services/socketService.ts'),
    'utf-8'
  );
  assert(
    socketServiceSource.includes('socket.data.userId = decoded.userId'),
    'socketService.ts attaches decoded.userId (bug fixed)'
  );
  assert(
    !socketServiceSource.includes('socket.data.userId = decoded.id;'),
    'socketService.ts does NOT attach decoded.id'
  );
  assert(
    socketServiceSource.includes('await socket.join(`user:${userId}`)'),
    'Socket connects user to room user:${userId}'
  );
  assert(
    socketServiceSource.includes('await socket.join(`role:${role.toLowerCase()}s`)'),
    'Socket connects user to role-based broadcast room'
  );

  // -----------------------------------------------------------------
  // 2. Socket Service Emission Functions
  // -----------------------------------------------------------------
  console.log('\n--- 2. Socket Service Emission Functions ---');

  assert(typeof initSocketIO === 'function', 'initSocketIO is exported as a function');
  assert(typeof getIO === 'function', 'getIO is exported as a function');
  assert(typeof emitEmergencyAlert === 'function', 'emitEmergencyAlert is exported as a function');
  assert(
    typeof broadcastEmergencyAlertToDonors === 'function',
    'broadcastEmergencyAlertToDonors is exported as a function'
  );
  assert(typeof emitDonorResponse === 'function', 'emitDonorResponse is exported as a function');
  assert(typeof emitRequestUpdated === 'function', 'emitRequestUpdated is exported as a function');
  assert(typeof pushUnreadCount === 'function', 'pushUnreadCount is exported as a function');

  // -----------------------------------------------------------------
  // 3. Notification Model Schema & Validation
  // -----------------------------------------------------------------
  console.log('\n--- 3. Notification Model Schema ---');

  const validNotificationData = {
    recipientId: '65f1a2b3c4d5e6f7a8b9c0d1',
    type: 'EMERGENCY_ALERT',
    title: 'Urgent: O+ Blood Needed',
    message: 'Apollo Hospital urgently requires 2 units of O+ blood.',
    data: { requestId: '65f1a2b3c4d5e6f7a8b9c0d2', urgency: 'CRITICAL' },
    isRead: false,
  };

  const notificationDoc = new Notification(validNotificationData);
  const validationError = notificationDoc.validateSync();
  assert(!validationError, 'Notification document validates successfully with valid fields');

  // Invalid notification type enum
  const invalidTypeDoc = new Notification({
    ...validNotificationData,
    type: 'INVALID_TYPE',
  });
  const invalidTypeError = invalidTypeDoc.validateSync();
  assert(!!invalidTypeError, 'Notification document rejects invalid notification type enum');

  // -----------------------------------------------------------------
  // 4. Notification Controller Socket Integration
  // -----------------------------------------------------------------
  console.log('\n--- 4. Notification Controller Socket Integration ---');

  const notificationControllerSource = fs.readFileSync(
    path.join(__dirname, '../controllers/notificationController.ts'),
    'utf-8'
  );
  assert(
    notificationControllerSource.includes('pushUnreadCount'),
    'notificationController imports and utilizes pushUnreadCount'
  );
  assert(
    notificationControllerSource.includes('markNotificationRead') &&
      notificationControllerSource.includes('markAllNotificationsRead') &&
      notificationControllerSource.includes('getNotifications'),
    'notificationController exports all required REST endpoints'
  );

  // -----------------------------------------------------------------
  // 5. Privacy & Security: EmergencyAlertPayload Contract
  // -----------------------------------------------------------------
  console.log('\n--- 5. Privacy & Security Constraints ---');

  const clientSocketTypesSource = fs.readFileSync(
    path.join(__dirname, '../../../client/src/types/socket.ts'),
    'utf-8'
  );
  const serverSocketTypesSource = fs.readFileSync(
    path.join(__dirname, '../types/socket.ts'),
    'utf-8'
  );

  assert(
    !clientSocketTypesSource.includes('coordinates') &&
      !serverSocketTypesSource.includes('coordinates: [number, number]'),
    'EmergencyAlertPayload does NOT expose raw donor or hospital GPS coordinates'
  );
  assert(
    clientSocketTypesSource.includes('distanceFormatted') &&
      clientSocketTypesSource.includes('estimatedTransitTimeMinutes'),
    'EmergencyAlertPayload provides friendly relative distance and transit time instead of raw coordinates'
  );

  // -----------------------------------------------------------------
  // 6. Client Architecture & UI Components
  // -----------------------------------------------------------------
  console.log('\n--- 6. Client-Side Real-Time & Notification Components ---');

  const clientDir = path.join(__dirname, '../../../client/src');
  const requiredClientFiles = [
    'types/socket.ts',
    'context/SocketContext.tsx',
    'context/NotificationContext.tsx',
    'hooks/useSocket.ts',
    'hooks/useNotifications.ts',
    'hooks/useSocketEvent.ts',
    'hooks/useRequestRoom.ts',
    'components/notifications/NotificationBell.tsx',
    'components/notifications/NotificationDropdown.tsx',
    'components/notifications/NotificationItem.tsx',
    'components/notifications/EmergencyAlertToast.tsx',
    'components/shared/ConnectionStatus.tsx',
  ];

  for (const file of requiredClientFiles) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Client file exists: ${file}`);
  }

  // Verify App.tsx or Layout integrates the real-time elements
  const appSource = fs.readFileSync(path.join(clientDir, 'App.tsx'), 'utf-8');
  const layoutSource = fs.existsSync(path.join(clientDir, 'components/layout/AppLayout.tsx'))
    ? fs.readFileSync(path.join(clientDir, 'components/layout/AppLayout.tsx'), 'utf-8') +
      fs.readFileSync(path.join(clientDir, 'components/layout/Navbar.tsx'), 'utf-8')
    : '';
  const clientAppTree = appSource + layoutSource;
  assert(clientAppTree.includes('<ConnectionStatus'), 'App tree includes ConnectionStatus component');
  assert(clientAppTree.includes('<NotificationBell'), 'App tree includes NotificationBell component');
  assert(clientAppTree.includes('<EmergencyAlertToast'), 'App tree includes EmergencyAlertToast component');

  // Verify main.tsx wraps with providers
  const mainSource = fs.readFileSync(path.join(clientDir, 'main.tsx'), 'utf-8');
  assert(mainSource.includes('<SocketProvider>'), 'main.tsx includes SocketProvider');
  assert(mainSource.includes('<NotificationProvider>'), 'main.tsx includes NotificationProvider');

  // -----------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`PHASE 6 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6Verification().catch((err) => {
  console.error('Fatal error during Phase 6 verification:', err);
  process.exit(1);
});
