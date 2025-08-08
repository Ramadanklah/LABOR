# Labor Results Web App

A comprehensive full-stack web application for managing and viewing laboratory results, built with React frontend and Node.js/Express backend. The system supports German LDT (Labor Daten Transfer) standard for laboratory data exchange and integrates with Mirth Connect for real-time data ingestion.

## 🚀 Features

### Core Functionality
- **Secure Authentication**: Multi-factor login with BSNR, LANR, and password
- **Role-Based Access Control**: Different permissions for different user types
- **Results Dashboard**: View laboratory results in an organized, responsive table format
- **Advanced Search & Filter**: Search by patient name or result ID, filter by status and type
- **Real-time Updates**: Refresh functionality to get latest results
- **Responsive Design**: Modern UI built with Tailwind CSS

### Download & Export Features
- **LDT Format**: Export results as LDT (German laboratory standard)
- **PDF Reports**: Generate professional laboratory reports
- **Individual & Bulk Downloads**: Download single results or all filtered results
- **Batch Processing**: Process multiple results simultaneously

### Mirth Connect Integration
- **Webhook Endpoint**: Receive laboratory data from Mirth Connect
- **LDT Message Processing**: Parse and store incoming LDT XML messages
- **Real-time Data Ingestion**: Process data as it arrives
- **Message Validation**: Validate incoming LDT format
- **Error Handling**: Comprehensive error handling for malformed messages

### Security & Performance
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Compression**: Response compression for better performance
- **Caching**: Intelligent caching for improved response times
- **Logging**: Comprehensive logging with Winston

## 📁 Project Structure

```
labor-results-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.jsx
│   │   │   └── ResultsDashboard.jsx
│   │   ├── utils/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                 # Node.js/Express backend
│   ├── server.js          # Main server file
│   ├── models/
│   │   └── User.js
│   ├── utils/
│   │   ├── ldtGenerator.js
│   │   ├── ldtParser.js
│   │   └── pdfGenerator.js
│   ├── db/
│   ├── logs/
│   └── package.json
├── scripts/               # Utility scripts
├── docker-compose.prod.yml
├── Dockerfile
├── .env.example
├── start-dev.sh
├── start-dev.bat
└── README.md
```

## 🛠️ Prerequisites

- **Node.js**: v18 or higher
- **npm**: v8 or higher
- **Git**: For version control
- **Docker**: For production deployment (optional)
- **PostgreSQL**: For production database (optional)

## 🚀 Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd labor-results-app
```

### 2. Environment Configuration

Copy the environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Development Environment Configuration
NODE_ENV=development
PORT=5000

# JWT Configuration (REQUIRED for authentication)
JWT_SECRET=your-super-secure-jwt-secret-here-minimum-256-bits
JWT_EXPIRATION=24h

# Logging
LOG_LEVEL=info

# Lab Information (for reports/documents)
LAB_NAME=Your Laboratory Results System
LAB_STREET=Medical Center Street 1
LAB_ZIP=12345
LAB_CITY=Medical City
LAB_PHONE=+49-123-456789
LAB_EMAIL=info@your-lab.com

# Database Configuration (for PostgreSQL)
DATABASE_URL=postgresql://labuser:secure_password@localhost:5432/lab_results

# Redis Configuration (if using caching)
REDIS_URL=redis://localhost:6379

# Frontend Configuration
FRONTEND_URL=http://localhost:3000
```

### 3. Backend Setup

```bash
cd server
npm install
npm start
```

The backend server will start on http://localhost:5000

### 4. Frontend Setup

Open a new terminal window:

```bash
cd client
npm install
npm run dev
```

The Vite development server will start on http://localhost:3000

### 5. Quick Start (Both Servers)

Use the convenience script to start both servers at once:

**Linux/Mac:**
```bash
chmod +x start-dev.sh
./start-dev.sh
```

**Windows:**
```batch
start-dev.bat
```

This will start both backend and frontend servers simultaneously.

## 🔐 Persistent Authentication & Users (New)

- Database-backed `User` model managed via Prisma
- Passwords are stored as bcrypt hashes (cost 12)
- JWT issued with claims: `sub` (userId), `role`, `iat`, `exp`

Required env vars:

```
JWT_SECRET=your-super-secure-jwt-secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
```

Prisma:

```
# Generate client
npx prisma generate --schema=prisma/schema.prisma

# Create/apply migrations (dev)
npx prisma migrate dev --schema=prisma/schema.prisma --name add_user_model
```

Seeding admin (dev/staging):

```
cd server
SEED_ADMIN_EMAIL=admin@example.com SEED_ADMIN_PASSWORD='StrongPass123!' npm run seed:admin
```

## 🛡️ Admin API (protected)

- POST `/api/admin/users` — create user
- GET `/api/admin/users` — list users (pagination + filters)
- GET `/api/admin/users/:id` — get user
- PUT `/api/admin/users/:id` — update user
- DELETE `/api/admin/users/:id` — delete user
- GET `/api/admin/roles` — list roles

Authentication:

- POST `/api/auth/login` — email + password
- GET `/api/auth/me`
- POST `/api/auth/logout`

Notes:

- Legacy demo login and UI were removed from production build
- Rate limiting active on `/api/auth/login`
- Ensure HTTPS in production and strong `JWT_SECRET`

## 📊 API Endpoints

### Authentication Endpoints

#### POST `/api/login`
Authenticate user with BSNR, LANR, and password.

**Request Body:**
```json
{
  "bsnr": "123456789",
  "lanr": "1234567", 
  "password": "securepassword"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Results Endpoints

#### GET `/api/results`
Retrieve all laboratory results for authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "res001",
      "date": "2023-01-15",
      "type": "Blood Count",
      "status": "Final",
      "patient": "Max Mustermann",
      "bsnr": "123456789",
      "lanr": "1234567",
      "tests": [
        {
          "name": "Hemoglobin",
          "value": "14.2",
          "unit": "g/dL",
          "referenceRange": "13.5-17.5"
        }
      ]
    }
  ]
}
```

### Mirth Connect Integration

#### POST `/api/mirth-webhook`
Receive laboratory data from Mirth Connect in LDT format.

**Headers:** `Content-Type: text/plain` or `application/xml`

**Request Body:** LDT format (supports both XML and line-based formats)

**XML Format (Legacy):**
```xml
<column1>0278000921818LABOR_RESULTS_V2.1</column1>
<column1>022800091032024XXXXX</column1>
<column1>022800091042230000</column1>
```

**Line-based Format (Current):**
```
01380008230
014810000204
0199212LDT1014.01
0180201798115000
0220203Labor Potsdam
0260205Charlottenstr. 72
```

**Response:**
```json
{
  "success": true,
  "messageId": "uuid-12345",
  "recordCount": 3,
  "message": "LDT message processed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "No valid LDT XML payload detected"
}
```

### Download Endpoints

#### GET `/api/download/ldt`
Download all results as LDT format (German laboratory standard).

**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file download (application/octet-stream)
**Filename:** `lab_results_YYYY-MM-DD.ldt`

#### GET `/api/download/pdf`
Download all results as PDF report.

**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file download (application/pdf)
**Filename:** `lab_results_YYYY-MM-DD.pdf`

#### GET `/api/download/ldt/:resultId`
Download specific result as LDT format.

**Parameters:** `resultId` - The ID of the result to download
**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file download (application/octet-stream)
**Filename:** `result_RESULTID_YYYY-MM-DD.ldt`

#### GET `/api/download/pdf/:resultId`
Download specific result as PDF report.

**Parameters:** `resultId` - The ID of the result to download
**Headers:** `Authorization: Bearer <token>`

**Response:** Binary file download (application/pdf)
**Filename:** `result_RESULTID_YYYY-MM-DD.pdf`

### Health Check

#### GET `/api/health`
Check server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2023-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

## 🔧 LDT Message Processing

### LDT Format Specification

The system processes LDT (Labor Daten Transfer) messages according to the German standard:

#### Supported Formats
- **Line-based Format**: Each line is a separate LDT record (current standard)
- **XML Format**: Legacy format with `<column1>` tags (backward compatibility)

#### Record Types
- **8000**: Header record (software version, creation date/time)
- **8100**: Practice/Lab identification
- **8200**: Patient data
- **8300**: Request data
- **8400**: Result data
- **8500**: Footer record

#### Message Structure
Each LDT record follows this format:
```
[LENGTH][RECORD_TYPE][FIELD_ID][CONTENT]
```

**Standard Records (11+ characters):**
```
01380008230
014810000204
0199212LDT1014.01
```

**Short Records (8 characters):**
```
01091064
0108609K
01031091
```

**Field ID Types:**
- Numeric: `8230`, `0020`, `9218`
- Alphanumeric: `LDT1`, `KLEM`, `V001`
- Special characters: `*IMA` (for image paths)

### Mirth Connect Integration

#### Configuration in Mirth Connect

1. **Create HTTP Sender Channel**
   - **URL**: `http://your-server:5000/api/mirth-webhook`
   - **Method**: POST
   - **Content Type**: `text/plain` or `application/xml`

2. **Message Template**
   ```xml
   <column1>${message.encodedData}</column1>
   ```

3. **Error Handling**
   - Configure retry logic for failed requests
   - Set appropriate timeout values
   - Monitor response codes

#### Message Processing Flow

1. **Reception**: Webhook receives LDT XML payload
2. **Validation**: System validates XML structure and LDT format
3. **Parsing**: LDT parser extracts individual records
4. **Storage**: Records are stored in database
5. **Response**: Success/error response sent back to Mirth Connect

#### Error Handling

The system handles various error scenarios:

- **Invalid XML**: Returns 400 Bad Request
- **Malformed LDT**: Returns 422 Unprocessable Entity
- **Server Errors**: Returns 500 Internal Server Error
- **Rate Limiting**: Returns 429 Too Many Requests

## 🧪 Testing

### Manual Testing

#### 1. Test Backend API Endpoints

```bash
# Test login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"bsnr": "123456789", "lanr": "1234567", "password": "doctor123"}'

# Test results (with token)
curl -X GET http://localhost:5000/api/results \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Mirth Connect webhook
curl -X POST http://localhost:5000/api/mirth-webhook \
  -H "Content-Type: text/plain" \
  -d '<column1>0278000921818LABOR_RESULTS_V2.1</column1>'

# Test LDT download
curl -X GET http://localhost:5000/api/download/ldt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o test_results.ldt

# Test PDF download
curl -X GET http://localhost:5000/api/download/pdf \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o test_results.pdf
```

#### 2. Test Frontend Application

1. **Login Test**
   - Open http://localhost:3000
   - Enter demo credentials
   - Verify successful login

2. **Dashboard Test**
   - Verify results table displays
   - Test search functionality
   - Test filter options
   - Test download buttons

3. **Download Test**
   - Test individual result downloads
   - Test bulk download functionality
   - Verify file formats (LDT/PDF)

### Automated Testing

```bash
# Run backend tests
cd server
npm test

# Run frontend tests
cd client
npm test

# Run integration tests
npm run test:integration
```

## 🚀 Production Deployment

### Docker Deployment

1. **Build and Run with Docker Compose**

```bash
# Build and start all services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

2. **Environment Configuration**

Create `.env` file for production:

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=your-super-secure-production-jwt-secret
DATABASE_URL=postgresql://labuser:secure_password@postgres:5432/lab_results
REDIS_URL=redis://redis:6379
FRONTEND_URL=https://your-domain.com
```

### Manual Deployment

1. **Backend Deployment**
   ```bash
   cd server
   npm install --production
   npm start
   ```

2. **Frontend Deployment**
   ```bash
   cd client
   npm install
   npm run build
   # Serve dist/ folder with web server
   ```

3. **Database Setup**
   ```bash
   # PostgreSQL setup
   createdb lab_results
   psql lab_results < database/init.sql
   ```

## 🔒 Security Considerations

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **Role-Based Access**: Different permissions for different users
- **Session Management**: Proper token expiration and refresh

### API Security
- **Rate Limiting**: Protection against abuse
- **CORS Configuration**: Secure cross-origin requests
- **Input Validation**: All inputs are validated and sanitized
- **Error Handling**: Secure error messages without information leakage

### Data Protection
- **HTTPS**: Use HTTPS in production
- **Data Encryption**: Encrypt sensitive data at rest
- **Audit Logging**: Track all user actions
- **Backup Security**: Secure database backups

## 📈 Performance Optimization

### Backend Optimizations
- **Caching**: Redis cache for frequently accessed data
- **Compression**: Response compression for better performance
- **Database Indexing**: Optimized database queries
- **Connection Pooling**: Efficient database connections

### Frontend Optimizations
- **Code Splitting**: Lazy loading of components
- **Image Optimization**: Compressed images and lazy loading
- **Bundle Optimization**: Minified and optimized bundles
- **CDN Integration**: Content delivery network for static assets

## 🐛 Troubleshooting

### Common Issues

#### 1. CORS Errors
**Problem**: Browser blocks requests due to CORS policy
**Solution**: Verify CORS configuration in server.js

#### 2. Authentication Failures
**Problem**: Login not working
**Solution**: Check JWT_SECRET in .env file

#### 3. Download Failures
**Problem**: Downloads not working
**Solution**: Verify file permissions and disk space

#### 4. Mirth Connect Integration Issues
**Problem**: Webhook not receiving data
**Solution**: Check network connectivity and firewall settings

### Debug Mode

Enable debug logging:

```env
LOG_LEVEL=debug
NODE_ENV=development
```

### Log Files

Check log files for detailed error information:

```bash
# Backend logs
tail -f server/logs/error.log
tail -f server/logs/combined.log

# Docker logs
docker-compose -f docker-compose.prod.yml logs -f app
```

## 📚 Additional Documentation

- **[API Download Guide](./API_DOWNLOAD_GUIDE.md)** - Detailed API documentation
- **[Testing Guide](./TESTING.md)** - Comprehensive testing instructions
- **[Production Readiness Report](./PRODUCTION_READINESS_REPORT.md)** - Production deployment guide
- **[Quick Fix Guide](./QUICK_FIX_GUIDE.md)** - Common issues and solutions
- **[Windows Setup Guide](./WINDOWS_SETUP_GUIDE.md)** - Windows-specific setup instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow ESLint configuration
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built following modern React and Express.js best practices
- Styled with Tailwind CSS for responsive design
- Designed for integration with Mirth Connect systems
- Implements German LDT standard for laboratory data exchange
- Production-ready with comprehensive monitoring and logging

## 📞 Support

For issues and questions:

1. Check the troubleshooting section above
2. Review the additional documentation files
3. Check GitHub issues for similar problems
4. Create a new issue with detailed information

### Contact Information

- **Email**: support@laborresults.com
- **Documentation**: [Project Wiki](https://github.com/your-repo/wiki)
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)

---

**Version**: 1.0.0  
**Last Updated**: 2024  
**Compatibility**: Node.js 18+, React 18+, Express 5+