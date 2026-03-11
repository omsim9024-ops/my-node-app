# Student Enrollment Form - Implementation Guide

## Overview
The enrollment form is a comprehensive multi-step form system that allows students to submit their enrollment details for Compostela National High School.

## Files Created

### 1. enrollment-form.html
- **Purpose**: Main enrollment form structure
- **Features**:
  - Sticky navigation bar with school logo and name
  - Back to Dashboard button
  - 12 form sections with logical organization
  - Conditional field visibility based on user input
  - Review modal for final submission confirmation
  - Responsive design for all devices

### 2. enrollment-form.css
- **Purpose**: Complete styling and animations
- **Features**:
  - Sticky navbar styling
  - Form section hierarchy with visual separation
  - Modal animations (fadeIn, slideUp)
  - Radio/checkbox group styling with accent colors
  - Responsive grid layouts (desktop, tablet, mobile)
  - Certification and privacy boxes styling
  - Form validation visual feedback

### 3. enrollment-form.js
- **Purpose**: Dynamic form behavior and logic
- **Features**:
  - Conditional field visibility handlers
  - Elective selection logic for three tracks
  - Address auto-copy functionality
  - Form validation
  - Review modal population
  - Data persistence with localStorage

## Form Structure & Sections

### Section 1: Learner Reference Number (LRN)
- **Fields**: Yes/No radio buttons
- **Conditional**: LRN number input appears when "Yes" selected
- **Type**: Optional

### Section 2: Returning Learner/Transferee
- **Fields**: Yes/No radio buttons
- **Conditional**: Shows when "Yes":
  - Grade Level Previously Attended
  - School Year
  - School ID/Name
- **Type**: Optional

### Section 3: Learner Information (Required)
- **Fields**:
  - Last Name, First Name, Middle Name, Extension Name
  - Date of Birth (auto-calculates age)
  - Age (auto-populated)
  - Sex (Male/Female)
  - Place of Birth
  - Mother Tongue

### Section 4: IP (Indigenous People) Status
- **Fields**: Yes/No radio buttons
- **Conditional**: When "Yes", shows:
  - IP Group dropdown
  - "Other" option triggers text input
- **Type**: Optional

### Section 5: 4Ps Beneficiary
- **Fields**: Yes/No radio buttons
- **Conditional**: When "Yes", shows:
  - Household ID field
- **Type**: Optional

### Section 6: PWD (Person with Disability)
- **Fields**: Yes/No radio buttons
- **Conditional**: When "Yes", shows:
  - Multiple disability checkboxes
- **Type**: Optional

### Section 7: Grade Level & Track Selection
- **Fields**:
  - Grade Level (7-12) dropdown
  - **For Grade 11-12 only**:
    - Semester (1st Semester / 2nd Semester)
    - Track Selection (Academic / Tech-Pro / Doorway)
    - Electives (dynamic based on track)
- **Elective Selection Logic**:
  - **Academic Track**: Select up to 2 academic electives
  - **Tech-Pro Track**: Select 1 Tech-Pro elective
  - **Doorway Track**: Select 1 academic + 1 Tech-Pro elective

### Section 8: Electives
- **Dynamic Content**: Populated based on track selection
- **Categories**:
  - **Academic Electives**:
    - Arts, Social Sciences, & Humanities (14 subjects)
    - Business & Entrepreneurship (5 subjects)
    - Sports, Health, & Wellness (8 subjects)
    - Science, Technology, Engineering, & Mathematics (17 subjects)
    - Field Experience (6 subjects)
  - **Tech-Pro Electives**:
    - Information & Computer Technology (9 programs)
    - Industrial Arts (14 programs)
    - Agriculture & Fishery Arts (9 programs)
    - Family & Consumer Science (13 programs)
    - Maritime (3 programs)

### Section 9: Current Address (Required)
- **Fields**:
  - Sitio/Street Name
  - Barangay
  - Municipality
  - Province
  - Country (pre-filled: Philippines)
  - Zip Code

### Section 10: Permanent Address
- **Fields**: Same as current address
- **Feature**: "Same as Current Address" checkbox auto-copies current address

### Section 11: Parent/Guardian Information (Optional)
- **Fields**:
  - Name
  - Relationship
  - Contact Number
  - Occupation

### Section 12: Learning Modality (Required)
- **Options**:
  1. Face-to-face
  2. Blended Learning (Online and Face-to-face)
  3. Fully Online
  4. Modular Distance Learning
  5. TV-based Learning
  6. Radio-based Learning
  7. Print-based Learning

### Section 13: Certification & Data Privacy
- **Fields**:
  - Certification checkbox (required)
  - Data Privacy Agreement checkbox (required)

## JavaScript Functions

### Initialization
- `DOMContentLoaded` event: Sets up all event listeners and conditional logic

### Conditional Field Management
- `setupConditionalFields()`: Initializes all conditional field handlers
- Individual handlers for: LRN, Returning Learner, IP, 4Ps, PWD, Grade Level

### Elective Management
- `updateElectives()`: Triggered when track or semester changes
- `renderAcademicElectives()`: Renders academic track electives
- `renderTechProElectives()`: Renders tech-pro track electives
- `renderDoorwayElectives()`: Renders both academic and tech-pro for doorway track

### Validation Functions
- `validateAcademicElectives()`: Max 2 selections
- `validateTechProElectives()`: Max 1 selection
- `validateDoorwayElectives()`: Max 1 of each type

### Address Functions
- `setupAddressSync()`: Sets up the checkbox listener
- `copyCurrentToPermanentAddress()`: Copies current address to permanent fields

### Form Submission
- `setupFormValidation()`: Initializes submit button listener
- `validateAndSubmit()`: Main validation function
- `showReviewModal()`: Displays summary for review
- `collectFormData()`: Gathers all form input values

### Modal Management
- `setupModal()`: Initializes modal buttons
- `showReviewModal()`: Shows review modal with summary
- `closeReviewModal()`: Closes the modal
- `generateSummaryHTML()`: Creates summary content from form data
- `submitEnrollment()`: Saves to localStorage and redirects

## Data Flow

1. **Student accesses dashboard** → Clicks "Enroll Now" button
2. **Enrollment form loads** → JavaScript initializes all event listeners
3. **Student fills form** → Conditional fields appear/hide based on selections
4. **Electives dynamically load** → Based on grade level and track selection
5. **Form validation** → On submit button click
6. **Review modal** → Shows summary of enrollment data
7. **Data saved** → Stored in localStorage under 'enrollments' key
8. **Confirmation** → Success message and redirect to dashboard

## localStorage Data Structure

```javascript
{
    enrollments: [
        {
            studentID: "STU001",
            studentName: "John Doe",
            enrollmentDate: "2024-01-15T10:30:00.000Z",
            status: "pending",
            enrollmentData: {
                hasLRN: "yes",
                lrn: "123456789012",
                returningLearner: "no",
                firstName: "John",
                lastName: "Doe",
                // ... all form fields
            }
        }
    ]
}
```

## Validation Rules

### Required Fields
- First Name, Last Name
- Date of Birth
- Sex
- Place of Birth
- Current Address (Barangay, Municipality, Province)
- Learning Modality
- Certification checkbox

### Grade 11-12 Additional Requirements
- Semester
- Track
- At least 1 elective (based on track rules)

### Elective Requirements
- **Academic Track**: 1-2 electives
- **Tech-Pro Track**: Exactly 1 elective
- **Doorway Track**: 1 academic + 1 tech-pro elective

## Styling Classes

### Form Elements
- `.form-section`: Main section container
- `.form-group`: Individual input group
- `.form-row`: Two-column layout for inputs
- `.radio-group`: Radio button container
- `.checkbox-group`: Checkbox container
- `.radio-label` / `.checkbox-label`: Individual label styling

### Modals
- `.modal`: Modal overlay
- `.modal.active`: Active/visible modal
- `.modal-content`: Modal content container
- `.modal-header`: Header section
- `.modal-body`: Main content
- `.modal-footer`: Footer with buttons

### Buttons
- `.btn.btn-primary`: Primary action button
- `.btn.btn-secondary`: Secondary action button

## Responsive Design Breakpoints

- **Desktop**: 1024px and above
- **Tablet**: 768px to 1023px
- **Mobile**: 480px to 767px
- **Small Mobile**: Below 480px

## Navigation

- **Back to Dashboard**: Top right button in navbar
- **Enroll Now**: Located in student dashboard header
- **After Submission**: Automatic redirect to student-dashboard.html

## Future Enhancements

1. **Backend Integration**:
   - POST endpoint: `/api/students/enrollment`
   - Validation on server side
   - Database storage

2. **Email Notifications**:
   - Confirmation email to student
   - Notification to admin for review

3. **Progress Saving**:
   - Auto-save form progress
   - Resume incomplete enrollments

4. **File Upload**:
   - Attachment of documents
   - Photo ID upload

5. **Multi-language Support**:
   - Filipino translations
   - Language selector

## Testing Checklist

- [ ] All conditional fields appear/hide correctly
- [ ] LRN field shows when "Yes" selected
- [ ] Returning learner fields show when "Yes" selected
- [ ] IP fields show when "Yes" selected, and "Other" text field appears
- [ ] 4Ps field shows when "Yes" selected
- [ ] PWD fields show when "Yes" selected
- [ ] Senior high fields (semester, track, electives) show for grades 11-12
- [ ] Electives populate correctly for Academic track
- [ ] Electives populate correctly for Tech-Pro track
- [ ] Electives populate correctly for Doorway track
- [ ] Max 2 electives enforcement for Academic track
- [ ] Max 1 elective enforcement for Tech-Pro track
- [ ] Max 1 of each type for Doorway track
- [ ] Address auto-copy works when checkbox is checked
- [ ] Form validates all required fields
- [ ] Review modal shows correct summary
- [ ] Data saves to localStorage
- [ ] Redirect to dashboard after submission
- [ ] Responsive design works on mobile, tablet, desktop

## Support

For issues or questions about the enrollment form implementation, refer to:
- enrollment-form.html: Form structure
- enrollment-form.css: Styling details
- enrollment-form.js: Logic and functionality


