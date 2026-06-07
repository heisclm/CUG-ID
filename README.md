# CUG Digital ID System

![CUG Digital ID 
A comprehensive, production-grade Digital ID Card Management System designed for the **Catholic University of Ghana (CUG)**. This platform streamlines the entire lifecycle of student identification, from application and payment to real-time security verification.

## 🚀 Key Features

### 🎓 For Students
- **Digital ID Application:** Seamless application process with photo upload and profile management.
- **Secure Payments:** Integrated with **Paystack** for instant, secure processing of ID card fees.
- **Digital ID Wallet:** Access your digital ID card anytime, anywhere. Features a secure, cryptographically signed QR code.
- **Downloadable IDs:** Generate high-quality PDF versions of your ID card for physical printing.

### 🛡️ For Security & Invigilators
- **Live QR Scanner:** High-performance, camera-based scanner for real-time identity verification.
- **Exam Mode:** Specialized verification mode for invigilators to check financial and academic clearance instantly.
- **Offline Verification:** Cryptographic signatures allow for basic validity checks even with intermittent connectivity.
- **Audit Logs:** Every scan is recorded with timestamps, location context, and scan mode (Gate vs. Exam).

### ⚙️ For Administrators
- **Staff Management:** Granular Role-Based Access Control (RBAC) to manage Admins, Security, and Invigilators.
- **Student Database Management:** Bulk upload student records via JSON or manual entry.
- **Application Review:** Dashboard to review, approve, or reject ID card applications.
- **System Analytics:** Overview of applications, payments, and security activity.

## 🛠️ Tech Stack

- **Framework:** [Next.js 15+](https://nextjs.org/) (App Router)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Database & Auth:** [Firebase](https://firebase.google.com/) (Firestore, Authentication)
- **Styling:** [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations:** [Motion](https://motion.dev/) (formerly Framer Motion)
- **Payments:** [Paystack API](https://paystack.com/)
- **Scanning:** [html5-qrcode](https://github.com/mebjas/html5-qrcode)
- **Icons:** [Lucide React](https://lucide.dev/)

## 🏗️ Architecture

### Security Model
The system uses a multi-layered security approach:
1. **Firestore Security Rules:** Strict server-side validation ensuring users can only access data relevant to their role.
2. **QR Signature:** ID payloads are signed using a secure hashing mechanism to prevent tampering or manual QR generation.
3. **RBAC:** Custom claims and profile-based roles (STUDENT, SECURITY, INVIGILATOR, ADMIN) govern UI access and API permissions.

### Data Flow
- **Applications:** Student -> Firestore -> Admin Review -> ID Generation.
- **Verification:** Scanner -> API Route (Admin SDK) -> Database Cross-check -> Result.

## 🚦 Getting Started

### Prerequisites
- Node.js 20+
- A Firebase Project
- A Paystack Account (Test/Live keys)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-org/cug-digital-id.git
   cd cug-digital-id
   ```

2. **Install dependencies:**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Environment Variables:**
   Create a `.env.local` file in the root and add the following:
   ```env
   # Firebase Client
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=

   # Firebase Admin (Server-side)
   FIREBASE_PROJECT_ID=
   FIREBASE_CLIENT_EMAIL=
   FIREBASE_PRIVATE_KEY=

   # Paystack
   NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
   PAYSTACK_SECRET_KEY=

   # Security
   QR_SIGNING_SECRET=
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

## 📖 User Roles

| Role | Permissions | Primary View |
| :--- | :--- | :--- |
| **Student** | Apply for ID, Pay, View ID | Student Dashboard |
| **Security** | Scan IDs (Gate Mode) | Live Scanner |
| **Invigilator** | Scan IDs (Exam Mode), Check Clearance | Live Scanner |
| **Admin** | Manage Staff, Students, Applications | Admin Dashboard |

## 🤝 Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request



---
*Built with ❤️ for the Catholic University of Ghana.*
