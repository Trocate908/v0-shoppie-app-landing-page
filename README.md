# ShoppieApp

A production-ready marketplace platform connecting local shoppers with nearby vendors. Built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Features

### For Shoppers
- Browse products by location (country and market)
- Search products by name
- View product details, prices, and availability
- See vendor shop status (open/closed)
- Optimized for mobile devices and slow networks

### For Vendors
- Secure authentication with Supabase Auth
- Create your own location during signup
- Dashboard with real-time analytics
- Add and manage products
- Upload product images to Supabase Storage
- Toggle shop open/closed status
- Track product views (total and weekly)
- Edit product details and stock status
- Delete products with automatic image cleanup

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Analytics:** Built-in SQL-based analytics
- **Deployment:** Vercel-ready

## Project Structure

```
shoppieapp/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Landing page
│   ├── locations/page.tsx        # Location selector
│   ├── products/page.tsx         # Market products listing
│   ├── vendor/
│   │   ├── login/page.tsx        # Vendor login
│   │   ├── signup/page.tsx       # Vendor signup
│   │   ├── dashboard/page.tsx    # Vendor dashboard
│   │   └── products/
│   │       ├── page.tsx          # Manage products
│   │       └── add/page.tsx      # Add new product
│   ├── error.tsx                 # Global error boundary
│   └── loading.tsx               # Loading states
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── location-selector.tsx    # Cascading location dropdowns
│   ├── products-client.tsx      # Product listing with search
│   ├── dashboard-client.tsx     # Vendor dashboard
│   ├── add-product-form.tsx     # Product creation form
│   └── manage-products-client.tsx # Product management
├── lib/
│   └── supabase/
│       ├── client.ts            # Browser Supabase client
│       ├── server.ts            # Server Supabase client
│       └── proxy.ts             # Auth proxy utilities
├── scripts/                     # SQL migration scripts
│   ├── 01_create_locations_table.sql
│   ├── 02_create_vendors_table.sql
│   ├── 03_create_products_table.sql
│   ├── 04_create_product_views_table.sql
│   ├── 05_create_triggers.sql
│   ├── 06_seed_locations.sql
│   ├── 07_create_analytics_function.sql
│   ├── 08_create_storage_bucket.sql
│   └── 09_update_locations_structure.sql
└── proxy.ts                     # Middleware for protected routes
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account
- Vercel account (for deployment)

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url>
cd shoppieapp

# Install dependencies
npm install
# or
pnpm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project credentials from Settings > API
3. Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
```

### 3. Run Database Migrations

Execute the SQL scripts in order in your Supabase SQL Editor:

1. `scripts/01_create_locations_table.sql` - Creates locations table
2. `scripts/02_create_vendors_table.sql` - Creates vendors table
3. `scripts/03_create_products_table.sql` - Creates products table
4. `scripts/04_create_product_views_table.sql` - Creates product views table
5. `scripts/05_create_triggers.sql` - Creates auto-update triggers
6. `scripts/06_seed_locations.sql` - Seeds sample location data (optional)
7. `scripts/07_create_analytics_function.sql` - Creates analytics function
8. `scripts/08_create_storage_bucket.sql` - Sets up storage bucket
9. `scripts/09_update_locations_structure.sql` - Updates location RLS policies

**Important:** Run scripts in order to avoid dependency errors.

**Note:** Script 06 (seed data) is optional. Locations are now created by vendors during signup.

### 4. Configure Supabase Storage

The storage bucket is created by script 08, but verify it in Supabase Dashboard:

1. Go to Storage > Buckets
2. Confirm `product-images` bucket exists
3. Verify RLS policies are enabled

### 5. Run Development Server

```bash
npm run dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see your app.

### 6. Test the Application

**As a Shopper:**
1. Visit the homepage
2. Click "Find Products Near You"
3. Select Country > Location
4. Browse and search products

**As a Vendor:**
1. Visit the homepage
2. Click "Vendor Login"
3. Sign up with email/password
4. Select your country from the dropdown
5. Enter your location/market name
6. Complete vendor profile (shop name, description)
7. Access dashboard to add products

## Database Schema

### Tables

- **locations** - Countries, cities, and markets
- **vendors** - Vendor accounts linked to auth.users
- **products** - Product listings with images
- **product_views** - Analytics tracking

### Key Features

- **Row Level Security (RLS)** - Vendors can only manage their own data
- **Cascading Deletes** - Automatic cleanup when vendors/products deleted
- **Indexes** - Optimized queries for fast performance
- **Triggers** - Auto-update timestamps

## Environment Variables

Required environment variables (automatically set when using Supabase integration):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import project to Vercel
3. Connect Supabase integration in Vercel dashboard
4. Environment variables are automatically added
5. Deploy

Or use the Vercel CLI:

```bash
vercel
```

### Post-Deployment

1. Run database migrations on production Supabase instance
2. Update authentication redirect URLs in Supabase dashboard:
   - Add your production URL to allowed redirect URLs
   - Update site URL in Authentication settings

## Performance Optimizations

- **Image Optimization** - Next.js Image component with lazy loading
- **Lazy Loading** - IntersectionObserver for product view tracking
- **Responsive Images** - Multiple sizes for different viewports
- **SQL Aggregation** - Efficient analytics queries
- **Client-Side State** - Optimistic updates for better UX
- **Mobile-First** - Optimized for low-end Android devices

## Security Features

- **Supabase Auth** - Secure email/password authentication
- **Row Level Security** - Database-level access control
- **Protected Routes** - Middleware for vendor-only pages
- **Password Hashing** - Handled by Supabase Auth
- **Secure Storage** - RLS policies on product images
- **CSRF Protection** - Built-in Next.js security

## Error Handling

- Global error boundaries for all routes
- Vendor-specific error pages
- Toast notifications for user feedback
- Console logging for debugging
- Graceful fallbacks for failed requests

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Android)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

MIT License - feel free to use this project for your own purposes.

## Support

For issues or questions:
- Open an issue on GitHub
- Check Supabase documentation at [supabase.com/docs](https://supabase.com/docs)
- Review Next.js documentation at [nextjs.org/docs](https://nextjs.org/docs)

## Acknowledgments

- Built with [v0.dev](https://v0.dev)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Icons from [Lucide](https://lucide.dev)
