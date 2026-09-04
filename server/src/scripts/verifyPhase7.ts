/**
 * Phase 7 Verification Script: Frontend Design System & Shared Components
 *
 * Verifies all Phase 7 deliverables:
 * - react-router-dom installed and configured
 * - All core UI primitives exist with proper exports
 * - Feedback system (Toast, ToastContext, useToast)
 * - Domain components (MedicalDisclaimer, DonorCard, EmergencyRequestCard)
 * - Layout shell (Navbar, Sidebar, Footer, AppLayout)
 * - Privacy constraints (no raw GPS coordinates in domain cards)
 * - Healthcare design tokens in Tailwind configuration
 * - ProtectedRoute integration with react-router-dom
 * - App.tsx integration with AppLayout and interactive component showcase
 */

import fs from 'fs';
import path from 'path';

async function runPhase7Verification() {
  console.log('===========================================================');
  console.log('STARTING PHASE 7 VERIFICATION: Frontend Design System & Shared Components');
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

  const clientDir = path.join(__dirname, '../../../client/src');
  const clientPkgPath = path.join(__dirname, '../../../client/package.json');

  // -----------------------------------------------------------------
  // 1. Dependencies & Routing Infrastructure
  // -----------------------------------------------------------------
  console.log('\n--- 1. Routing & Dependencies ---');

  const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf-8'));
  assert(
    !!clientPkg.dependencies['react-router-dom'],
    'react-router-dom is listed in client/package.json dependencies'
  );

  const mainSource = fs.readFileSync(path.join(clientDir, 'main.tsx'), 'utf-8');
  assert(
    mainSource.includes('BrowserRouter') && mainSource.includes('<BrowserRouter>'),
    'main.tsx wraps application inside <BrowserRouter>'
  );

  const protectedRouteSource = fs.readFileSync(
    path.join(clientDir, 'components/shared/ProtectedRoute.tsx'),
    'utf-8'
  );
  assert(
    protectedRouteSource.includes("from 'react-router-dom'") &&
      protectedRouteSource.includes('<Link') &&
      protectedRouteSource.includes('to='),
    'ProtectedRoute.tsx uses react-router-dom <Link> instead of plain anchor tags'
  );

  // -----------------------------------------------------------------
  // 2. Core UI Primitives Verification
  // -----------------------------------------------------------------
  console.log('\n--- 2. Core UI Primitives ---');

  const requiredUiPrimitives = [
    'components/ui/Button.tsx',
    'components/ui/Input.tsx',
    'components/ui/Select.tsx',
    'components/ui/Badge.tsx',
    'components/ui/Card.tsx',
    'components/ui/Modal.tsx',
    'components/ui/ConfirmDialog.tsx',
    'components/ui/Table.tsx',
    'components/ui/Skeleton.tsx',
    'components/ui/EmptyState.tsx',
    'components/ui/ErrorState.tsx',
    'components/ui/StatusIndicator.tsx',
    'components/ui/index.ts',
  ];

  for (const file of requiredUiPrimitives) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `UI primitive exists: ${file}`);
  }

  // Verify Button variants and loading state
  const buttonSource = fs.readFileSync(path.join(clientDir, 'components/ui/Button.tsx'), 'utf-8');
  assert(
    buttonSource.includes('emergency') &&
      buttonSource.includes('clinical') &&
      buttonSource.includes('vitality') &&
      buttonSource.includes('isLoading'),
    'Button.tsx supports healthcare semantic variants (emergency, clinical, vitality) and loading state'
  );

  // Verify Input accessibility
  const inputSource = fs.readFileSync(path.join(clientDir, 'components/ui/Input.tsx'), 'utf-8');
  assert(
    inputSource.includes('aria-invalid') &&
      inputSource.includes('aria-describedby') &&
      inputSource.includes('helperText'),
    'Input.tsx implements accessible ARIA attributes and helper text'
  );

  // Verify Badge healthcare variants
  const badgeSource = fs.readFileSync(path.join(clientDir, 'components/ui/Badge.tsx'), 'utf-8');
  assert(
    badgeSource.includes('RequestUrgency') &&
      badgeSource.includes('RequestStatus') &&
      badgeSource.includes('BloodGroup'),
    'Badge.tsx supports domain types: RequestUrgency, RequestStatus, BloodGroup'
  );

  // Verify Modal accessibility and dismiss keys
  const modalSource = fs.readFileSync(path.join(clientDir, 'components/ui/Modal.tsx'), 'utf-8');
  assert(
    modalSource.includes('Escape') &&
      modalSource.includes('backdrop-blur') &&
      modalSource.includes('role="dialog"'),
    'Modal.tsx implements Escape key listener, backdrop blur, and accessible dialog role'
  );

  // -----------------------------------------------------------------
  // 3. Feedback System (Toast)
  // -----------------------------------------------------------------
  console.log('\n--- 3. Feedback System ---');

  assert(
    fs.existsSync(path.join(clientDir, 'components/feedback/ToastContext.tsx')),
    'ToastContext.tsx exists'
  );
  assert(
    fs.existsSync(path.join(clientDir, 'components/feedback/index.ts')),
    'components/feedback/index.ts barrel exists'
  );

  const toastSource = fs.readFileSync(
    path.join(clientDir, 'components/feedback/ToastContext.tsx'),
    'utf-8'
  );
  assert(
    toastSource.includes('useToast') &&
      toastSource.includes('success') &&
      toastSource.includes('error') &&
      toastSource.includes('warning') &&
      toastSource.includes('info'),
    'ToastContext provides useToast hook with success, error, warning, info methods'
  );

  assert(
    mainSource.includes('<ToastProvider>'),
    'main.tsx wraps application inside <ToastProvider>'
  );

  // -----------------------------------------------------------------
  // 4. Domain Components
  // -----------------------------------------------------------------
  console.log('\n--- 4. Healthcare Domain Components ---');

  const requiredDomainComponents = [
    'components/domain/MedicalDisclaimer.tsx',
    'components/domain/DonorCard.tsx',
    'components/domain/EmergencyRequestCard.tsx',
    'components/domain/index.ts',
  ];

  for (const file of requiredDomainComponents) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Domain component exists: ${file}`);
  }

  // Medical Disclaimer adherence
  const disclaimerSource = fs.readFileSync(
    path.join(clientDir, 'components/domain/MedicalDisclaimer.tsx'),
    'utf-8'
  );
  assert(
    disclaimerSource.includes('self-reported') &&
      disclaimerSource.includes('coordination') &&
      disclaimerSource.includes('medical eligibility'),
    'MedicalDisclaimer strictly reinforces that screening is self-reported and not medical clearance'
  );

  // Privacy adherence: DonorCard and EmergencyRequestCard must never expose raw coordinates
  const donorCardSource = fs.readFileSync(
    path.join(clientDir, 'components/domain/DonorCard.tsx'),
    'utf-8'
  );
  assert(
    !donorCardSource.includes('coordinates: [number, number]') &&
      !donorCardSource.includes('coordinates[0]'),
    'DonorCard never exposes raw GPS coordinates (uses distanceKm and coarse city)'
  );

  const emergencyCardSource = fs.readFileSync(
    path.join(clientDir, 'components/domain/EmergencyRequestCard.tsx'),
    'utf-8'
  );
  assert(
    !emergencyCardSource.includes('coordinates: [number, number]') &&
      emergencyCardSource.includes('distanceFormatted'),
    'EmergencyRequestCard uses friendly relative distance and protects exact coordinates'
  );

  // -----------------------------------------------------------------
  // 5. Layout Shell
  // -----------------------------------------------------------------
  console.log('\n--- 5. Layout Shell ---');

  const requiredLayoutFiles = [
    'components/layout/Navbar.tsx',
    'components/layout/Sidebar.tsx',
    'components/layout/Footer.tsx',
    'components/layout/AppLayout.tsx',
    'components/layout/index.ts',
  ];

  for (const file of requiredLayoutFiles) {
    const fullPath = path.join(clientDir, file);
    assert(fs.existsSync(fullPath), `Layout component exists: ${file}`);
  }

  const appLayoutSource = fs.readFileSync(
    path.join(clientDir, 'components/layout/AppLayout.tsx'),
    'utf-8'
  );
  assert(
    appLayoutSource.includes('<Navbar') &&
      appLayoutSource.includes('<Footer') &&
      appLayoutSource.includes('<EmergencyAlertToast'),
    'AppLayout integrates Navbar, Footer, and global EmergencyAlertToast'
  );

  // -----------------------------------------------------------------
  // 6. Interactive Design System Showcase in DesignSystemPage or App.tsx
  // -----------------------------------------------------------------
  console.log('\n--- 6. Interactive Showcase in DesignSystemPage or App.tsx ---');

  const appSource = fs.readFileSync(path.join(clientDir, 'App.tsx'), 'utf-8');
  const designSystemPagePath = path.join(clientDir, 'pages/DesignSystemPage.tsx');
  const appRoutesPath = path.join(clientDir, 'routes/AppRoutes.tsx');
  const showcaseSource = fs.existsSync(designSystemPagePath)
    ? fs.readFileSync(designSystemPagePath, 'utf-8')
    : appSource;
  const layoutSource = fs.existsSync(appRoutesPath)
    ? fs.readFileSync(appRoutesPath, 'utf-8')
    : appSource;

  assert(layoutSource.includes('<AppLayout'), 'AppLayout is configured in layout/routing');
  assert(showcaseSource.includes('primitives') && showcaseSource.includes('domain') && showcaseSource.includes('feedback'), 'Design system includes interactive workbench tabs');
  assert(showcaseSource.includes('<DonorCard'), 'Design system showcases DonorCard');
  assert(showcaseSource.includes('<EmergencyRequestCard'), 'Design system showcases EmergencyRequestCard');
  assert(showcaseSource.includes('<MedicalDisclaimer'), 'Design system showcases MedicalDisclaimer');
  assert(showcaseSource.includes('<Table>'), 'Design system showcases healthcare data Table');
  assert(showcaseSource.includes('<Modal'), 'Design system showcases accessible Modal');
  assert(showcaseSource.includes('<ConfirmDialog'), 'Design system showcases ConfirmDialog');

  // -----------------------------------------------------------------
  // 7. Tailwind Healthcare Design Tokens
  // -----------------------------------------------------------------
  console.log('\n--- 7. Tailwind Design Tokens ---');

  const tailwindConfigSource = fs.readFileSync(
    path.join(__dirname, '../../../client/tailwind.config.js'),
    'utf-8'
  );
  assert(
    tailwindConfigSource.includes('emergency') &&
      tailwindConfigSource.includes('clinical') &&
      tailwindConfigSource.includes('vitality'),
    'tailwind.config.js defines emergency, clinical, and vitality healthcare color tokens'
  );

  // -----------------------------------------------------------------
  // Final Summary
  // -----------------------------------------------------------------
  console.log('\n===========================================================');
  console.log(`PHASE 7 VERIFICATION COMPLETE: ${passed} passed, ${failed} failed.`);
  console.log('===========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7Verification().catch((err) => {
  console.error('Fatal error during Phase 7 verification:', err);
  process.exit(1);
});
