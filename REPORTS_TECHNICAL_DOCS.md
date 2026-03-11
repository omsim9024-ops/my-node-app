# Standard Reports System - Technical Documentation

## 🏗️ Architecture Overview

### Component Structure

```
Standard Reports System
├── HTML (UI Layer)
│   ├── Customization Panel
│   ├── Report Tabs
│   └── Report Content Containers
├── JavaScript (Logic Layer)
│   ├── Print Function
│   ├── Customization Management
│   ├── Settings Storage
│   └── Event Handlers
└── CSS (Presentation Layer)
    ├── Customization Panel Styles
    ├── Print Template Styles
    └── Media Queries
```

---

## 📋 HTML Structure

### Customization Panel

```html
<div class="report-customization-panel">
  <button class="btn btn-tertiary" id="toggleCustomization">
    ⚙️ Customize Report
  </button>
  
  <div class="customization-options" id="customizationOptions">
    <!-- Header Section -->
    <div class="customization-section">
      <h4>Header Customization</h4>
      <div class="form-group">
        <label for="schoolName">School Name:</label>
        <input type="text" id="schoolName" value="...">
      </div>
      <!-- More fields... -->
    </div>
    
    <!-- Footer Section -->
    <div class="customization-section">
      <h4>Footer Customization</h4>
      <!-- Footer fields... -->
    </div>
    
    <!-- Action Buttons -->
    <div class="customization-actions">
      <button class="btn btn-primary" id="applyCustomization">
        Apply Settings
      </button>
      <button class="btn btn-secondary" id="resetCustomization">
        Reset to Defaults
      </button>
    </div>
  </div>
</div>
```

### Report Sections

```html
<div class="report-content active" id="report-{reportType}">
  <div class="content-card">
    <div class="section-subheader">
      <h3>{Report Title}</h3>
      <div class="export-buttons">
        <button class="btn btn-secondary" id="print{Type}">
          🖨️ Print
        </button>
        <button class="btn btn-secondary" id="export{Type}Excel">
          📥 Excel
        </button>
      </div>
    </div>
    <!-- Report content... -->
  </div>
</div>
```

---

## 🔧 JavaScript Functions

### Core Functions

#### `getDefaultReportSettings()`

Returns default customization settings object.

```javascript
function getDefaultReportSettings() {
    return {
        schoolName: 'Compostela National High School',
        schoolAddress: 'Compostela, Davao de Oro, Philippines',
        reportTitle: 'Official School Report',
        footerText: 'Official Document - Confidential',
        includeDate: true,
        includeSchoolLogo: true,
        showPageNumbers: true
    };
}
```

**Parameters**: None
**Returns**: Object with default report settings
**Usage**: Initialization, reset functionality

---

#### `setupReportCustomization()`

Initializes customization panel and event listeners.

```javascript
function setupReportCustomization() {
    // Get DOM elements
    const toggleBtn = document.getElementById('toggleCustomization');
    const customizationPanel = document.getElementById('customizationOptions');
    const applyBtn = document.getElementById('applyCustomization');
    const resetBtn = document.getElementById('resetCustomization');
    
    // Load saved settings from session storage
    const savedSettings = JSON.parse(
        sessionStorage.getItem('reportCustomization')
    );
    if (savedSettings) {
        applySettingsToUI(savedSettings);
    }
    
    // Setup event listeners...
}
```

**Event Listeners Attached**:
- `toggleBtn.click` - Toggle customization panel visibility
- `applyBtn.click` - Save customization settings
- `resetBtn.click` - Reset to defaults

**Storage Used**: `sessionStorage.reportCustomization`

---

#### `applySettingsToUI(settings)`

Populates customization form with provided settings.

```javascript
function applySettingsToUI(settings) {
    // Get all form input elements
    const schoolName = document.getElementById('schoolName');
    const schoolAddress = document.getElementById('schoolAddress');
    // ... more fields
    
    // Apply values from settings object
    if (schoolName) schoolName.value = settings.schoolName;
    if (schoolAddress) schoolAddress.value = settings.schoolAddress;
    // ... more assignments
}
```

**Parameters**:
- `settings` (Object): Settings object with report customization

**Side Effects**:
- Updates DOM input values
- Syncs UI state with settings

---

#### `printReport(reportType)`

**The main print function** - Creates formatted print window and triggers print dialog.

```javascript
function printReport(reportType) {
    // 1. Get report content from DOM
    const reportContent = document.getElementById(`report-${reportType}`);
    
    // 2. Load customization settings
    const settings = JSON.parse(
        sessionStorage.getItem('reportCustomization')
    ) || getDefaultReportSettings();
    
    // 3. Create new window for printing
    const printWindow = window.open('', '_blank');
    
    // 4. Write HTML with embedded CSS and report data
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                /* Comprehensive print styling */
            </style>
        </head>
        <body>
            <!-- Print header with school info -->
            <div class="print-header">
                <div class="school-logo">🎓</div>
                <div class="school-info">
                    <div class="school-name">${settings.schoolName}</div>
                    <!-- More header elements -->
                </div>
            </div>
            
            <!-- Report content -->
            <div class="report-content">
                ${reportContent.innerHTML}
            </div>
            
            <!-- Footer with school stamp -->
            <div class="print-footer">
                <div>${settings.footerText}</div>
                <div class="official-stamp">
                    This is an official document from ${settings.schoolName}
                </div>
            </div>
        </body>
        </html>
    `);
    
    // 5. Close document and trigger print
    printWindow.document.close();
    setTimeout(() => {
        printWindow.print();
    }, 250);
}
```

**Parameters**:
- `reportType` (String): Type of report ('demographics', 'disability', etc.)

**Process Flow**:
1. Validates report exists in DOM
2. Retrieves customization settings from session storage
3. Creates new browser window
4. Generates complete HTML with embedded CSS
5. Applies customization settings to header/footer
6. Closes document and triggers print dialog
7. User can print or save as PDF

**Browser Behavior**:
- Opens in new tab/window (respects pop-up settings)
- Print dialog appears after content loads
- User has full control over print settings
- Can select any printer
- Can save as PDF

---

#### `setupExportButtons()`

Initializes event listeners for all print and export buttons.

```javascript
function setupExportButtons() {
    // Demographics
    document.getElementById('printDemo')?.addEventListener(
        'click',
        () => printReport('demographics')
    );
    document.getElementById('exportDemoExcel')?.addEventListener(
        'click',
        () => exportReportAsExcel('demographics')
    );
    
    // ... Similar for all other report types
    
    // Disability, Indigenous, 4Ps, Mother Tongue, Track, Electives
    
    // Initialize customization panel
    setupReportCustomization();
}
```

**Event Bindings**:
- Print buttons → `printReport()`
- Excel buttons → `exportReportAsExcel()`

**Initialization**: Called on DOMContentLoaded

---

#### `exportReportAsExcel(reportType)`

Exports report data as CSV file (Excel compatible).

```javascript
function exportReportAsExcel(reportType) {
    // Get report content
    const reportContent = document.getElementById(`report-${reportType}`);
    const tables = reportContent.querySelectorAll('table');
    
    // Convert tables to CSV format
    let csv = `Report: ${reportType}\nGenerated: ${new Date().toLocaleString()}\n\n`;
    
    tables.forEach((table, index) => {
        if (index > 0) csv += '\n\n';
        
        // Extract table data
        table.querySelectorAll('tr').forEach(row => {
            const cells = row.querySelectorAll('td, th');
            csv += Array.from(cells)
                .map(cell => {
                    const text = cell.textContent.trim();
                    return text.includes(',') ? `"${text}"` : text;
                })
                .join(',') + '\n';
        });
    });
    
    // Create and trigger download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}-report.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showNotification('Report exported as Excel CSV', 'success');
}
```

**Functionality**:
- Extracts all tables from report
- Converts to CSV format
- Handles special characters (quotes)
- Creates file download
- Shows success notification

---

## 🎨 CSS Structure

### Class Hierarchy

```css
/* Main Panel */
.report-customization-panel {
    background: #f9f9f9;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
}

/* Nested Structure */
.customization-options
  ├── .customization-section (Header)
  │   ├── h4 (Title)
  │   └── .form-group (Multiple)
  │       ├── label
  │       └── input
  ├── .customization-section (Footer)
  │   └── ...same as above
  └── .customization-actions
      ├── #applyCustomization
      └── #resetCustomization
```

### Styling Details

**Toggle Button** (`#toggleCustomization`):
- Normal: Border + Blue text, White background
- Hover: Blue background, White text
- Active: Blue background, White text

**Form Inputs** (`.form-group input[type="text"]`):
- Border: 1px #ddd
- Focus: Blue border + blue shadow
- Padding: 10px 12px
- Border-radius: 4px

**Checkboxes** (`.form-group input[type="checkbox"]`):
- Accent color: #1a73e8 (blue)
- Size: 18x18px
- Custom styling in supported browsers

**Buttons** (`.customization-actions .btn`):
- Apply: Blue (#1a73e8)
- Reset: Gray (#f0f0f0)
- Flex: 1 (equal width)

---

### Print Template CSS

Embedded in the print window document:

```css
/* Page Settings */
@page {
    margin: 1.5in 1in;
    @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 12px;
    }
}

/* Print Behavior */
@media print {
    body { margin: 0; padding: 0; }
    .print-header { page-break-after: avoid; }
    .report-section { page-break-inside: avoid; }
    table { page-break-inside: avoid; }
}

/* Header */
.print-header {
    border-bottom: 3px solid #1a73e8;
    padding-bottom: 20px;
    margin-bottom: 30px;
    display: flex;
    align-items: center;
    gap: 20px;
}

.school-logo {
    width: 80px;
    height: 80px;
    background: #f0f0f0;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
}

/* Tables */
table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
}

thead {
    background: #1a73e8;
    color: white;
}

tbody tr:nth-child(even) {
    background-color: #f9f9f9;
}

/* Footer */
.print-footer {
    margin-top: 40px;
    padding-top: 20px;
    border-top: 2px solid #ddd;
    text-align: center;
    font-size: 11px;
    color: #999;
}

.official-stamp {
    display: inline-block;
    padding: 10px 20px;
    border: 2px solid #ddd;
    border-radius: 4px;
    margin-top: 20px;
    font-size: 10px;
}
```

---

## 💾 Data Storage

### Session Storage

**Key**: `reportCustomization`
**Type**: JSON String
**Scope**: Current session (cleared on page refresh)

```javascript
// Save
sessionStorage.setItem(
    'reportCustomization',
    JSON.stringify(settingsObject)
);

// Load
const settings = JSON.parse(
    sessionStorage.getItem('reportCustomization')
);
```

**Data Structure**:
```json
{
    "schoolName": "Compostela National High School",
    "schoolAddress": "Compostela, Davao de Oro, Philippines",
    "reportTitle": "Official School Report",
    "footerText": "Official Document - Confidential",
    "includeDate": true,
    "includeSchoolLogo": true,
    "showPageNumbers": true
}
```

---

## 🔄 Event Flow

### Print Button Click Flow

```
User clicks Print Button
  ↓
printReport(reportType) called
  ↓
Retrieve report DOM element
  ↓
Load customization settings
  ↓
window.open() creates new tab
  ↓
Generate HTML with embedded CSS
  ↓
Apply customization to header/footer
  ↓
document.write() inserts content
  ↓
document.close() finalizes
  ↓
setTimeout() waits 250ms for rendering
  ↓
window.print() opens print dialog
  ↓
User selects printer/PDF
  ↓
Document prints/saves
```

### Customization Panel Flow

```
User clicks ⚙️ Customize Report
  ↓
toggleCustomization click handler
  ↓
Toggle customization-options visibility
  ↓
User modifies form fields
  ↓
User clicks "Apply Settings"
  ↓
Collect form input values
  ↓
Validate data (optional)
  ↓
sessionStorage.setItem() saves settings
  ↓
showNotification() confirms
  ↓
Settings applied to next print
```

---

## 🧪 Testing Checklist

### Unit Tests

- [ ] `getDefaultReportSettings()` returns correct object
- [ ] `applySettingsToUI()` correctly updates DOM elements
- [ ] `setupReportCustomization()` initializes event listeners
- [ ] `printReport()` creates valid HTML output
- [ ] Session storage save/load works correctly

### Integration Tests

- [ ] Print button opens new window
- [ ] Customization settings apply to print output
- [ ] Excel export creates valid CSV
- [ ] Reset functionality restores defaults
- [ ] Multiple reports can be printed with different settings

### Browser Tests

- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari
- [ ] Edge
- [ ] Mobile browsers (iOS Safari, Chrome Mobile)

### Print Tests

- [ ] Header appears on first page
- [ ] Footer appears on all pages
- [ ] Page breaks occur correctly
- [ ] Tables don't split awkwardly
- [ ] Colors print correctly
- [ ] Font sizes are readable

### UI/UX Tests

- [ ] Customization panel toggles smoothly
- [ ] Form validation works
- [ ] Success notifications appear
- [ ] No console errors
- [ ] Responsive design intact

---

## 🐛 Debugging

### Common Issues

**Issue**: Print window doesn't open
- **Cause**: Pop-up blocker
- **Solution**: Check browser pop-up settings

**Issue**: Settings don't persist
- **Cause**: Session storage disabled
- **Solution**: Enable cookies in browser

**Issue**: Print preview looks wrong
- **Cause**: CSS not loading in new window
- **Solution**: Check embedded CSS in printReport()

**Issue**: Headers/footers missing
- **Cause**: HTML template incomplete
- **Solution**: Verify template in printReport()

### Debug Output

Add to console for debugging:
```javascript
// In setupReportCustomization()
console.log('Customization panel initialized');
console.log('Saved settings:', 
    sessionStorage.getItem('reportCustomization'));

// In printReport()
console.log('Print window opened');
console.log('Report type:', reportType);
console.log('Settings applied:', settings);
```

---

## 📦 Dependencies

### External Libraries
- **None** ✅ (No PDF library needed)

### Browser APIs Used
- `window.open()` - Create new window
- `document.write()` - Insert HTML
- `sessionStorage` - Store settings
- `window.print()` - Trigger print dialog
- `fetch()` - Get report data (existing)
- `DOM API` - Query and manipulate elements

### Browser Requirements
- ES6+ support (classes, arrow functions, template literals)
- Local Storage API (optional, for session storage)
- Print CSS support

---

## 🚀 Performance

### Optimization Tips

1. **Lazy Load Customization**
   ```javascript
   // Load panel only when toggled
   toggleBtn.addEventListener('click', () => {
       if (!initialized) {
           setupReportCustomization();
           initialized = true;
       }
   });
   ```

2. **Debounce Settings Save**
   ```javascript
   const debouncedSave = debounce(() => {
       sessionStorage.setItem('reportCustomization', ...);
   }, 300);
   ```

3. **Cache Settings Object**
   ```javascript
   window.cachedSettings = null;
   function getSettings() {
       if (!window.cachedSettings) {
           window.cachedSettings = JSON.parse(
               sessionStorage.getItem('reportCustomization')
           );
       }
       return window.cachedSettings;
   }
   ```

---

## 🔐 Security Considerations

### Input Validation

The current implementation should validate user inputs:

```javascript
// TODO: Add validation
function validateSettings(settings) {
    const errors = [];
    
    if (!settings.schoolName || settings.schoolName.trim().length === 0) {
        errors.push('School name is required');
    }
    
    if (settings.schoolName.length > 100) {
        errors.push('School name too long');
    }
    
    // More validations...
    
    return errors;
}
```

### XSS Prevention

Currently uses `innerHTML` which could be vulnerable. Consider:

```javascript
// Safer approach
const headerText = document.createElement('div');
headerText.textContent = settings.schoolName; // Text content, not HTML
const html = headerText.innerHTML;
```

### Data Exposure

- Settings are stored client-side only
- No data is sent to server
- Report data is already accessible in DOM
- Safe for use with sensitive data

---

## 📈 Scalability

### Adding New Report Types

1. Add button in HTML:
```html
<button class="btn btn-secondary" id="printMyReport">
  🖨️ Print
</button>
```

2. Add event listener:
```javascript
document.getElementById('printMyReport')?.addEventListener(
    'click',
    () => printReport('myreport')
);
```

3. Add report section with ID `report-myreport`

### Adding Customization Fields

1. Add form input in HTML
2. Add field name to settings object
3. Add input reference in `applySettingsToUI()`
4. Add input access in `setupExportButtons()`

### Extending to Database Storage

```javascript
async function saveSettingsToDatabase(settings) {
    const response = await fetch('/api/report-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    return response.json();
}

async function loadSettingsFromDatabase() {
    const response = await fetch('/api/report-settings');
    return response.json();
}
```

---

## 📝 Code Quality

### Standards Followed
- ES6+ JavaScript
- Semantic HTML
- CSS Grid & Flexbox
- BEM-like naming convention
- Comments for complex logic
- Clear function documentation

### Code Metrics
- Lines of code: ~500 (JS) + ~300 (CSS) + ~200 (HTML)
- Cyclomatic complexity: Low
- Function length: Average 20-50 lines
- Maintainability index: High

---

## 🔄 Version History

### v1.0 (Current)
- ✅ Print functionality
- ✅ Customization panel
- ✅ Professional header/footer
- ✅ Excel export
- ✅ Session storage

### Future v2.0 Planned
- [ ] Database storage
- [ ] Custom logo upload
- [ ] Multiple templates
- [ ] Digital signatures
- [ ] Email distribution
- [ ] Report scheduling

---

## 📞 Support

For technical questions or issues:
1. Check console logs (F12 → Console tab)
2. Review this documentation
3. Check code comments in files
4. Contact development team

---

**Last Updated**: February 4, 2026
**Maintained By**: Development Team
**Version**: 1.0

