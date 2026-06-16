-- Migration: add_dynamic_check_sheets

-- Table for the dynamic check sheets metadata and schema
CREATE TABLE IF NOT EXISTS public.dynamic_check_sheets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    schema_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table for the individual rows of a dynamic check sheet
CREATE TABLE IF NOT EXISTS public.dynamic_check_sheet_rows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sheet_id UUID REFERENCES public.dynamic_check_sheets(id) ON DELETE CASCADE,
    row_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Policies
ALTER TABLE public.dynamic_check_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dynamic_check_sheet_rows ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read dynamic check sheets
CREATE POLICY "Enable read access for all authenticated users on dynamic_check_sheets" 
    ON public.dynamic_check_sheets FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Allow managers and team_leaders to insert/update/delete dynamic check sheets
CREATE POLICY "Enable insert/update/delete for managers on dynamic_check_sheets" 
    ON public.dynamic_check_sheets FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('manager', 'team_leader', 'admin')
        )
    );

-- Allow all authenticated users to read dynamic check sheet rows
CREATE POLICY "Enable read access for all authenticated users on dynamic_check_sheet_rows" 
    ON public.dynamic_check_sheet_rows FOR SELECT 
    USING (auth.role() = 'authenticated');

-- Allow all authenticated users to insert/update/delete rows (since team members need to tick boxes)
CREATE POLICY "Enable insert/update/delete for authenticated users on dynamic_check_sheet_rows" 
    ON public.dynamic_check_sheet_rows FOR ALL 
    USING (auth.role() = 'authenticated');
