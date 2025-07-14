# Labor Results Web App

A full-stack web application for managing and viewing laboratory results, built with React frontend and Node.js/Express backend.

## Features

- **Secure Authentication**: Login with BSNR, LANR, and password
- **Results Dashboard**: View laboratory results in an organized table format
- **Search & Filter**: Search by patient name or result ID, filter by status and type
- **Responsive Design**: Modern UI built with Tailwind CSS
- **Mirth Connect Integration**: Webhook endpoint for receiving lab data
- **Real-time Updates**: Refresh functionality to get latest results

## Project Structure

```
labor-results-app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── LoginPage.js
│   │   │   └── ResultsDashboard.js
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── tailwind.config.js
├── server/                 # Node.js/Express backend
│   ├── server.js
│   ├── package.json
│   └── .env
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git

## Installation & Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd labor-results-app
```

### 2. Backend Setup

```bash
cd server
npm install
npm start
```

The backend server will start on http://localhost:5000

### 3. Frontend Setup

Open a new terminal window:

```bash
cd client
npm install
npm run dev
```

The Vite development server will start on http://localhost:3000

### Quick Start (Both Servers)

Alternatively, use the convenience script to start both servers at once:

```bash
./start-dev.sh
```

This will start both backend and frontend servers simultaneously.

## Usage

### Demo Credentials

For testing purposes, use these demo credentials:

- **BSNR**: `123456789`
- **LANR**: `1234567`
- **Password**: `securepassword`

### Features Overview

1. **Login Page**
   - Enter BSNR, LANR, and password
   - Secure authentication with backend validation
   - Error handling for invalid credentials

2. **Results Dashboard**
   - View all laboratory results in a responsive table
   - Search functionality for patient names and result IDs
   - Filter by result status (Final, Preliminary)
   - Filter by result type (Blood Count, Urinalysis, Microbiology)
   - Refresh button to fetch latest data
   - Logout functionality

## API Endpoints

### Authentication

- **POST** `/api/login`
  - Body: `{ "bsnr": "string", "lanr": "string", "password": "string" }`
  - Response: `{ "success": boolean, "message": "string", "token": "string" }`

### Results

- **GET** `/api/results`
  - Headers: `Authorization: Bearer <token>`
  - Response: Array of result objects

### Mirth Connect Integration

- **POST** `/api/mirth-webhook`
  - Receives laboratory data from Mirth Connect
  - Processes and stores data in the database

## Mock Data

The application includes mock laboratory results for demonstration:

```javascript
[
  {
    id: 'res001',
    date: '2023-01-15',
    type: 'Blood Count',
    status: 'Final',
    patient: 'Max Mustermann',
    bsnr: '123456789',
    lanr: '1234567'
  },
  // Additional mock results...
]
```

## Technologies Used

### Frontend
- **React**: UI framework
- **Vite**: Modern build tool and development server
- **Tailwind CSS**: Utility-first CSS framework
- **Fetch API**: HTTP client for API calls

### Backend
- **Node.js**: Runtime environment
- **Express.js**: Web framework
- **CORS**: Cross-origin resource sharing
- **dotenv**: Environment variable management

## Development

### Running in Development Mode

1. Start the backend server:
   ```bash
   cd server
   npm start
   ```

2. Start the frontend development server:
   ```bash
   cd client
   npm run dev
   ```

### Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=5000
# DATABASE_URL="postgresql://user:password@host:port/database"
# JWT_SECRET="your_very_secret_jwt_key"
```

## Production Deployment

### Backend Deployment

1. Set environment variables for production
2. Install dependencies: `npm install --production`
3. Start the server: `npm start`

### Frontend Deployment

1. Build the production version: `npm run build`
2. Serve the built files using a web server (e.g., Nginx, Apache)

## Security Considerations

- Implement proper JWT token generation and validation
- Use bcrypt for password hashing
- Validate and sanitize all input data
- Implement rate limiting for API endpoints
- Use HTTPS in production
- Implement proper error handling without exposing sensitive information

## Future Enhancements

- **Database Integration**: Connect to PostgreSQL or MongoDB
- **Advanced Authentication**: Implement JWT tokens with refresh mechanism
- **Role-based Access Control**: Different permissions for different user types
- **Real-time Updates**: WebSocket integration for live data updates
- **Export Functionality**: Export results to PDF or Excel
- **Advanced Filtering**: Date range, multiple criteria
- **User Management**: Admin panel for user management
- **Audit Logging**: Track user actions and data changes

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure the proxy is correctly configured in `client/package.json`
2. **Connection Refused**: Check that the backend server is running on port 5000
3. **Tailwind Styles Not Loading**: Verify Tailwind CSS is properly installed and configured

### Support

For issues and questions, please check the following:

1. Ensure all dependencies are installed
2. Check that both frontend and backend servers are running
3. Verify the proxy configuration
4. Check browser console for error messages

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Acknowledgments

- Built following modern React and Express.js best practices
- Styled with Tailwind CSS for responsive design
- Designed for integration with Mirth Connect systems