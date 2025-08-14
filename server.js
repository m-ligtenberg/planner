const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'planner-data.json');

// Railway-specific configuration
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
}));

app.use(cors({
    origin: isProduction ? process.env.RAILWAY_PUBLIC_DOMAIN : '*',
    credentials: true
}));

app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Ensure data directory and file exist
async function initializeData() {
    try {
        await fs.ensureDir(path.dirname(DATA_FILE));
        await fs.access(DATA_FILE);
        console.log('Data file exists');
    } catch (error) {
        // File doesn't exist, create it
        const initialData = {
            unavailableDates: [],
            gioSelectedDates: [],
            confirmedPlans: [],
            recurringPatterns: [],
            appleCalendarConnected: false,
            lastUpdated: new Date().toISOString(),
            version: '1.0'
        };
        await fs.writeJson(DATA_FILE, initialData, { spaces: 2 });
        console.log('✅ Initialized data file');
    }
}

// Helper function to read data
async function readData() {
    try {
        const data = await fs.readJson(DATA_FILE);
        return data;
    } catch (error) {
        console.error('Error reading data:', error);
        throw new Error('Failed to read data');
    }
}

// Helper function to write data
async function writeData(data) {
    try {
        data.lastUpdated = new Date().toISOString();
        await fs.writeJson(DATA_FILE, data, { spaces: 2 });
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        throw new Error('Failed to write data');
    }
}

// Routes

// Serve main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check for Railway
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Space Planner API is running on Railway 🚀',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Get all planner data
app.get('/api/planner-data', async (req, res) => {
    try {
        const data = await readData();
        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Load error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to load planner data'
        });
    }
});

// Save all planner data
app.post('/api/planner-data', async (req, res) => {
    try {
        const { 
            unavailableDates, 
            gioSelectedDates, 
            confirmedPlans, 
            recurringPatterns, 
            appleCalendarConnected 
        } = req.body;

        // Validate required fields
        if (!Array.isArray(unavailableDates) || !Array.isArray(gioSelectedDates)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid data format - arrays required'
            });
        }

        const data = {
            unavailableDates: unavailableDates || [],
            gioSelectedDates: gioSelectedDates || [],
            confirmedPlans: confirmedPlans || [],
            recurringPatterns: recurringPatterns || [],
            appleCalendarConnected: appleCalendarConnected || false,
            version: '1.0'
        };

        await writeData(data);

        res.json({
            success: true,
            message: 'Planner data saved successfully',
            timestamp: data.lastUpdated
        });
    } catch (error) {
        console.error('Save error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to save planner data'
        });
    }
});

// Update unavailable dates only
app.put('/api/unavailable-dates', async (req, res) => {
    try {
        const { unavailableDates } = req.body;
        
        if (!Array.isArray(unavailableDates)) {
            return res.status(400).json({
                success: false,
                error: 'unavailableDates must be an array'
            });
        }

        const data = await readData();
        data.unavailableDates = unavailableDates;
        await writeData(data);

        res.json({
            success: true,
            message: 'Unavailable dates updated successfully',
            count: unavailableDates.length
        });
    } catch (error) {
        console.error('Update unavailable dates error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update unavailable dates'
        });
    }
});

// Update Gio's selected dates only
app.put('/api/gio-selections', async (req, res) => {
    try {
        const { gioSelectedDates } = req.body;
        
        if (!Array.isArray(gioSelectedDates)) {
            return res.status(400).json({
                success: false,
                error: 'gioSelectedDates must be an array'
            });
        }

        const data = await readData();
        data.gioSelectedDates = gioSelectedDates;
        await writeData(data);

        res.json({
            success: true,
            message: 'Gio selections updated successfully',
            count: gioSelectedDates.length
        });
    } catch (error) {
        console.error('Update Gio selections error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update Gio selections'
        });
    }
});

// Add confirmed plan
app.post('/api/confirmed-plans', async (req, res) => {
    try {
        const { activity, date, time, location, startTime, endTime } = req.body;
        
        if (!activity || !date) {
            return res.status(400).json({
                success: false,
                error: 'Activity and date are required'
            });
        }

        const data = await readData();
        const newPlan = {
            id: Date.now(),
            activity,
            date,
            time: time || 'TBD',
            location: location || '',
            startTime: startTime || '19:00',
            endTime: endTime || '21:00',
            confirmed: true,
            createdAt: new Date().toISOString()
        };

        data.confirmedPlans.push(newPlan);
        await writeData(data);

        res.json({
            success: true,
            message: 'Plan confirmed successfully',
            plan: newPlan
        });
    } catch (error) {
        console.error('Add plan error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to confirm plan'
        });
    }
});

// Delete confirmed plan
app.delete('/api/confirmed-plans/:id', async (req, res) => {
    try {
        const planId = parseInt(req.params.id);
        const data = await readData();
        
        const originalLength = data.confirmedPlans.length;
        data.confirmedPlans = data.confirmedPlans.filter(plan => plan.id !== planId);
        
        if (data.confirmedPlans.length === originalLength) {
            return res.status(404).json({
                success: false,
                error: 'Plan not found'
            });
        }

        await writeData(data);

        res.json({
            success: true,
            message: 'Plan deleted successfully'
        });
    } catch (error) {
        console.error('Delete plan error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete plan'
        });
    }
});

// Add recurring pattern
app.post('/api/recurring-patterns', async (req, res) => {
    try {
        const { type, day, dayName } = req.body;
        
        if (!type || day === undefined || !dayName) {
            return res.status(400).json({
                success: false,
                error: 'Type, day, and dayName are required'
            });
        }

        const data = await readData();
        const newPattern = {
            id: Date.now(),
            type,
            day: parseInt(day),
            dayName,
            description: `Every ${dayName} (${type})`,
            createdAt: new Date().toISOString()
        };

        data.recurringPatterns.push(newPattern);
        await writeData(data);

        res.json({
            success: true,
            message: 'Recurring pattern added successfully',
            pattern: newPattern
        });
    } catch (error) {
        console.error('Add pattern error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add recurring pattern'
        });
    }
});

// Delete recurring pattern
app.delete('/api/recurring-patterns/:id', async (req, res) => {
    try {
        const patternId = parseInt(req.params.id);
        const data = await readData();
        
        const originalLength = data.recurringPatterns.length;
        data.recurringPatterns = data.recurringPatterns.filter(pattern => pattern.id !== patternId);
        
        if (data.recurringPatterns.length === originalLength) {
            return res.status(404).json({
                success: false,
                error: 'Pattern not found'
            });
        }

        await writeData(data);

        res.json({
            success: true,
            message: 'Recurring pattern deleted successfully'
        });
    } catch (error) {
        console.error('Delete pattern error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete recurring pattern'
        });
    }
});

// Export data for backup
app.get('/api/export', async (req, res) => {
    try {
        const data = await readData();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="space-planner-backup-${new Date().toISOString().split('T')[0]}.json"`);
        res.json(data);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export data'
        });
    }
});

// Import data from backup
app.post('/api/import', async (req, res) => {
    try {
        const importedData = req.body;
        
        // Validate imported data structure
        if (!importedData.version || !Array.isArray(importedData.unavailableDates)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid backup file format'
            });
        }

        await writeData(importedData);

        res.json({
            success: true,
            message: 'Data imported successfully'
        });
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import data'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'API endpoint not found'
    });
});

// 404 handler for all other routes (serve index.html for SPA)
app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
async function startServer() {
    try {
        await initializeData();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Space Planner running on Railway!`);
            console.log(`📊 Port: ${PORT}`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`✅ Health check: /api/health`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    process.exit(0);
});
