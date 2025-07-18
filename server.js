const express = require("express");
const cors = require("cors");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

// Middleware for API key authentication
const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: "API key required" });
  }
  
  try {
    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey, isActive: true }
    });
    
    if (!key) {
      return res.status(403).json({ error: "Invalid API key" });
    }
    
    req.apiKey = key;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
};

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// ===== USER ENDPOINTS =====

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, bsnr: true, lanr: true, name: true, email: true, role: true }
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new user
app.post("/users", async (req, res) => {
  try {
    const { password, ...userData } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: { ...userData, password: hashedPassword },
      select: { id: true, bsnr: true, lanr: true, name: true, email: true, role: true }
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PATIENT ENDPOINTS =====

// Get all patients
app.get("/patients", async (req, res) => {
  try {
    const patients = await prisma.patient.findMany({
      include: {
        _count: {
          select: { labOrders: true }
        }
      }
    });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new patient
app.post("/patients", async (req, res) => {
  try {
    const patient = await prisma.patient.create({ 
      data: {
        ...req.body,
        birthDate: new Date(req.body.birthDate)
      }
    });
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get patient by ID
app.get("/patients/:id", async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        labOrders: {
          include: {
            sender: { select: { name: true } },
            receiver: { select: { name: true } },
            labResults: true
          }
        }
      }
    });
    
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    
    res.json(patient);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LAB ORDER ENDPOINTS =====

// Get all lab orders
app.get("/lab-orders", async (req, res) => {
  try {
    const { status, senderId, receiverId } = req.query;
    const where = {};
    
    if (status) where.status = status;
    if (senderId) where.senderId = Number(senderId);
    if (receiverId) where.receiverId = Number(receiverId);
    
    const orders = await prisma.labOrder.findMany({
      where,
      include: {
        patient: true,
        sender: { select: { name: true, bsnr: true } },
        receiver: { select: { name: true, bsnr: true } },
        labResults: true,
        _count: {
          select: { labResults: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new lab order
app.post("/lab-orders", async (req, res) => {
  try {
    const order = await prisma.labOrder.create({
      data: {
        orderNumber: req.body.orderNumber,
        orderDate: new Date(req.body.orderDate),
        senderId: req.body.senderId,
        receiverId: req.body.receiverId,
        patientId: req.body.patientId,
        status: req.body.status || "pending",
        comment: req.body.comment,
        priority: req.body.priority || "normal",
        labResults: {
          create: req.body.labResults?.map(result => ({
            ...result,
            resultDate: new Date(result.resultDate)
          })) || []
        }
      },
      include: {
        patient: true,
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
        labResults: true
      }
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single lab order by ID
app.get("/lab-orders/:id", async (req, res) => {
  try {
    const order = await prisma.labOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        patient: true,
        sender: { select: { name: true, bsnr: true, lanr: true } },
        receiver: { select: { name: true, bsnr: true, lanr: true } },
        labResults: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: "Lab order not found" });
    }
    
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update lab order status
app.patch("/lab-orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await prisma.labOrder.update({
      where: { id: Number(req.params.id) },
      data: { status },
      include: {
        patient: true,
        sender: { select: { name: true } },
        receiver: { select: { name: true } },
        labResults: true
      }
    });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LAB RESULT ENDPOINTS =====

// Create lab result for an order
app.post("/lab-orders/:id/lab-results", async (req, res) => {
  try {
    const result = await prisma.labResult.create({
      data: {
        ...req.body,
        labOrderId: Number(req.params.id),
        resultDate: new Date(req.body.resultDate)
      }
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all lab results for a single order
app.get("/lab-orders/:id/lab-results", async (req, res) => {
  try {
    const results = await prisma.labResult.findMany({
      where: { labOrderId: Number(req.params.id) },
      orderBy: { createdAt: 'asc' }
    });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== MIRTH CONNECT INTEGRATION ENDPOINTS =====

// Webhook endpoint for Mirth Connect to send lab data
app.post('/api/mirth-webhook', authenticateApiKey, async (req, res) => {
  try {
    const { bsnr, lanr, orderNumber, patient, results, status = "final" } = req.body;
    
    // Find or create user (lab/sender)
    let sender = await prisma.user.findUnique({ where: { bsnr } });
    if (!sender) {
      return res.status(404).json({ error: "Sender BSNR not found" });
    }
    
    // Find or create patient
    let patientRecord = await prisma.patient.findFirst({
      where: {
        firstName: patient.firstName,
        lastName: patient.lastName,
        birthDate: new Date(patient.birthDate)
      }
    });
    
    if (!patientRecord) {
      patientRecord = await prisma.patient.create({
        data: {
          ...patient,
          birthDate: new Date(patient.birthDate)
        }
      });
    }
    
    // Find or create lab order
    let labOrder = await prisma.labOrder.findUnique({
      where: { orderNumber }
    });
    
    if (!labOrder) {
      // Create new order - need to find receiver
      const receiver = await prisma.user.findFirst({
        where: { role: "doctor" } // Default to first doctor, adjust logic as needed
      });
      
      if (!receiver) {
        return res.status(404).json({ error: "No receiver found" });
      }
      
      labOrder = await prisma.labOrder.create({
        data: {
          orderNumber,
          orderDate: new Date(),
          senderId: sender.id,
          receiverId: receiver.id,
          patientId: patientRecord.id,
          status
        }
      });
    }
    
    // Create lab results
    const createdResults = [];
    for (const result of results) {
      const labResult = await prisma.labResult.create({
        data: {
          ...result,
          labOrderId: labOrder.id,
          resultDate: new Date(result.resultDate)
        }
      });
      createdResults.push(labResult);
    }
    
    // Update order status
    await prisma.labOrder.update({
      where: { id: labOrder.id },
      data: { status }
    });
    
    res.json({
      success: true,
      orderId: labOrder.id,
      resultsCreated: createdResults.length
    });
    
  } catch (error) {
    console.error('Mirth webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to get data for Mirth Connect (outbound)
app.get('/api/mirth-export/:orderId', authenticateApiKey, async (req, res) => {
  try {
    const order = await prisma.labOrder.findUnique({
      where: { id: Number(req.params.orderId) },
      include: {
        patient: true,
        sender: true,
        receiver: true,
        labResults: true
      }
    });
    
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    
    // Format for LDT 2.0 export
    const ldtExport = {
      header: {
        orderNumber: order.orderNumber,
        orderDate: order.orderDate,
        status: order.status,
        sender: {
          bsnr: order.sender.bsnr,
          lanr: order.sender.lanr,
          name: order.sender.name
        },
        receiver: {
          bsnr: order.receiver.bsnr,
          lanr: order.receiver.lanr,
          name: order.receiver.name
        }
      },
      patient: {
        insuranceNo: order.patient.insuranceNo,
        lastName: order.patient.lastName,
        firstName: order.patient.firstName,
        birthDate: order.patient.birthDate,
        gender: order.patient.gender,
        address: order.patient.address,
        zipCode: order.patient.zipCode,
        city: order.patient.city
      },
      results: order.labResults.map(result => ({
        parameterCode: result.parameterCode,
        parameterName: result.parameterName,
        resultValue: result.resultValue,
        unit: result.unit,
        referenceMin: result.referenceMin,
        referenceMax: result.referenceMax,
        resultDate: result.resultDate,
        abnormalFlag: result.abnormalFlag,
        comment: result.comment,
        method: result.method
      }))
    };
    
    res.json(ldtExport);
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== API KEY MANAGEMENT =====

// Create API key (admin only)
app.post('/api/keys', async (req, res) => {
  try {
    const { name, permissions = ["read"] } = req.body;
    const key = `mk_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    const apiKey = await prisma.apiKey.create({
      data: { name, key, permissions }
    });
    
    res.json(apiKey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List API keys
app.get('/api/keys', async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      select: { id: true, name: true, isActive: true, permissions: true, createdAt: true }
    });
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Lab API running at http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});