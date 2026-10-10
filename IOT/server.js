const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

const app = express();

// Middleware
app.use(express.json());

// Enhanced CORS Middleware allowing ngrok skip header and preflight OPTIONS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, ngrok-skip-browser-warning'
  );

  // Instantly return 204 No Content for CORS preflight checks
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// In-memory data store
let latestSensorData = {
  temperature: null,
  humidity: null,
  timestamp: null,
  status: 'offline'
};

// Update 'COM13' to match your ESP32 port if necessary
const PORT_NAME = 'COM13';
const BAUD_RATE = 9600;

const port = new SerialPort({ path: PORT_NAME, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// Listen for USB Serial lines from ESP32
parser.on('data', (line) => {
  try {
    const parsedData = JSON.parse(line);
    latestSensorData = {
      temperature: parsedData.temperature,
      humidity: parsedData.humidity,
      timestamp: new Date().toISOString(),
      status: 'online'
    };
    console.log('[ESP32 -> BACKEND]', latestSensorData);
  } catch (err) {
    // Ignores non-JSON debug text from Serial
  }
});

// Port error handling
port.on('error', (err) => {
  console.error('Serial Port Error: ', err.message);
  latestSensorData.status = 'error';
});

// --- API ENDPOINTS ---

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    service: 'ESP32 Sensor Backend API',
    status: 'running',
    endpoints: {
      getLatestData: '/api/data'
    }
  });
});

// Main data endpoint
app.get('/api/data', (req, res) => {
  res.status(200).json(latestSensorData);
});

// Start Express server on IPv4 loopback
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API active at http://127.0.0.1:${PORT}`);
});