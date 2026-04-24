# Drop Paper Redesign Implementation Plan

> **For implementation agents:** use `superpowers:executing-plans` against this plan. Keep `drop-design/` as a local design reference; do not stage it unless the user explicitly asks.

**Goal:** Rebuild the Drop frontend to match the approved `B · Paper / Document` design while preserving the current room, encryption, join, clipboard, and file-transfer behavior.

**Architecture:** Keep the existing application protocol and cryptographic flows in place, but replace the current monolithic UI with a token-driven design system, extracted state hooks, and Paper-specific desktop/mobile workspaces plus overlays.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Express, Socket.IO, Web Crypto, JSZip.

**Primary Inputs:**

- Spec: `docs/superpowers/specs/2026-04-24-drop-paper-redesign-design.md`
- Design contract: `drop-design/agentreadme.md:1-440`
- Paper desktop/mobile source: `drop-design/workspace-paper.jsx:23-249`, `drop-design/workspace-paper.jsx:406-536`
- Overlay/state source: `drop-design/modals.jsx:5-430`
- Token source: `drop-design/tokens.jsx:4-134`

---

## Requirements Summary

- Only implement the `B · Paper / Document` direction; terminal and OS variants are explicitly out of scope (`drop-design/agentreadme.md:18-24`, `drop-design/agentreadme.md:432-439`).
- Copy the Paper token system verbatim into project theme code; do not invent colors (`drop-design/agentreadme.md:28-69`, `drop-design/tokens.jsx:4-126`).
- Preserve current business behavior already implemented in `src/App.tsx`, including room bootstrap, room-code join approval, message decryption, local history, file upload, folder zipping, clipboard actions, and keyboard handling (`src/App.tsx:273-932`).
- Replace the current green, bubble-based UI and lucide-driven chrome with the Paper layout and local icon system (`src/App.tsx:86-188`, `src/App.tsx:1033-1305`, `package.json:14-31`).
- Update app metadata and public branding because the current head/manifest still point at green theme colors and an emoji favicon (`index.html:5-14`, `public/manifest.json:2-16`, `public/favicon.svg:1-3`).

---

## Acceptance Criteria

- The app renders the approved Paper layout on desktop and mobile, using the exact three-column desktop structure and Paper mobile priority stack from the design source.
- All colors, shadows, radii, typography, and spacing in product chrome come from the migrated token system; no stray hex values remain outside theme files.
- The current core workflows still work: create/share room, QR/link join, 4-digit room-code join, join approval/rejection, text send, paste-and-send, file send, folder send, file download, password-room join, history clear.
- Existing stateful behaviors survive the refactor: localStorage text history restore, non-persisted file binary history, upload progress, join-request pending/approved/rejected/expired, socket disconnect handling, and iOS keyboard composer pinning.
- The current prompt-based password-room creation flow is replaced with a Paper modal; no `window.prompt` or `window.confirm` remains in the main UX path.
- Primary app chrome no longer uses `lucide-react`; local Paper icons and brand assets are the source of truth.
- `index.html`, manifest icons, and theme colors reflect the Paper palette and brand assets.
- `npm run lint` and `npm run build` pass after the refactor.

---

## File Structure

### Existing files to modify

- `src/App.tsx`
- `src/index.css`
- `src/main.tsx`
- `index.html`
- `public/manifest.json`
- `public/favicon.svg`
- `package.json` and `package-lock.json` if `lucide-react` becomes unused

### Existing files to read but keep behaviorally stable

- `src/lib/crypto.ts`
- `src/lib/file-worker.ts`
- `src/lib/utils.ts`
- `src/components/ErrorBoundary.tsx`

### New files and directories to create

- `src/theme/tokens.ts`
- `src/theme/theme.ts` or equivalent lightweight helpers
- `src/assets/brand/*`
- `src/components/icons/*`
- `src/components/brand/*`
- `src/components/shell/*`
- `src/components/room/*`
- `src/components/join/*`
- `src/components/timeline/*`
- `src/components/composer/*`
- `src/components/security/*`
- `src/components/overlays/*`
- `src/components/feedback/*`
- `src/hooks/*`
- `src/flows/WorkspaceDesktop.tsx`
- `src/flows/WorkspaceMobile.tsx`

---

## Task 1: Build the Paper Theme and Brand Foundation

**Why first:** The current app shell is visually anchored to green Tailwind classes and an emoji favicon (`src/App.tsx:1033-1305`, `index.html:9-13`, `public/favicon.svg:1-3`). The design contract requires the token map, fonts, local icons, and packet logo to exist before any component work starts (`drop-design/agentreadme.md:28-155`).

**Files:**

- Create: `src/theme/tokens.ts`
- Create: `src/theme/theme.ts` or equivalent helper
- Modify: `src/index.css`
- Modify: `index.html`
- Modify: `public/manifest.json`
- Modify: `public/favicon.svg`
- Create/copy: `src/assets/brand/drop-mark.svg`, `drop-logo.svg`, `drop-app-icon.svg`
- Create: `src/components/icons/*.tsx`
- Create: `src/components/icons/index.ts`
- Create: `src/components/brand/DropLogo.tsx`

- [ ] **Step 1: Migrate design tokens and typography into app theme files**

Copy `dropTokens.light`, `dropTokens.dark`, typography, spacing, and radius from `drop-design/tokens.jsx:4-126` into `src/theme/tokens.ts`.

Expected result:

- The project has a single TypeScript token source for Paper light/dark themes.
- Inter and JetBrains Mono are defined centrally instead of being implied ad hoc.

- [ ] **Step 2: Rewrite global CSS around Paper variables**

Replace the current minimal safe-area CSS in `src/index.css:1-47` with:

- root CSS variables mapped from theme tokens
- dark theme variable overrides
- global font-family assignment
- focus ring utilities matching `focus.ring` and `focus.ringMuted`
- safe-area and keyboard helpers preserved from the existing mobile support

Expected result:

- Global app chrome defaults to the Paper palette.
- Existing mobile safe-area behavior is retained.

- [ ] **Step 3: Replace public metadata branding**

Update:

- `index.html:9-13` theme colors and favicon links
- `public/manifest.json:2-16` background color, theme color, and icon list
- `public/favicon.svg:1-3` emoji asset

Use the Paper primary colors and packet mark direction from `drop-design/agentreadme.md:139-155`.

Expected result:

- The browser tab, PWA icon metadata, and theme color match the redesign.

- [ ] **Step 4: Copy brand assets and create local icon components**

Copy brand SVGs from `drop-design/src/assets/brand/*`. Convert the Paper icon set described in `drop-design/agentreadme.md:115-135` into local React components under `src/components/icons`.

Expected result:

- Product chrome no longer depends on generic iconography for Paper-specific controls.

- [ ] **Step 5: Remove Paper-incompatible chrome dependencies if unused**

After icon migration, remove `lucide-react` from `package.json:20` only if no runtime imports remain.

Expected result:

- The dependency graph matches the new icon source of truth.

---

## Task 2: Extract Stateful Logic Out of the Monolithic `App.tsx`

**Why second:** `src/App.tsx` currently mixes session bootstrap, socket wiring, file transfer orchestration, password handling, message rendering, and both desktop/mobile layouts in one component (`src/App.tsx:198-1305`). The redesign will be unstable unless state and rendering boundaries are separated first.

**Files:**

- Modify: `src/App.tsx`
- Create: `src/hooks/useDropSession.ts`
- Create: `src/hooks/useTransferTimeline.ts`
- Create: `src/hooks/useJoinByCode.ts`
- Create: `src/hooks/useRoomSecurity.ts`
- Create: `src/hooks/useViewportComposer.ts`
- Create as needed: shared UI/domain types in `src/types/*` or colocated hook files

- [ ] **Step 1: Extract room/session bootstrap and socket lifecycle**

Move the logic currently spanning `src/App.tsx:273-557` into `useDropSession` and `useJoinByCode`, preserving:

- room creation from URL hash
- password-room bootstrap split
- socket `join-room`
- room-code assignment
- room-code join request lifecycle
- approval/rejection/expiry handling

Expected result:

- Session and join state can be consumed by new desktop/mobile shells without duplicating protocol logic.

- [ ] **Step 2: Extract message timeline and transfer orchestration**

Move the logic in `src/App.tsx:310-582` and `src/App.tsx:620-832` into `useTransferTimeline`, preserving:

- localStorage history restore/save
- incoming decryption
- chunked file assembly
- markdown/text/file message mapping
- file send progress
- folder zip progress

Expected result:

- The UI can render timeline states from a normalized data model instead of directly from ad hoc component-local state.

- [ ] **Step 3: Extract security and mobile viewport concerns**

Move:

- clipboard/autocopy and password-room state from `src/App.tsx:214-245`, `src/App.tsx:873-895`
- visual viewport handling from `src/App.tsx:588-618`

Expected result:

- Password room, clipboard, and keyboard handling become reusable hooks that overlays and mobile shells can share.

- [ ] **Step 4: Reduce `App.tsx` to a composition root**

After extraction, `src/App.tsx` should primarily:

- guard unsupported crypto (`src/App.tsx:1023-1030`)
- initialize hooks
- decide which shell/overlay tree to render

Expected result:

- `App.tsx` becomes an orchestration root, not the place where visual details live.

---

## Task 3: Implement the Desktop Paper Workspace

**Why third:** The desktop Paper workspace is the canonical layout. It defines the main shell, timeline presentation, and inspector composition (`drop-design/workspace-paper.jsx:23-249`, `drop-design/agentreadme.md:158-260`).

**Files:**

- Create: `src/components/shell/AppShell.tsx`
- Create: `src/components/shell/Letterhead.tsx`
- Create: `src/components/room/RoomIdentityPanel.tsx`
- Create: `src/components/room/DevicesList.tsx`
- Create: `src/components/join/JoinByCodePanel.tsx`
- Create: `src/components/join/JoinApprovalQueue.tsx`
- Create: `src/components/timeline/TransferTimeline.tsx`
- Create: `src/components/timeline/TimelineEntry.tsx`
- Create: `src/components/timeline/TextEntry.tsx`
- Create: `src/components/timeline/FileEntry.tsx`
- Create: `src/components/composer/ComposerPanel.tsx`
- Create: `src/components/security/SecurityNotice.tsx`
- Create: `src/components/security/SecurityFacts.tsx`
- Create: `src/components/security/PreferencesPanel.tsx`
- Create: `src/flows/WorkspaceDesktop.tsx`

- [ ] **Step 1: Build the three-column Paper shell**

Match the desktop structure from `drop-design/workspace-paper.jsx:23-52` and `drop-design/agentreadme.md:162-171`:

- `340px` sidebar
- `1fr` center
- `320px` inspector
- letterhead with session, status, devices, date stamps

Expected result:

- The main desktop screen visually matches the Paper design before content detail is attached.

- [ ] **Step 2: Implement sidebar room identity, device list, and join-by-code**

Match the left-column sections from `drop-design/workspace-paper.jsx:50-103` and component contract lines `drop-design/agentreadme.md:209-229`.

Wire them to live data from current app behavior:

- room QR / share URL / room code from `src/App.tsx:934-955`, `src/App.tsx:1097-1122`
- peer count from `src/App.tsx:350-365`
- join request approval data from `src/App.tsx:385-431`, `src/App.tsx:989-1021`
- room-code input and submit from `src/App.tsx:897-914`, `src/App.tsx:956-988`

Expected result:

- Sidebar content is live, not mocked.

- [ ] **Step 3: Rebuild the center timeline as numbered entries**

Replace the current bubble renderer in `src/App.tsx:86-188` and list usage in `src/App.tsx:1212-1217` with a timeline aligned to `drop-design/workspace-paper.jsx:105-193` and `drop-design/workspace-paper.jsx:316-377`.

Preserve:

- markdown rendering and long-text expansion
- file download action
- text/file direction labeling
- send-state and history-state rendering

Expected result:

- Messages become numbered Paper entries instead of chat bubbles.

- [ ] **Step 4: Rebuild the desktop composer**

Replace the current desktop input row at `src/App.tsx:1219-1235` with the Paper composer from `drop-design/workspace-paper.jsx:147-191` and interaction rules from `drop-design/agentreadme.md:318-331`.

Preserve:

- Enter sends
- Shift+Enter newline
- trim-based send disable
- paste-and-send
- file picker and folder picker

Expected result:

- The composer matches Paper structure without regressing existing send behavior.

- [ ] **Step 5: Implement the Paper inspector**

Replace the current right-side settings and security cards from `src/App.tsx:1158-1184` with the security notice, fact rows, and toggles from `drop-design/workspace-paper.jsx:196-236`.

Expected result:

- Security copy and preferences match the design contract and avoid forbidden phrases from `drop-design/agentreadme.md:293-314`.

---

## Task 4: Implement the Mobile Paper Workspace and All Overlays

**Why fourth:** The mobile Paper shell and all overlays are major behavior surfaces in the current product. They must be redesigned without regressing join flows, password flow, progress feedback, or message access (`drop-design/workspace-paper.jsx:406-536`, `drop-design/modals.jsx:5-430`).

**Files:**

- Create: `src/flows/WorkspaceMobile.tsx`
- Create: `src/components/overlays/ConnectDeviceSheet.tsx`
- Create: `src/components/overlays/AllMessagesMobileSheet.tsx`
- Create: `src/components/overlays/PasswordRoomModal.tsx`
- Create: `src/components/overlays/JoinApprovalCard.tsx`
- Create: `src/components/overlays/ProgressOverlay.tsx`
- Create: `src/components/overlays/ConfirmClearHistoryDialog.tsx`
- Create: `src/components/feedback/ToastStack.tsx`
- Create: `src/components/feedback/EmptyState.tsx`
- Create: `src/components/feedback/ErrorState.tsx`

- [ ] **Step 1: Rebuild the Paper mobile shell**

Replace the current mobile layout in `src/App.tsx:1240-1303` with the Paper mobile hierarchy from `drop-design/workspace-paper.jsx:406-505` and responsive rules in `drop-design/agentreadme.md:177-193`.

Expected result:

- Mobile prioritizes paste-and-send, file/folder tiles, inline text compose, and recent log in the same order as the design.

- [ ] **Step 2: Replace the QR modal with the Connect Device sheet**

Migrate `showQRModal` UI from `src/App.tsx:1097-1122` to the sheet defined in `drop-design/modals.jsx:5-73`.

Expected result:

- QR, share link, room code, and security notice all match the Paper sheet contract.

- [ ] **Step 3: Replace the password prompt and password entry screen with Paper modals**

Replace:

- the blocking password gate at `src/App.tsx:1041-1065`
- the prompt-based create flow at `src/App.tsx:888-895`

with the design in `drop-design/modals.jsx:184-245`.

Expected result:

- Password room creation and join use first-class Paper modal UI.

- [ ] **Step 4: Replace current pending/progress/toast/confirm states with Paper overlays**

Map:

- upload overlays from `src/App.tsx:1067-1095`
- join pending/rejected/error states from `src/App.tsx:369-430`, `src/App.tsx:982-985`
- error toast from `src/App.tsx:230-234`, `src/App.tsx:1035-1039`
- mobile all-messages view from `src/App.tsx:1125-1142`
- clear history action from `src/App.tsx:865-871`, `src/App.tsx:1210`

to:

- `TransferStates`, `Toasts`, `ConfirmClear`, `JoinStates`, `JoinApproval`, `StatesBoard` in `drop-design/modals.jsx:75-430`

Expected result:

- Temporary states visually match the Paper system and no longer rely on generic full-screen spinners or browser dialogs.

- [ ] **Step 5: Preserve keyboard and safe-area behavior in the new shell**

Carry forward the `visualViewport` logic in `src/App.tsx:595-618` and the safe-area support in `src/index.css:4-47`.

Expected result:

- On mobile/PWA, the composer stays usable above the keyboard and device safe areas.

---

## Task 5: Wire Dark Mode, Metadata, and Final Cleanup

**Why fifth:** Once both shells exist, the remaining work is alignment and cleanup: dark-mode tokens, forbidden-copy audit, dependency cleanup, and reducing the leftover legacy surface.

**Files:**

- Modify: all shell/components as needed
- Modify: `src/App.tsx`
- Modify: `index.html`
- Modify: `public/manifest.json`
- Modify: `package.json` and `package-lock.json` if dependency cleanup is warranted

- [ ] **Step 1: Enable token-based dark mode**

Use the dark token set from `drop-design/tokens.jsx:58-101` and the dark rules in `drop-design/agentreadme.md:71-77`.

Expected result:

- The same components render correctly in light and dark without ad hoc color exceptions.

- [ ] **Step 2: Audit copy and interaction rules**

Verify strings and behaviors against:

- copy rules in `drop-design/agentreadme.md:293-314`
- interaction rules in `drop-design/agentreadme.md:318-331`
- accessibility requirements in `drop-design/agentreadme.md:335-343`

Expected result:

- No forbidden security phrasing ships.
- Send, clipboard, join, and history behaviors match the design contract.

- [ ] **Step 3: Remove leftover legacy UI paths**

After the new flows are wired, remove or inline obsolete helpers/components that only existed for the old green/bubble layout.

Expected result:

- `src/App.tsx` no longer contains both old and new UI trees in parallel.

---

## Task 6: Verify Behavior, Visual Fidelity, and Build Health

**Why last:** This refactor is broad enough that correctness depends on functional and visual verification, not only type-checking.

**Files:**

- Verify the whole workspace

- [ ] **Step 1: Run code health checks**

Run:

```bash
rtk npm run lint
rtk npm run build
```

Expected:

- both commands succeed

- [ ] **Step 2: Run focused Paper fidelity checks**

Verify against the checklist in `drop-design/agentreadme.md:413-429`:

- no stray hex colors outside theme files
- no emoji in product chrome
- no gradients, blur, or glass
- room code uses mono and spacing
- focus-visible is present
- clipboard denial surfaces actionable toast
- history and empty states are reachable

- [ ] **Step 3: Run workflow regressions**

Manually test:

- room creation and sharing
- QR/link join
- 4-digit join request / approve / reject / expire
- text send and markdown display
- clipboard paste-and-send success and denial
- file send, folder zip/send, download, too-large rejection
- password room create/join/error
- local history restore after reload
- disconnect and reconnect behavior

- [ ] **Step 4: Capture desktop and mobile screenshots for review**

Capture at minimum:

- desktop wide Paper shell
- desktop with populated timeline and inspector states
- mobile Paper shell
- connect-device sheet
- password modal
- progress overlay / toast / clear-history confirm

Expected result:

- Visual review can compare implementation against the approved Paper reference.

---

## Risks and Mitigations

- **Risk:** `src/App.tsx` event handlers are tightly coupled to local state.
  - **Mitigation:** extract hooks before replacing the shell; do not rewrite protocol semantics while changing UI.

- **Risk:** Paper fidelity slips if components keep using ad hoc Tailwind colors.
  - **Mitigation:** migrate tokens first, grep for hex literals after implementation, and treat non-theme literals as defects.

- **Risk:** Mobile keyboard and safe-area behavior regresses during the layout rewrite.
  - **Mitigation:** preserve the existing `visualViewport` logic and re-test in the Paper mobile shell before cleanup.

- **Risk:** Password-room flow regresses when removing `prompt`.
  - **Mitigation:** replace prompt only after `PasswordRoomModal` is wired to the existing derive/join behavior.

- **Risk:** Untracked `drop-design/` assets are accidentally committed.
  - **Mitigation:** stage only intended app files and docs; keep `drop-design/` as read-only local reference unless asked otherwise.

---

## Verification Commands

```bash
rtk rg -n "#[0-9A-Fa-f]{3,8}" src index.html public
rtk rg -n "lucide-react|bg-emerald|text-emerald|from-|to-|backdrop-blur|blur-" src
rtk npm run lint
rtk npm run build
rtk git diff --check
```

Interpretation:

- Hex search should only match theme or intentional static SVG/public asset files.
- Legacy green and Paper-forbidden visual patterns should disappear from the application source.

---

## Done Definition

This plan is complete when:

- the app matches the approved Paper direction across desktop, mobile, and overlays
- existing transfer and join behavior remains functional
- the old green/bubble UI is gone
- app metadata and icons match the new brand system
- lint/build pass
- screenshot-based review shows no obvious drift from the Paper reference
