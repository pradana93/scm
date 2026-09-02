-- ============================================
-- SUPABASE DATABASE SCHEMA
-- Migration script for Base44 to Supabase
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE (extends auth.users)
-- ============================================
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can manage all users
CREATE POLICY "Admins can manage all users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================
-- 2. VENDORS TABLE
-- ============================================
CREATE TABLE public.vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  contact_person TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view vendors" ON public.vendors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage vendors" ON public.vendors
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 3. WAREHOUSES TABLE
-- ============================================
CREATE TABLE public.warehouses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view warehouses" ON public.warehouses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage warehouses" ON public.warehouses
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 4. OUTLETS TABLE
-- ============================================
CREATE TABLE public.outlets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  warehouse_id UUID REFERENCES public.warehouses(id),
  address TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view outlets" ON public.outlets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage outlets" ON public.outlets
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 5. ITEMS TABLE
-- ============================================
CREATE TABLE public.items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,
  unit_of_measure TEXT DEFAULT 'pcs',
  base_price DECIMAL(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view items" ON public.items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage items" ON public.items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 6. STOCK ITEMS TABLE
-- ============================================
CREATE TABLE public.stock_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  warehouse_id UUID REFERENCES public.warehouses(id),
  outlet_id UUID REFERENCES public.outlets(id),
  quantity DECIMAL(12, 2) DEFAULT 0,
  reserved_quantity DECIMAL(12, 2) DEFAULT 0,
  available_quantity DECIMAL(12, 2) GENERATED ALWAYS AS (quantity - reserved_quantity) STORED,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(item_id, warehouse_id, outlet_id)
);

ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock items" ON public.stock_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage stock items" ON public.stock_items
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 7. STOCK MOVEMENTS TABLE
-- ============================================
CREATE TABLE public.stock_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id UUID REFERENCES public.items(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  outlet_id UUID REFERENCES public.outlets(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in', 'out', 'adjustment', 'transfer')),
  quantity DECIMAL(12, 2) NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view stock movements" ON public.stock_movements
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can create stock movements" ON public.stock_movements
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 8. PRODUCTION TABLE
-- ============================================
CREATE TABLE public.productions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  production_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.productions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view productions" ON public.productions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage productions" ON public.productions
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 9. RECEIPTS TABLE
-- ============================================
CREATE TABLE public.receipts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  receipt_number TEXT UNIQUE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  warehouse_id UUID REFERENCES public.warehouses(id),
  receipt_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'completed', 'cancelled')),
  total_amount DECIMAL(12, 2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view receipts" ON public.receipts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage receipts" ON public.receipts
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- 10. SHIPMENTS TABLE
-- ============================================
CREATE TABLE public.shipments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  shipment_number TEXT UNIQUE NOT NULL,
  warehouse_id UUID REFERENCES public.warehouses(id),
  destination TEXT NOT NULL,
  shipment_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view shipments" ON public.shipments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage shipments" ON public.shipments
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_vendors_code ON public.vendors(code);
CREATE INDEX idx_warehouses_code ON public.warehouses(code);
CREATE INDEX idx_outlets_code ON public.outlets(code);
CREATE INDEX idx_items_code ON public.items(code);
CREATE INDEX idx_stock_items_item_id ON public.stock_items(item_id);
CREATE INDEX idx_stock_items_warehouse_id ON public.stock_items(warehouse_id);
CREATE INDEX idx_stock_movements_item_id ON public.stock_movements(item_id);
CREATE INDEX idx_stock_movements_created_at ON public.stock_movements(created_at);
CREATE INDEX idx_productions_status ON public.productions(status);
CREATE INDEX idx_receipts_status ON public.receipts(status);
CREATE INDEX idx_shipments_status ON public.shipments(status);

-- ============================================
-- TRIGGER FOR UPDATED_AT
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_outlets_updated_at BEFORE UPDATE ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_productions_updated_at BEFORE UPDATE ON public.productions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_receipts_updated_at BEFORE UPDATE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL ADMIN USER FUNCTION
-- ============================================
-- This function creates an admin user after signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name, is_active)
  VALUES (NEW.id, NEW.email, 'user', NEW.raw_user_meta_data->>'full_name', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to handle new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- APP SETTINGS TABLE (for setup wizard)
-- ============================================
CREATE TABLE public.app_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  app_name TEXT NOT NULL DEFAULT 'Inventory App',
  company_name TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'IDR',
  timezone TEXT DEFAULT 'Asia/Jakarta',
  is_initialized BOOLEAN DEFAULT false,
  initialized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default app settings
INSERT INTO public.app_settings (app_name, is_initialized) 
VALUES ('Inventory Management System', false);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app settings" ON public.app_settings
  FOR SELECT USING (true);

CREATE POLICY "Only admins can update app settings" ON public.app_settings
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );
