# Navigation Requirements

Requirements for sidebar, layout, and responsive navigation.

## Sidebar Sections

### Static Sections (All Users)

| Section | Items |
|---------|-------|
| Governance | Referenda, Treasury, Child Bounties |
| Fellowship | Fellowship, Salary Cycles, Salary Claimants, Salary Payments |
| Treasury Views | Outstanding Claims, Expired Claims, Treasury Netflows |

### Authenticated Sections

| Section | Items |
|---------|-------|
| Analytics | All Spending |
| Manage | Dashboards, Categories, Bounties, Subtreasury, Custom Spending, Custom Tables, Sync Settings, Data Errors |

### Dynamic Section
- User dashboards list (authenticated only)

---

## Desktop Sidebar

### Collapse Behavior
- Expanded and collapsed states
- State persisted in localStorage
- Smooth transition animation

---

## Mobile Navigation

### Bottom Nav
5 items: Referenda, Treasury, Fellowship, Dashboards, More

### Header
- Hamburger menu button
- "OpenGov Monitor" title

### Drawer
- Full sidebar as sheet from left side
- Triggered by hamburger or "More" button

---

## Layout

### Container
- Responsive padding (smaller on mobile, larger on desktop)

### Structure
- Flex container with proper overflow handling
- Bottom padding on mobile for bottom nav clearance

## See Also

- [UI Constants](../../02_specification/frontend/ui-constants.md) - Breakpoints, dimensions, animation timings
- [Data Views](./data-views.md) - Public pages in navigation
- [Manage Section](./manage-section.md) - Authenticated pages in navigation
- [Authentication](./authentication.md) - Auth-dependent sections
