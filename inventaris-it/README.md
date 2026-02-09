# IT Support Inventory App

A modern IT asset management and task assignment system built with React and Supabase.

---

## Tech Stack Overview

| Category | Technology |
|----------|------------|
| Frontend | React 19.2.0 |
| Language | JavaScript (JSX) |
| Routing | React Router DOM 7.12.0 |
| Styling | Tailwind CSS 3.4.0 |
| UI Components | shadcn/ui-style (Radix primitives) |
| Backend | Supabase (Auth + Database + Realtime) |
| Build Tool | Vite 7.2.4 |
| Deployment | Vercel |

---

## Project Structure

```
src/
├── App.jsx                  # Main app with routing
├── main.jsx                 # Entry point
├── index.css                # Global styles + Tailwind + CSS variables
│
├── components/              # Reusable components
│   ├── ui/                  # shadcn/ui-style primitives
│   │   ├── badge.jsx
│   │   ├── button.jsx
│   │   ├── card.jsx
│   │   ├── input.jsx
│   │   ├── select.jsx
│   │   ├── table.jsx
│   │   ├── toast.jsx
│   │   └── toaster.jsx
│   ├── Layout.jsx           # Main layout with sidebar navigation
│   ├── ProtectedRoute.jsx   # Route protection HOC
│   ├── ErrorBoundary.jsx    # Error handling wrapper
│   ├── IPAddressInput.jsx   # Custom IP input component
│   ├── MACAddressInput.jsx  # Custom MAC input component
│   └── StorageInput.jsx     # Custom storage input component
│
├── contexts/                # React Context providers
│   ├── AuthContext.jsx      # Authentication state & methods
│   └── ToastContext.jsx     # Toast notification state
│
├── hooks/                   # Custom React hooks
│   └── use-toast.js         # Toast notification hook
│
├── lib/                     # Utilities & services
│   ├── supabase.js          # Supabase client initialization
│   ├── utils.js             # cn() helper for class merging
│   ├── telegram.js          # Telegram bot integration
│   └── pagePermissions.js   # Page permission utilities
│
├── pages/                   # Page components (21 total)
│   ├── Dashboard.jsx
│   ├── DashboardExecutive.jsx
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── StokOpnam.jsx
│   ├── StokOpnameV2.jsx
│   ├── CheckDataku.jsx
│   ├── ImportData.jsx
│   ├── ProgressSKP.jsx
│   ├── LogPenugasan.jsx
│   ├── Penugasan.jsx
│   ├── DaftarTugas.jsx
│   ├── UserManagement.jsx
│   ├── MasterJenisPerangkat.jsx
│   ├── MasterJenisBarang.jsx
│   ├── MasterLokasi.jsx
│   ├── MasterKategoriUser.jsx
│   ├── MasterSKP.jsx
│   ├── UserCategoryAssignment.jsx
│   ├── SKPCategoryAssignment.jsx
│   └── PagePermissionAssignment.jsx
│
└── assets/                  # Static assets
```

---

## Routes & Pages

### Public Routes

| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | User authentication |
| `/register` | Register | New user registration |

### Protected Routes - All Users

| Route | Page | Description |
|-------|------|-------------|
| `/` | Dashboard | Main dashboard with inventory stats |
| `/dashboard-executive` | DashboardExecutive | Executive overview (opens in new tab) |
| `/progress-skp` | ProgressSKP | SKP progress tracking |
| `/check-dataku` | CheckDataku | View personal assigned data |

### Protected Routes - IT Support & Admin

| Route | Page | Description |
|-------|------|-------------|
| `/stok-opnam` | StokOpnam | Inventory management |
| `/stok-opname-v2` | StokOpnameV2 | Updated inventory interface |
| `/import-data` | ImportData | Bulk data import tool |

### Protected Routes - Admin Only

| Route | Page | Description |
|-------|------|-------------|
| `/user-management` | UserManagement | Manage system users |
| `/master-kategori-user` | MasterKategoriUser | User category master data |
| `/master-skp` | MasterSKP | SKP master data |
| `/user-category-assignment` | UserCategoryAssignment | Assign categories to users |
| `/skp-category-assignment` | SKPCategoryAssignment | Assign SKP to categories |
| `/page-permission-assignment` | PagePermissionAssignment | Manage page access permissions |

### Protected Routes - Permission Based

| Route | Page | Description |
|-------|------|-------------|
| `/log-penugasan` | LogPenugasan | Task assignment logs |
| `/log-penugasan/penugasan` | Penugasan | Create task assignments |
| `/log-penugasan/daftar-tugas` | DaftarTugas | View task list |

### Master Data Routes

| Route | Page | Access |
|-------|------|--------|
| `/master-jenis-perangkat` | MasterJenisPerangkat | All roles |
| `/master-jenis-barang` | MasterJenisBarang | All roles |
| `/master-lokasi` | MasterLokasi | All roles |

---

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `administrator` | Full system access | All pages |
| `it_support` | IT support staff | Inventory + tasks |
| `helpdesk` | Help desk staff | Limited inventory view |
| `user` | Standard user | Basic access |
| `standard` | Category-based access | Permission-controlled |

---

## State Management

### Global State (React Context)

- **AuthContext** - User authentication, profile, and page permissions
- **ToastContext** - Application-wide toast notifications

### Local State

Each page component manages its own local state using `useState` hooks.

---

## Styling Architecture

### Tailwind CSS Configuration

The app uses a **dark theme** with CSS custom properties defined in `src/index.css`:

```css
:root {
  --background: 222.2 47.4% 11.2%;
  --foreground: 210 40% 98%;
  --primary: 217.2 91.2% 59.8%;
  --secondary: 217.2 32.6% 17.5%;
  --destructive: 0 62.8% 30.6%;
  --muted: 217.2 32.6% 17.5%;
  --accent: 217.2 32.6% 17.5%;
  --border: 217.2 32.6% 17.5%;
  --input: 217.2 32.6% 17.5%;
  --ring: 224.3 76.3% 48%;
  --radius: 0.5rem;
}
```

### UI Component Libraries

| Library | Purpose |
|---------|---------|
| @radix-ui/react-* | Accessible UI primitives |
| class-variance-authority | Variant-based component styling |
| clsx + tailwind-merge | Conditional class merging |
| @heroicons/react | Icon set |
| lucide-react | Additional icons |
| framer-motion | Animations |
| recharts | Data visualization |

---

## Database Integration

### Supabase Client

Located at `src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=<YOUR_SUPABASE_URL>
VITE_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
```

### Query Pattern

Supabase queries are co-located within page components:

```javascript
const { data, error } = await supabase
  .from('perangkat')
  .select(`
    id,
    nama_perangkat,
    jenis_perangkat:ms_jenis_perangkat!perangkat_jenis_perangkat_kode_fkey(nama)
  `)
  .order('tanggal_entry', { ascending: false });
```

### Realtime Subscriptions

The app uses Supabase Realtime for live notifications:

```javascript
const subscription = supabase
  .channel('notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, callback)
  .subscribe();
```

---

## Build Configuration

### Vite Configuration

Key optimizations in `vite.config.js`:

- **Code splitting** - Separate vendor chunks for React, Supabase, and icons
- **Path aliases** - `@` maps to `src/`
- **Minification** - esbuild (faster than terser)

```javascript
rollupOptions: {
  output: {
    manualChunks: {
      'react-vendor': ['react', 'react-dom', 'react-router-dom'],
      'supabase-vendor': ['@supabase/supabase-js'],
      'icons-vendor': ['@heroicons/react'],
    },
  },
},
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account with configured database

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd inventaris-it

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

---

## Dependencies

### Production

| Package | Version | Purpose |
|---------|---------|---------|
| react | ^19.2.0 | UI framework |
| react-dom | ^19.2.0 | React DOM renderer |
| react-router-dom | ^7.12.0 | Client-side routing |
| @supabase/supabase-js | ^2.90.1 | Backend client |
| tailwindcss | ^3.4.0 | Utility-first CSS |
| @radix-ui/react-* | various | Accessible UI primitives |
| framer-motion | ^12.27.1 | Animation library |
| recharts | ^3.6.0 | Charting library |
| lucide-react | ^0.562.0 | Icon library |
| @heroicons/react | ^2.2.0 | Icon library |
| class-variance-authority | ^0.7.1 | Variant styling |
| clsx | ^2.1.1 | Class name utility |
| tailwind-merge | ^3.4.0 | Tailwind class merging |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| vite | ^7.2.4 | Build tool |
| @vitejs/plugin-react | ^5.1.1 | React plugin for Vite |
| eslint | ^9.39.1 | Code linting |
| @types/react | ^19.2.5 | TypeScript definitions |
| @types/react-dom | ^19.2.3 | TypeScript definitions |

---

## License

Private project - All rights reserved.
