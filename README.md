# LDT 2.0 SaaS Lab Results System

A comprehensive laboratory results management system built with Node.js, Express, and Prisma, designed to be compatible with LDT 2.0 (German KBV laboratory data standard) and integrated with Mirth Connect.

## Features

- **LDT 2.0 Compatible**: Database schema follows German KBV laboratory data standard
- **Mirth Connect Integration**: RESTful API endpoints for seamless integration
- **Complete Lab Workflow**: Manage patients, orders, and results
- **Secure API**: API key authentication for external integrations
- **Real-time Data**: Support for real-time lab result updates

## Database Schema

The system includes the following main entities:

- **Users**: Doctors and laboratories (with BSNR/LANR)
- **Patients**: Patient demographics and insurance information
- **Lab Orders**: Order management with sender/receiver tracking
- **Lab Results**: Individual test results with reference values
- **API Keys**: Secure authentication for Mirth Connect

## API Endpoints

### Core Endpoints

- `GET /health` - Health check
- `GET /users` - List all users
- `POST /users` - Create new user
- `GET /patients` - List all patients
- `POST /patients` - Create new patient
- `GET /patients/:id` - Get patient details
- `GET /lab-orders` - List lab orders (with filters)
- `POST /lab-orders` - Create new lab order
- `GET /lab-orders/:id` - Get lab order details
- `PATCH /lab-orders/:id/status` - Update order status

### Mirth Connect Integration

- `POST /api/mirth-webhook` - Receive lab data from Mirth Connect
- `GET /api/mirth-export/:orderId` - Export order data for Mirth Connect
- `POST /api/keys` - Create API keys
- `GET /api/keys` - List API keys

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up database:**
   ```bash
   npm run db:migrate
   ```

3. **Seed with sample data:**
   ```bash
   npm run db:seed
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

## Mirth Connect Integration

### Inbound (Mirth → Your API)

Configure Mirth Connect to send lab results to your webhook:

**URL:** `POST /api/mirth-webhook`
**Headers:** 
- `Content-Type: application/json`
- `x-api-key: mk_mirth_connect_2025_secure_key_123`

**Sample Payload:**
```json
{
  "bsnr": "987654321",
  "orderNumber": "ORD2025001003",
  "patient": {
    "firstName": "Max",
    "lastName": "Mustermann",
    "birthDate": "1985-03-10",
    "gender": "M"
  },
  "results": [
    {
      "parameterCode": "8311",
      "parameterName": "Hämoglobin",
      "resultValue": "14.2",
      "unit": "g/dL",
      "referenceMin": "12.0",
      "referenceMax": "17.0",
      "resultDate": "2025-01-17T09:00:00.000Z",
      "abnormalFlag": "N"
    }
  ],
  "status": "final"
}
```

### Outbound (Your API → Mirth)

Export lab data in LDT 2.0 format:

**URL:** `GET /api/mirth-export/:orderId`
**Headers:** `x-api-key: your-api-key`

## Sample Data

The seed script creates:

- **Doctor**: Dr. Max Mustermann (BSNR: 123456789)
- **Lab**: Medizin Labor GmbH (BSNR: 987654321)
- **Patients**: Erika Musterfrau, Hans Schmidt
- **Lab Orders**: Complete orders with multiple test results
- **API Key**: `mk_mirth_connect_2025_secure_key_123`

## Security

- API key authentication for external integrations
- Password hashing with bcrypt
- Input validation and error handling
- CORS support for web applications

## LDT 2.0 Compliance

The database schema maps to LDT 2.0 data structure types (DSK):

- **DSK 8210/8220**: Lab orders (Auftrag)
- **DSK 8310/8320**: Patient data (Patientendaten)
- **DSK 8410-8470**: Lab results (Einzelbefund)
- **Reference values**: Normal ranges and abnormal flags

## Environment Variables

Create a `.env` file with:

```env
DATABASE_URL="your-database-connection-string"
PORT=5000
```

## Development

- **Database migrations**: `npm run db:migrate`
- **Generate Prisma client**: `npm run prisma:generate`
- **Reset database**: `npx prisma migrate reset`
- **View database**: `npx prisma studio`

## Support

This system provides a solid foundation for laboratory data management with German healthcare standards compliance and Mirth Connect integration capabilities.