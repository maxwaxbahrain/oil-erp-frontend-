# Oil ERP Frontend - Setup Instructions

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** (optional, for version control)

## 🚀 Quick Start

### Step 1: Extract the Project
Extract the `oil-erp-frontend` folder to your desired location.

### Step 2: Install Dependencies
Open a terminal/command prompt in the project folder and run:

```bash
cd oil-erp-frontend
npm install
```

This will install all required dependencies (may take 2-5 minutes).

### Step 3: Start the Development Server
```bash
npm run dev
```

The application will start at: **http://localhost:5173/**

### Step 4: Open in Browser
Navigate to `http://localhost:5173/` in your web browser.

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

## 📁 Project Structure

```
oil-erp-frontend/
├── src/                    # Source code
│   ├── app/               # Main app component
│   ├── components/        # Reusable components
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── constants/         # Constants and data
│   └── types/             # TypeScript types
├── public/                # Static assets
├── .agent/                # Workflows and tasks
└── *.md                   # Documentation files
```

## 📚 Important Documentation

- **README.md** - Project overview
- **INTEGRATION_CHECKLIST.md** - Integration status
- **CUSTOMER_TESTING_GUIDE.md** - Testing guide
- **INVOICE_PROCESSING_README.md** - Invoice processing
- **INTEGRATION_TESTING.md** - Integration testing

## 🔧 Backend Integration

This frontend requires a backend API. See:
- **START_PYTHON_BACKEND.md** - Backend setup instructions
- **HOW_TO_CHECK_BACKEND.md** - Backend verification
- **check-backend.sh** - Backend health check script

## ⚙️ Configuration

The API base URL can be configured in:
```
src/services/api.ts
```

Default: `http://localhost:8000`

## 🐛 Troubleshooting

### Port Already in Use
If port 5173 is already in use, Vite will automatically try the next available port.

### Dependencies Installation Failed
Try:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors
Ensure you're using Node.js v18 or higher:
```bash
node --version
```

## 📞 Support

For issues or questions, refer to the documentation files or check the `.agent/` folder for detailed workflows.

## 🎯 Next Steps

1. Explore the application at http://localhost:5173/
2. Review the documentation files
3. Set up the backend (if needed)
4. Run integration tests using the provided scripts

---

**Happy Coding! 🚀**
