// Global state management
let currentScreen = 'opening-screen';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let adminCurrentMonth = new Date().getMonth();
let adminCurrentYear = new Date().getFullYear();

// Authentication state
let isGioAuthenticated = false;
let isMichAuthenticated = false;
let currentUser = null; // 'gio' or 'mich'

// Data storage
let unavailableDates = new Set();
let gioSelectedDates = new Set();
let confirmedPlans = [];
let recurringPatterns = [];
let appleCalendarConnected = false;
let customActivities = [];

// User passwords (in production, this should be properly secured)
const GIO_PASSWORD = 'spaceman2024';
const MICH_PASSWORD = 'spaceman2024';

// API configuration - Railway backend URL
const API_BASE_URL = 'https://planner-planner-gio.up.railway.app/api';

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Space Planner initializing...');
    loadStoredData();
    initializeApp();
});

function initializeApp() {
    // Always start on login screen, clear any existing state
    currentScreen = 'login-screen';
    isGioAuthenticated = false;
    isMichAuthenticated = false;
    currentUser = null;
    
    // Clear any URL hash that might interfere
    if (window.location.hash) {
        window.history.replaceState(null, null, window.location.pathname);
    }
    
    showScreen('login-screen');
    renderCalendar();
    renderAdminCalendar();
    renderDashboard();
    renderCustomActivities();
    
    // Add Enter key support for activity input
    const activityInput = document.getElementById('custom-activity-input');
    if (activityInput) {
        activityInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addCustomActivity();
            }
        });
    }
    
    console.log('✅ Space Planner initialized');
}

// Screen management
function showScreen(screenId) {
    // Ensure we have a valid screen ID
    const targetScreen = document.getElementById(screenId);
    if (!targetScreen) {
        console.error(`Screen ${screenId} not found, defaulting to opening-screen`);
        screenId = 'opening-screen';
    }
    
    // Remove active class from all screens
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Add active class to target screen
    document.getElementById(screenId).classList.add('active');
    currentScreen = screenId;
    
    console.log(`Switched to screen: ${screenId}`);
}

function showCalendar() {
    showScreen('calendar-screen');
    renderCalendar();
}

// New authentication functions
function showLoginForm(user) {
    showScreen(user + '-login');
}

function validateUser(user) {
    const passwordInput = document.getElementById(user + '-password');
    const password = passwordInput.value;
    
    let isValid = false;
    if (user === 'gio' && password === GIO_PASSWORD) {
        isGioAuthenticated = true;
        currentUser = 'gio';
        isValid = true;
        showNotification('hey gio! welcome back', 'success');
        showScreen('gio-panel');
    } else if (user === 'mich' && password === MICH_PASSWORD) {
        isMichAuthenticated = true;
        currentUser = 'mich';
        isValid = true;
        showNotification('hey mich! welcome back', 'success');
        showScreen('mich-panel');
    } else {
        showNotification('nah, wrong password', 'error');
    }
    
    passwordInput.value = '';
}

function showGioPanel() {
    if (!isGioAuthenticated) {
        showNotification('you gotta login as gio first', 'error');
        showScreen('gio-login');
        return;
    }
    showScreen('gio-panel');
}

function showMichPanel() {
    if (!isMichAuthenticated) {
        showNotification('you gotta login as mich first', 'error');
        showScreen('mich-login');
        return;
    }
    showScreen('mich-panel');
}

function showDashboard() {
    showScreen('dashboard-screen');
    renderDashboard();
}

function goBack(screenId) {
    showScreen(screenId);
}

// Tab management
function showTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}-tab`).classList.add('active');
}

// API Integration Functions
async function saveStoredData() {
    const data = {
        unavailableDates: Array.from(unavailableDates),
        gioSelectedDates: Array.from(gioSelectedDates),
        confirmedPlans: confirmedPlans,
        recurringPatterns: recurringPatterns,
        appleCalendarConnected: appleCalendarConnected,
        customActivities: customActivities
    };
    
    try {
        console.log('💾 Saving data to Railway...');
        const response = await fetch(`${API_BASE_URL}/planner-data`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Data saved to Railway successfully');
            showNotification('Data saved successfully!', 'success');
        } else {
            throw new Error('Save failed');
        }
    } catch (error) {
        console.error('❌ API save failed:', error);
        showNotification('Failed to save data - using local storage', 'error');
        // Fallback to localStorage
        localStorage.setItem('spacePlannerData', JSON.stringify(data));
    }
}

async function loadStoredData() {
    try {
        console.log('📥 Loading data from Railway...');
        const response = await fetch(`${API_BASE_URL}/planner-data`);
        if (response.ok) {
            const result = await response.json();
            const data = result.data;
            
            unavailableDates = new Set(data.unavailableDates || []);
            gioSelectedDates = new Set(data.gioSelectedDates || []);
            confirmedPlans = data.confirmedPlans || [];
            recurringPatterns = data.recurringPatterns || [];
            appleCalendarConnected = data.appleCalendarConnected || false;
            customActivities = data.customActivities || [];
            
            console.log('✅ Data loaded from Railway successfully');
            showNotification('Data loaded from server', 'success');
            
            // Update UI based on stored data
            if (appleCalendarConnected) {
                setTimeout(() => {
                    const syncStatus = document.getElementById('sync-status');
                    const syncSettings = document.getElementById('sync-settings');
                    if (syncStatus && syncSettings) {
                        syncStatus.style.display = 'none';
                        syncSettings.style.display = 'block';
                    }
                }, 100);
            }
            
            setTimeout(() => {
                renderPatterns();
            }, 100);
        } else {
            throw new Error('Load failed');
        }
    } catch (error) {
        console.error('❌ API load failed:', error);
        showNotification('Using local data', 'error');
        // Fallback to localStorage
        const stored = localStorage.getItem('spacePlannerData');
        if (stored) {
            const data = JSON.parse(stored);
            unavailableDates = new Set(data.unavailableDates || []);
            gioSelectedDates = new Set(data.gioSelectedDates || []);
            confirmedPlans = data.confirmedPlans || [];
            recurringPatterns = data.recurringPatterns || [];
            appleCalendarConnected = data.appleCalendarConnected || false;
        }
    }
}

// Quick save functions for specific updates
async function saveUnavailableDates() {
    try {
        const response = await fetch(`${API_BASE_URL}/unavailable-dates`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                unavailableDates: Array.from(unavailableDates)
            })
        });
        
        if (!response.ok) throw new Error('Failed to save unavailable dates');
    } catch (error) {
        console.error('Failed to save unavailable dates:', error);
    }
}

async function saveGioSelections() {
    try {
        const response = await fetch(`${API_BASE_URL}/gio-selections`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                gioSelectedDates: Array.from(gioSelectedDates)
            })
        });
        
        if (!response.ok) throw new Error('Failed to save Gio selections');
    } catch (error) {
        console.error('Failed to save Gio selections:', error);
    }
}

async function addConfirmedPlan(planDetails) {
    try {
        const response = await fetch(`${API_BASE_URL}/confirmed-plans`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(planDetails)
        });
        
        if (response.ok) {
            const result = await response.json();
            return result.plan;
        } else {
            throw new Error('Failed to add confirmed plan');
        }
    } catch (error) {
        console.error('Failed to add confirmed plan:', error);
        return null;
    }
}

// Calendar rendering
function renderCalendar() {
    const calendarGrid = document.getElementById('calendar-grid');
    const monthYearDisplay = document.getElementById('calendar-month-year');
    
    if (!calendarGrid || !monthYearDisplay) return;
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    
    monthYearDisplay.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    calendarGrid.innerHTML = '';
    
    // Add day headers
    const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayHeaders.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'calendar-day-header';
        dayHeader.textContent = day;
        dayHeader.style.fontWeight = 'bold';
        dayHeader.style.color = '#667eea';
        dayHeader.style.padding = '10px';
        dayHeader.style.textAlign = 'center';
        calendarGrid.appendChild(dayHeader);
    });
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day other-month';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        dayElement.textContent = day;
        
        const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Apply styling based on availability and selections
        if (unavailableDates.has(dateString)) {
            dayElement.classList.add('admin-unavailable');
        } else if (gioSelectedDates.has(dateString)) {
            dayElement.classList.add('gio-selected');
        } else {
            dayElement.classList.add('both-available');
        }
        
        dayElement.addEventListener('click', () => handleDateClick(dateString, dayElement));
        
        calendarGrid.appendChild(dayElement);
    }
}

function renderAdminCalendar() {
    const adminCalendar = document.getElementById('admin-calendar');
    const monthYearDisplay = document.getElementById('admin-month-year');
    
    if (!adminCalendar || !monthYearDisplay) return;
    
    const firstDay = new Date(adminCurrentYear, adminCurrentMonth, 1);
    const lastDay = new Date(adminCurrentYear, adminCurrentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    
    monthYearDisplay.textContent = `${monthNames[adminCurrentMonth]} ${adminCurrentYear}`;
    
    adminCalendar.innerHTML = '';
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'admin-calendar-day other-month';
        adminCalendar.appendChild(emptyDay);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'admin-calendar-day';
        dayElement.textContent = day;
        
        const dateString = `${adminCurrentYear}-${String(adminCurrentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (unavailableDates.has(dateString)) {
            dayElement.classList.add('unavailable');
        } else {
            dayElement.classList.add('available');
        }
        
        dayElement.addEventListener('click', () => toggleAvailability(dateString, dayElement));
        
        adminCalendar.appendChild(dayElement);
    }
}

// Calendar navigation
function changeCalendarMonth(direction) {
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
}

function changeMonth(direction) {
    adminCurrentMonth += direction;
    if (adminCurrentMonth < 0) {
        adminCurrentMonth = 11;
        adminCurrentYear--;
    } else if (adminCurrentMonth > 11) {
        adminCurrentMonth = 0;
        adminCurrentYear++;
    }
    renderAdminCalendar();
}

// Date handling
function handleDateClick(dateString, element) {
    if (unavailableDates.has(dateString)) {
        showNotification('This date is not available', 'error');
        return;
    }
    
    // Simulate Gio selecting a date
    if (gioSelectedDates.has(dateString)) {
        gioSelectedDates.delete(dateString);
        element.classList.remove('gio-selected');
        element.classList.add('both-available');
        showNotification('Date deselected by Gio', 'success');
    } else {
        gioSelectedDates.add(dateString);
        element.classList.remove('both-available');
        element.classList.add('gio-selected');
        showNotification('Date selected by Gio!', 'success');
    }
    
    saveGioSelections();
    renderDashboard();
}

function toggleAvailability(dateString, element) {
    if (unavailableDates.has(dateString)) {
        unavailableDates.delete(dateString);
        element.classList.remove('unavailable');
        element.classList.add('available');
    } else {
        unavailableDates.add(dateString);
        element.classList.remove('available');
        element.classList.add('unavailable');
        
        // Remove from Gio's selections if it was selected
        if (gioSelectedDates.has(dateString)) {
            gioSelectedDates.delete(dateString);
        }
    }
    
    saveUnavailableDates();
    renderCalendar();
}

// Admin functions
function clearAllUnavailable() {
    unavailableDates.clear();
    renderAdminCalendar();
    renderCalendar();
    showNotification('All dates cleared', 'success');
    saveUnavailableDates();
}

function saveAvailability() {
    applyRecurringPatterns();
    saveStoredData();
    renderCalendar();
    showNotification('Availability saved successfully!', 'success');
}

// Recurring patterns
async function addPattern() {
    const type = document.getElementById('pattern-type').value;
    const day = parseInt(document.getElementById('pattern-day').value);
    
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const patternData = {
        type: type,
        day: day,
        dayName: dayNames[day]
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/recurring-patterns`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(patternData)
        });
        
        if (response.ok) {
            const result = await response.json();
            recurringPatterns.push(result.pattern);
            renderPatterns();
            applyRecurringPatterns();
            showNotification('Pattern added successfully!', 'success');
        } else {
            throw new Error('Failed to add pattern');
        }
    } catch (error) {
        console.error('Failed to add pattern:', error);
        showNotification('Failed to add pattern', 'error');
    }
}

async function removePattern(patternId) {
    try {
        const response = await fetch(`${API_BASE_URL}/recurring-patterns/${patternId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            recurringPatterns = recurringPatterns.filter(pattern => pattern.id !== patternId);
            renderPatterns();
            showNotification('Pattern removed', 'success');
        } else {
            throw new Error('Failed to remove pattern');
        }
    } catch (error) {
        console.error('Failed to remove pattern:', error);
        showNotification('Failed to remove pattern', 'error');
    }
}

function renderPatterns() {
    const patternsList = document.getElementById('patterns-list');
    if (!patternsList) return;
    
    patternsList.innerHTML = '';
    
    recurringPatterns.forEach(pattern => {
        const patternElement = document.createElement('div');
        patternElement.className = 'pattern-item';
        patternElement.innerHTML = `
            <span>${pattern.description}</span>
            <button onclick="removePattern(${pattern.id})">Remove</button>
        `;
        patternsList.appendChild(patternElement);
    });
}

function applyRecurringPatterns() {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // One year ahead
    
    recurringPatterns.forEach(pattern => {
        let currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            if (currentDate.getDay() === pattern.day) {
                const dateString = currentDate.toISOString().split('T')[0];
                unavailableDates.add(dateString);
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    });
}

// Apple Calendar integration
function connectAppleCalendar() {
    // Simulate connection (in real implementation, this would use proper OAuth)
    appleCalendarConnected = true;
    document.getElementById('sync-status').style.display = 'none';
    document.getElementById('sync-settings').style.display = 'block';
    showNotification('Apple Calendar connected successfully!', 'success');
    saveStoredData();
}

function disconnectCalendar() {
    appleCalendarConnected = false;
    document.getElementById('sync-status').style.display = 'block';
    document.getElementById('sync-settings').style.display = 'none';
    showNotification('Apple Calendar disconnected', 'success');
    saveStoredData();
}

function manualSync() {
    // Simulate manual sync
    showNotification('Calendar synchronized!', 'success');
}

// Dashboard rendering
function renderDashboard() {
    renderMutualTimes();
    renderConfirmedPlans();
}

function renderMutualTimes() {
    const mutualTimesList = document.getElementById('mutual-times-list');
    if (!mutualTimesList) return;
    
    mutualTimesList.innerHTML = '';
    
    const availableDates = Array.from(gioSelectedDates).filter(date => {
        return !unavailableDates.has(date) && new Date(date) >= new Date();
    });
    
    if (availableDates.length === 0) {
        mutualTimesList.innerHTML = '<p>No mutual times available yet. Wait for Gio to select some dates!</p>';
        return;
    }
    
    availableDates.forEach(dateString => {
        const date = new Date(dateString);
        const timeSlot = document.createElement('div');
        timeSlot.className = 'time-slot';
        timeSlot.innerHTML = `
            <div>
                <strong>${date.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</strong>
                <p>Perfect time for planning something together!</p>
            </div>
            <button onclick="confirmDate('${dateString}')" class="cosmic-btn" style="padding: 8px 16px; font-size: 0.9rem;">
                Confirm Plans
            </button>
        `;
        mutualTimesList.appendChild(timeSlot);
    });
}

function renderConfirmedPlans() {
    const confirmedPlansList = document.getElementById('confirmed-plans-list');
    if (!confirmedPlansList) return;
    
    confirmedPlansList.innerHTML = '';
    
    if (confirmedPlans.length === 0) {
        confirmedPlansList.innerHTML = '<p>No confirmed plans yet. Start by confirming some mutual available times!</p>';
        return;
    }
    
    confirmedPlans.forEach((plan, index) => {
        const planElement = document.createElement('div');
        planElement.className = 'confirmed-event';
        planElement.innerHTML = `
            <div class="event-details">
                <h3>${plan.activity}</h3>
                <p>📅 ${new Date(plan.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                })}</p>
                <p>🕒 ${plan.time || 'Time TBD'}</p>
                <p>📍 ${plan.location || 'Location TBD'}</p>
            </div>
            <div class="event-actions">
                <button class="add-to-calendar-btn" onclick="addToAppleCalendar(this)" 
                        data-activity="${plan.activity}"
                        data-date="${plan.date}"
                        data-start-time="${plan.startTime || '19:00'}"
                        data-end-time="${plan.endTime || '21:00'}"
                        data-location="${plan.location || ''}"
                        data-notes="Planned through Space Planner with Gio">
                    <span class="btn-icon">📅</span>
                    Add to Apple Calendar
                </button>
            </div>
        `;
        confirmedPlansList.appendChild(planElement);
    });
}

// Activity management
async function confirmDate(dateString, suggestedActivity = null) {
    const activity = suggestedActivity || prompt('What would you like to do on this date?') || 'Hangout';
    const time = prompt('What time? (e.g., 7:00 PM)') || 'Evening';
    const location = prompt('Where? (optional)') || '';
    
    const planDetails = {
        activity: activity,
        date: dateString,
        time: time,
        location: location,
        startTime: '19:00',
        endTime: '21:00'
    };
    
    const savedPlan = await addConfirmedPlan(planDetails);
    
    if (savedPlan) {
        confirmedPlans.push(savedPlan);
        gioSelectedDates.delete(dateString);
        
        await saveGioSelections();
        renderDashboard();
        renderCalendar();
        
        showNotification(`${activity} confirmed for ${new Date(dateString).toLocaleDateString()}!`, 'success');
    } else {
        showNotification('Failed to confirm plan', 'error');
    }
}

// Custom Activities Management
function addCustomActivity() {
    const input = document.getElementById('custom-activity-input');
    const activityName = input.value.trim();
    
    if (!activityName) {
        showNotification('Please enter an activity name', 'error');
        return;
    }
    
    if (customActivities.includes(activityName)) {
        showNotification('This activity already exists', 'error');
        return;
    }
    
    customActivities.push(activityName);
    input.value = '';
    renderCustomActivities();
    saveStoredData();
    showNotification(`"${activityName}" added! let's do it`, 'success');
}

function removeCustomActivity(activityName) {
    const index = customActivities.indexOf(activityName);
    if (index > -1) {
        customActivities.splice(index, 1);
        renderCustomActivities();
        saveStoredData();
        showNotification(`"${activityName}" removed ✨`, 'success');
    }
}

function renderCustomActivities() {
    const container = document.getElementById('custom-activities-list');
    if (!container) return;
    
    if (customActivities.length === 0) {
        container.innerHTML = '<p style="color: rgba(255,255,255,0.6); font-style: italic;">no ideas yet... add some above!</p>';
        return;
    }
    
    container.innerHTML = customActivities.map(activity => `
        <div class="custom-activity-tag" onclick="suggestActivity('${activity}')">
            <span>${activity}</span>
            <button class="remove-activity" onclick="event.stopPropagation(); removeCustomActivity('${activity}')" title="Remove activity">×</button>
        </div>
    `).join('');
}

function suggestActivity(activityName) {
    const availableDates = Array.from(gioSelectedDates).filter(date => {
        return !unavailableDates.has(date) && new Date(date) >= new Date();
    });
    
    if (availableDates.length === 0) {
        showNotification('No available dates to suggest activities for', 'error');
        return;
    }
    
    const randomDate = availableDates[Math.floor(Math.random() * availableDates.length)];
    confirmDate(randomDate, activityName);
}

// Apple Calendar export functions
function createCalendarEvent(eventDetails) {
    const startDate = new Date(eventDetails.date + 'T' + eventDetails.startTime);
    const endDate = new Date(eventDetails.date + 'T' + eventDetails.endTime);
    
    const formatDate = (date) => {
        return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Space Planner Railway//EN',
        'BEGIN:VEVENT',
        `DTSTART:${formatDate(startDate)}`,
        `DTEND:${formatDate(endDate)}`,
        `SUMMARY:Plans with Gio: ${eventDetails.activity}`,
        `DESCRIPTION:${eventDetails.notes || 'Planned through Space Planner'}`,
        `LOCATION:${eventDetails.location || ''}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Reminder',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
    
    return icsContent;
}

function downloadCalendarEvent(eventDetails) {
    const icsContent = createCalendarEvent(eventDetails);
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `space-planner-${eventDetails.activity.replace(/\s+/g, '-').toLowerCase()}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

function addToAppleCalendar(button) {
    if (button.classList.contains('added')) return;
    
    const eventDetails = {
        activity: button.dataset.activity,
        date: button.dataset.date,
        startTime: button.dataset.startTime,
        endTime: button.dataset.endTime,
        location: button.dataset.location,
        notes: button.dataset.notes
    };
    
    downloadCalendarEvent(eventDetails);
    
    button.classList.add('added');
    button.innerHTML = '<span class="btn-icon">✅</span>Added to Calendar';
    
    showNotification('Event added to Apple Calendar!', 'success');
}

// Data management functions
async function exportData() {
    try {
        const response = await fetch(`${API_BASE_URL}/export`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `space-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            showNotification('Data exported successfully!', 'success');
        } else {
            throw new Error('Export failed');
        }
    } catch (error) {
        console.error('Export error:', error);
        showNotification('Export failed', 'error');
    }
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const data = JSON.parse(e.target.result);
                
                const response = await fetch(`${API_BASE_URL}/import`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    await loadStoredData();
                    renderCalendar();
                    renderAdminCalendar();
                    renderDashboard();
                    renderPatterns();
                    
                    showNotification('Data imported successfully!', 'success');
                } else {
                    throw new Error('Import failed');
                }
            } catch (error) {
                console.error('Import error:', error);
                showNotification('Failed to import data', 'error');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

async function clearAllData() {
    if (confirm('Are you sure you want to clear ALL data? This cannot be undone!')) {
        unavailableDates.clear();
        gioSelectedDates.clear();
        confirmedPlans = [];
        recurringPatterns = [];
        appleCalendarConnected = false;
        
        await saveStoredData();
        
        renderCalendar();
        renderAdminCalendar();
        renderDashboard();
        renderPatterns();
        
        showNotification('All data cleared', 'success');
    }
}

async function testConnection() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (response.ok) {
            const result = await response.json();
            document.getElementById('sync-info-text').textContent = `✅ ${result.message}`;
            showNotification('Connection successful!', 'success');
        } else {
            throw new Error('Connection failed');
        }
    } catch (error) {
        document.getElementById('sync-info-text').textContent = '❌ Connection failed';
        showNotification('Connection test failed', 'error');
    }
}

// Notification system
function showNotification(message, type = 'success') {
    const container = document.getElementById('notification-container') || document.body;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'linear-gradient(135deg, #4caf50 0%, #45a049 100%)' : 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)'};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 1001;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    
    container.appendChild(notification);
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// Modal functions
function closePlanModal() {
    document.getElementById('plan-modal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('plan-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Initialize patterns display when page loads
setTimeout(() => {
    renderPatterns();
}, 500);
