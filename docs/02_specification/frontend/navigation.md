# Navigation Specification

Technical specifications for sidebar, layout, and responsive navigation.

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

## Desktop Sidebar

### Dimensions

| Property | Value |
|----------|-------|
| Expanded width | 256px |
| Collapsed width | 56px |
| Transition duration | 200ms |

### Collapse Behavior
- Expanded and collapsed states
- State persisted in localStorage
- Smooth transition animation

## Mobile Navigation

### Breakpoint
- Desktop sidebar visible: >= 1024px
- Mobile navigation: < 1024px

### Bottom Nav
5 items: Referenda, Treasury, Fellowship, Dashboards, More

### Header
- Hamburger menu button
- "OpenGov Monitor" title

### Drawer
- Full sidebar as sheet from left side
- Triggered by hamburger or "More" button

## Layout Dimensions

| Element | Value |
|---------|-------|
| Container max-width | 1600px |
| Padding mobile | 16px |
| Padding desktop | 24px |

## Route Paths

| Route | Page |
|-------|------|
| `/referenda` | Referenda |
| `/treasury` | Treasury |
| `/child-bounties` | Child Bounties |
| `/fellowship` | Fellowship |
| `/fellowship-salary-cycles` | Salary Cycles |
| `/fellowship-salary-claimants` | Salary Claimants |
| `/fellowship-salary-payments` | Salary Payments |
| `/outstanding-claims` | Outstanding Claims |
| `/expired-claims` | Expired Claims |
| `/treasury-netflows` | Treasury Netflows |
| `/spending` | Spending (auth) |
| `/dashboards` | Dashboard List |
| `/dashboards/:id` | Dashboard View |
| `/dashboards/:id/edit` | Dashboard Edit (auth) |
| `/manage/*` | Manage Section (auth) |

## See Also

- [Navigation Requirements](../../01_requirements/features/navigation.md) - User capabilities
- [UI Constants](./ui-constants.md) - All breakpoints and dimensions
- [Authentication](../../01_requirements/features/authentication.md) - Auth-dependent sections
