# Guidance Dashboard v2 - UI Enhancement Test Guide

## Overview

This guide provides comprehensive testing instructions for the enhanced Guidance Dashboard UI, focusing on two key improvements:
1. **Request Details Modal Display** - Smooth display and population of guidance request details
2. **Sidebar Menu Expansion** - Smooth and consistent expand/collapse behavior

**Status:** ✅ All code enhancements completed and verified (0 errors)

---

## Part 1: Request Details Modal Display

### Test Scenario 1.1: Open Request Modal by Clicking Row

**Prerequisites:**
- Guidance Dashboard loaded and authenticated
- Navigate to "Guidance Requests" → "All Requests" section

**Steps:**
1. View the "All Requests" table with student guidance requests listed
2. Click on ANY row in the table (anywhere except the Action buttons)
3. Verify modal appears with smooth **slideIn animation** (moves down from top while fading in)

**Expected Result:**
- ✅ Modal displays with 0.3s smooth animation
- ✅ Modal background darkens (black overlay at 40% opacity)
- ✅ Modal is centered on screen
- ✅ Modal title shows "Request Details"
- ✅ Close button (×) visible in top-right corner

**Console Check:**
```
[Guidance Dashboard v2] 🔍 Opening request modal for ID: {requestId}
[Guidance Dashboard v2] ✅ Request data loaded: {...}
[Guidance Dashboard v2] ✅ Messages loaded: {count} messages
[Guidance Dashboard v2] ✅ Modal displayed for request: {requestId}
```

### Test Scenario 1.2: Verify Request Details Display

**Prerequisites:**
- Modal is open (from Test 1.1)

**Steps:**
1. Examine the modal content for the following fields (in order):
   - **Student:** [Student name in gray box]
   - **Grade:** [Grade level in gray box]
   - **Reason:** [Request reason in gray box]
   - **Message:** [Student's message in gray box]
   - **Current Status:** [Dropdown with Pending/Approved/Completed/Declined]
   - **Appointment Date (if approved):** [Date input field]
   - **Message History:** [Scrollable list if messages exist]
     - Counselor messages: Blue left border
     - Student messages: Green left border
     - Each message shows sender role, content, and timestamp
   - **Add Message:** [Textarea for replying]
   - **Visible to student:** [Checkbox - checked by default]

**Expected Result:**
- ✅ All fields populated with request data
- ✅ Status dropdown pre-selected with current status
- ✅ Message history displays correctly with color-coded borders
- ✅ Timestamps formatted as locale string
- ✅ Form elements have consistent styling (borders, padding, rounded corners)

**Styling Verification:**
- ✅ Labels are bold, smaller font (13px)
- ✅ Display fields have light gray background (#f5f5f5)
- ✅ Input fields have 1px solid #ddd border
- ✅ Form groups have 15px bottom margin

### Test Scenario 1.3: Close Modal via Close Button

**Prerequisites:**
- Modal is open (from Test 1.2)

**Steps:**
1. Click the "×" (close) button in the modal header

**Expected Result:**
- ✅ Modal closes with **smooth fade-out animation** (0.3s opacity transition)
- ✅ Background overlay disappears
- ✅ Modal title "Request Details" disappears
- ✅ No JavaScript errors in console

**Console Check:**
```
[Guidance Dashboard v2] 🚪 Modal closed: requestModal
```

### Test Scenario 1.4: Close Modal via Background Click

**Prerequisites:**
- Modal is open

**Steps:**
1. Click on the dark background/overlay (NOT on the modal-content)
2. Verify modal closes

**Expected Result:**
- ✅ Modal closes smoothly
- ✅ Background overlay disappears
- ✅ No form errors or alert boxes

**Console Check:**
```
[Guidance Dashboard v2] ✅ Modal click listeners setup
```

### Test Scenario 1.5: Modal NOT Closing When Clicking Content

**Prerequisites:**
- Modal is open

**Steps:**
1. Click on the modal content area (title, form fields, buttons)
2. Verify modal DOES NOT close

**Expected Result:**
- ✅ Modal remains open
- ✅ Form fields can be interacted with
- ✅ Modal only closes when clicking outside border or close button

---

## Part 2: Sidebar Menu Expansion/Collapse

### Test Scenario 2.1: Expand Guidance Requests Menu

**Prerequisites:**
- Guidance Dashboard loaded
- Sidebar visible on left
- Menu button "Guidance Requests" visible with "📋" icon

**Steps:**
1. Click the "Guidance Requests" menu button (has dropdown chevron "▸")
2. Observe the expansion behavior

**Expected Result:**
- ✅ Submenu expands smoothly with **max-height animation** (0.3s ease)
- ✅ Chevron "▸" rotates to point downward "▼" (90 degrees, 0.3s transition)
- ✅ Three submenu items appear:
  - 📑 All Requests
  - ⏳ Pending
  - ✅ Completed
- ✅ Submenu background is light gray (#f9f9f9)
- ✅ Submenu has blue left border (3px solid #667eea)
- ✅ Submenu items have proper indentation (40px left padding)

**Styling Features:**
- ✅ Menu-button shows focus outline when clicked (keyboard accessibility)
- ✅ Menu-button shows active scale (0.98) animation during click
- ✅ Submenu items have hover effect (background lightens, left padding increases)

**Console Check:**
```
[Guidance Dashboard v2] 📋 Submenu opened
[Guidance Dashboard v2] ✅ Menu button listeners setup
```

### Test Scenario 2.2: Collapse Guidance Requests Menu

**Prerequisites:**
- Guidance Requests menu is expanded (from Test 2.1)

**Steps:**
1. Click the "Guidance Requests" menu button again
2. Observe the collapse behavior

**Expected Result:**
- ✅ Submenu collapses smoothly with **reverse max-height animation** (0.3s ease)
- ✅ Chevron rotates back to point right "▸" (0deg)
- ✅ Submenu items disappear
- ✅ Menu button remains visible

**Console Check:**
```
[Guidance Dashboard v2] 📋 Submenu closed
```

### Test Scenario 2.3: Navigate to Section from Submenu

**Prerequisites:**
- Guidance Requests menu is expanded (from Test 2.1)

**Steps:**
1. Click "All Requests" submenu item
2. Verify section loads and menu behavior

**Expected Result:**
- ✅ "All Requests" section displays with guidance requests table
- ✅ Menu item shows active state (background highlights, text color changes to #667eea)
- ✅ Menu remains expanded after clicking submenu item
- ✅ Table rows have onclick handlers ready

### Test Scenario 2.4: Toggle Between Submenu Items

**Prerequisites:**
- Guidance Requests menu is expanded

**Steps:**
1. Click "Pending" submenu item
2. Verify section changes and menu state updates
3. Click "Completed" submenu item
4. Verify section changes again

**Expected Result:**
- ✅ Each submenu item updates the active menu styling
- ✅ Corresponding section displays with filtered data
- ✅ Menu remains expanded throughout
- ✅ Chevron stays pointing down (▼)

### Test Scenario 2.5: Menu Button Keyboard Accessibility

**Prerequisites:**
- Guidance Dashboard loaded
- Keyboard navigation enabled

**Steps:**
1. Use Tab key to navigate to "Guidance Requests" menu button
2. Verify button receives focus outline (2px solid #667eea)
3. Press Enter or Space to toggle submenu

**Expected Result:**
- ✅ Button shows clear focus indicator (outline)
- ✅ Submenu toggles with keyboard activation
- ✅ All keyboard interactions work smoothly

---

## Part 3: Integration Tests

### Test Scenario 3.1: Modal + Menu Interaction

**Prerequisites:**
- Guidance Dashboard loaded
- Guidance Requests menu visible

**Steps:**
1. Expand Guidance Requests menu (Test 2.1)
2. Navigate to a section by clicking submenu item (Test 2.3)
3. Open a request modal by clicking a table row (Test 1.1)
4. Verify modal displays correctly
5. Close modal (Test 1.3)
6. Verify menu is still in same state (expanded/collapsed as before)

**Expected Result:**
- ✅ Menu and modal interactions don't interfere
- ✅ Modal displays properly over menu
- ✅ Menu state preserved after modal close
- ✅ All animations smooth throughout

### Test Scenario 3.2: Update Request Status in Modal

**Prerequisites:**
- Request modal is open (Test 1.1)
- Request has "Pending" status

**Steps:**
1. Locate "Current Status" dropdown in modal
2. Change status to "Approved"
3. Set "Appointment Date" to a future date
4. Click "Save Changes" button
5. Verify API call is made and modal updates

**Expected Result:**
- ✅ Status dropdown is responsive
- ✅ Date input accepts valid dates
- ✅ "Save Changes" button triggers API PATCH call
- ✅ Successfully updated message appears (or error handling shows)

**Console Check:**
```
[Guidance Dashboard v2] ✅ Guidance request updated successfully
```

### Test Scenario 3.3: Send Message in Modal

**Prerequisites:**
- Request modal is open (Test 1.1)
- "Add Message" textarea visible

**Steps:**
1. Click in "Add Message" textarea
2. Type a test message: "This is a test message"
3. Verify "Visible to student" checkbox is checked
4. Click "Send Message" button
5. Observe message handling

**Expected Result:**
- ✅ Textarea accepts text input
- ✅ Checkbox is functional (can check/uncheck)
- ✅ "Send Message" button triggers API POST call
- ✅ Message sent confirmation appears
- ✅ Message History section updates with new message

**Console Check:**
```
[Guidance Dashboard v2] ✅ Message sent successfully
```

---

## Part 4: Cross-Browser Animation Test

### Test on Multiple Browsers

**Browsers to Test:**
- ✅ Chrome/Chromium (Edge, Brave, etc.)
- ✅ Firefox
- ✅ Safari (macOS/iOS)
- ✅ Mobile browsers

**Animations to Verify:**
1. **Modal slideIn** - translateY(-50px) → 0, opacity 0 → 1 (0.3s ease-out)
2. **Modal background fade** - opacity 0 → 1 (0.3s ease)
3. **Submenu maxHeight** - 0 → 500px (0.3s ease)
4. **Chevron rotation** - rotate(0deg) → rotate(90deg) (0.3s)
5. **Menu button click** - scale(1) → scale(0.98) (active state)

**Expected Result:**
- ✅ All animations smooth on all browsers
- ✅ No jank or stuttering observed
- ✅ CSS transitions work with browser-specific prefixes if needed
- ✅ No console errors in DevTools

---

## Part 5: Performance Verification

### Test Scenario 5.1: DOM Ready Timing

**Steps:**
1. Open DevTools console
2. Load Guidance Dashboard
3. Check console for initialization messages

**Expected Result:**
```
[Guidance Dashboard v2] ✅ Modal click listeners setup
[Guidance Dashboard v2] ✅ Menu button listeners setup
[Guidance Dashboard v2] ✅ JavaScript fully loaded and ready
```

### Test Scenario 5.2: Modal Data Loading Speed

**Steps:**
1. Open Request Details modal (Test 1.1)
2. Check Network tab in DevTools
3. Observe API call timing for request data fetch

**Expected Result:**
- ✅ API call completes within 500-1000ms
- ✅ Modal displays within 1 frame after data loads
- ✅ No visible delay between click and modal display
- ✅ Message history loads with request data

---

## Part 6: Accessibility Verification

### Test Scenario 6.1: Screen Reader Support

**Prerequisites:**
- Screen reader enabled (NVDA, JAWS, VoiceOver)

**Steps:**
1. Navigate to Guidance Requests menu
2. Use screen reader to read modal
3. Verify accessibility attributes

**Expected Result:**
- ✅ Modal has `role="dialog"` (screen readers announce as dialog)
- ✅ Modal has `aria-modal="true"` (indicates modal state)
- ✅ Modal title has `id="modalTitle"` and modal has `aria-labelledby="modalTitle"`
- ✅ Close button has `aria-label="Close modal"`
- ✅ All form labels properly associated with inputs

### Test Scenario 6.2: Keyboard Navigation

**Steps:**
1. Use Tab key to navigate menu buttons
2. Use Tab to navigate form fields in modal
3. Use Shift+Tab to navigate backwards
4. Use Enter/Space to activate buttons

**Expected Result:**
- ✅ All interactive elements receive focus (visible outline)
- ✅ Focus order is logical
- ✅ Buttons activatable with keyboard
- ✅ Modal closable with Escape key (if implemented)

---

## Part 7: Error Handling & Fallbacks

### Test Scenario 7.1: API Error Handling

**Prerequisites:**
- Guidance Dashboard loaded

**Steps:**
1. Open DevTools Network tab
2. Simulate network error (throttle to offline)
3. Try to open request modal
4. Observe error handling

**Expected Result:**
- ✅ Error caught in try/catch block
- ✅ User-friendly alert message displayed
- ✅ Console error logged with details
- ✅ Page doesn't crash

**Console Check:**
```
[Guidance Dashboard v2] ❌ Error opening request modal: {errorMessage}
```

### Test Scenario 7.2: Missing DOM Elements

**Steps:**
1. Open DevTools console
2. Manually remove modal element: `document.getElementById('requestModal').remove()`
3. Try to open request modal
4. Observe fallback behavior

**Expected Result:**
- ✅ Error caught and logged
- ✅ Console shows: "❌ Modal element not found"
- ✅ Alert shown to user
- ✅ No JavaScript crash

---

## Success Checklist

### Modal Display ✓
- [ ] Modal opens with slideIn animation (0.3s)
- [ ] Modal background fades in smoothly
- [ ] All request details populate correctly
- [ ] Message history displays with proper styling
- [ ] Close button works
- [ ] Background click closes modal
- [ ] Form fields are interactive
- [ ] No console errors

### Sidebar Menu ✓
- [ ] Submenu expands smoothly (0.3s max-height animation)
- [ ] Chevron rotates smoothly (0.3s)
- [ ] Submenu items display properly
- [ ] Submenu collapses smoothly
- [ ] Menu items are clickable
- [ ] Menu button shows focus/active states
- [ ] Keyboard navigation works
- [ ] No console errors

### Integration ✓
- [ ] Modal and menu don't interfere
- [ ] All animations smooth throughout
- [ ] API calls work correctly
- [ ] User can update request status
- [ ] User can send messages
- [ ] Error handling works properly
- [ ] Accessibility attributes present
- [ ] Cross-browser compatible

---

## Debugging Tips

### If Modal Doesn't Display:
1. Check console for errors: `[Guidance Dashboard v2]` messages
2. Verify modal element exists: `document.getElementById('requestModal')`
3. Verify CSS animation is loading: Check `<style>` section in HTML
4. Check if API endpoint is responding: Network tab in DevTools
5. Verify JavaScript loaded: `guidance-dashboard-v2.js` in Sources tab

### If Submenu Doesn't Expand:
1. Check console: Look for "📋 Submenu opened" message
2. Verify CSS transitions loaded with correct selector: `.submenu`
3. Check if menu-button class applied correctly
4. Verify JavaScript function: `toggleSubmenu(button)` exists and runs
5. Test in Chrome first (best CSS support)

### If Animations Are Janky:
1. Check for GPU acceleration: Use `transform: translateZ(0)` if needed
2. Verify CSS transition properties are correct
3. Check browser DevTools Performance tab for long frames
4. Try in different browser to isolate browser-specific issue
5. Check for competing CSS animations or events

### Enable Debug Logging:
Add to console to increase logging verbosity:
```javascript
localStorage.setItem('debugGuidance', 'true');
location.reload();
```

---

## Code Reference

### Key Functions Implemented:

**Modal Display:**
- `openRequestModal(requestId)` - Fetches request + messages, renders modal
- `closeModal(modalId)` - Removes .show class, hides modal
- `updateGuidanceRequest(requestId)` - Saves status changes
- `sendMessage(requestId)` - Posts new message

**Menu Expansion:**
- `toggleSubmenu(button)` - Expands/collapses submenu with animation
- `showSection(sectionId)` - Displays section content
- `setupModalAndMenuListeners()` - Attaches event listeners on DOMContentLoaded

**CSS Animations:**
- `.modal.show` - Displays with opacity fade
- `@keyframes slideIn` - Modal content slides down with fade
- `.submenu.show` - Expands with max-height animation
- `.chevron` - Rotates smoothly

---

## Support & Troubleshooting

**For Console Issues:**
Review the comprehensive logging in guidance-dashboard-v2.js. All major events log with emoji prefixes:
- 🔍 Information/Investigation
- ✅ Success
- ❌ Error
- ⚠️ Warning
- 📋 Menu/Section changes
- 🚪 Modal operations

**For CSS Issues:**
All inline styles are in guidance-dashboard.html:
- Lines 45-65: Menu button styling
- Lines 260-380: Modal styling and animations
- Search for `.modal` or `.submenu` to find relevant CSS

**For JavaScript Issues:**
All logic is in guidance-dashboard-v2.js:
- Lines 140-210: Submenu toggle function
- Lines 429-505: Request modal open function
- Lines 632-696: Modal close and listener setup

Generated: 2024
Last Updated: Guidance Dashboard v2 Enhancement - UI Improvements Complete


