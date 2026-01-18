# Phase 2: Profile Settings & Account Permissions - Context

**Gathered:** 2026-01-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Web UI for Profile Settings modal with two tabs (Profile, Extension). Users can view profile info and manage access codes. Account:view permission restricts what VAs see in account lists — only assigned accounts, minimal metadata, no edit capabilities.

</domain>

<decisions>
## Implementation Decisions

### Modal trigger & layout
- Triggered from bottom-left user info area (replace current display with clickable trigger)
- Vertical tabs on left (matching existing modal patterns in codebase)
- Two tabs: Profile and Extension
- Always opens to Profile tab (no tab memory)

### Access code display
- Hold-to-reveal behavior: press and hold to show code, release to hide (like password peek)
- Access code section visible only to Admin and VA users (Clients don't have access codes)

### Account:view behavior
- VAs with account:view see ONLY their assigned accounts
- Visible data: account name + occupied status (minimal)
- Hidden from VAs: edit buttons, create account, VA assignment counts, who is occupying
- List is purely read-only — no click action to view details
- Admins see everything: all accounts, all metadata, who exactly is logged in

### Extension download UI
- Single download button (links to Chrome Web Store or primary store)
- Step-by-step installation guide with numbered instructions
- Download button visible to everyone always (even if already installed)
- Clients see Extension tab but without access code section

### Claude's Discretion
- Masked access code format (show prefix vs fully masked)
- Copy feedback mechanism (icon change vs toast)
- Rotation confirmation dialog design
- Empty state for VAs with no assigned accounts

</decisions>

<specifics>
## Specific Ideas

- Modal design should match existing patterns (user edit, access profile dialogs use vertical tabs)
- Hold-to-reveal is a deliberate UX choice — code should never be accidentally visible

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-profile-settings-account-permissions*
*Context gathered: 2026-01-18*
