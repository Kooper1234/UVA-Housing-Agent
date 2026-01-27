-- Schema for Points of Interest and Bus Stops tables
-- Run this in your Supabase SQL editor

-- Points of Interest table
CREATE TABLE IF NOT EXISTS points_of_interest (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    category TEXT, -- e.g., 'library', 'dining', 'academic', 'recreation'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster coordinate lookups
CREATE INDEX IF NOT EXISTS idx_poi_coords ON points_of_interest (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_poi_category ON points_of_interest (category);

-- Bus Stops table
CREATE TABLE IF NOT EXISTS bus_stops (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    routes TEXT[], -- Array of route names/numbers
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster coordinate lookups
CREATE INDEX IF NOT EXISTS idx_bus_stops_coords ON bus_stops (latitude, longitude);

-- Sample POIs for UVA (you'll want to add more)
INSERT INTO points_of_interest (id, name, address, latitude, longitude, category, description) VALUES
    ('poi_alderman', 'Alderman Library', '160 McCormick Rd, Charlottesville, VA 22904', 38.0364, -78.5050, 'library', 'Main library on Grounds'),
    ('poi_newcomb', 'Newcomb Hall', '1 University Station, Charlottesville, VA 22904', 38.0358, -78.5053, 'dining', 'Student center with dining options'),
    ('poi_rotunda', 'The Rotunda', 'University of Virginia, Charlottesville, VA 22904', 38.0356, -78.5034, 'academic', 'Historic center of Grounds'),
    ('poi_afc', 'Aquatic & Fitness Center', '540 Emmet St S, Charlottesville, VA 22904', 38.0321, -78.5098, 'recreation', 'Student recreation center'),
    ('poi_rice_hall', 'Rice Hall', '85 Engineer''s Way, Charlottesville, VA 22904', 38.0318, -78.5108, 'academic', 'Computer Science building'),
    ('poi_clemons', 'Clemons Library', '100 Clemons Library, Charlottesville, VA 22904', 38.0378, -78.5059, 'library', '24/7 library'),
    ('poi_scott_stadium', 'Scott Stadium', '1024 Copeley Rd, Charlottesville, VA 22903', 38.0308, -78.5109, 'recreation', 'Football stadium'),
    ('poi_corner', 'The Corner', 'University Ave & 14th St NW, Charlottesville, VA 22903', 38.0345, -78.5017, 'dining', 'Student dining and shopping area')
ON CONFLICT (id) DO NOTHING;

-- Sample Bus Stops (you'll want to add more based on UVA transit routes)
INSERT INTO bus_stops (id, name, address, latitude, longitude, routes, description) VALUES
    ('bus_emmet_mccormick', 'Emmet St & McCormick Rd', 'Emmet St & McCormick Rd, Charlottesville, VA 22903', 38.0371, -78.5083, ARRAY['Free Trolley', 'Route 7'], 'Main bus stop near Alderman'),
    ('bus_newcomb', 'Newcomb Hall', 'Newcomb Hall, Charlottesville, VA 22904', 38.0358, -78.5053, ARRAY['Free Trolley'], 'Bus stop at Newcomb Hall'),
    ('bus_barracks_rugby', 'Barracks Rd & Rugby Rd', 'Barracks Rd & Rugby Rd, Charlottesville, VA 22903', 38.0415, -78.5020, ARRAY['Route 7', 'Route 11'], 'North Grounds bus stop'),
    ('bus_scott_stadium', 'Scott Stadium', 'Copeley Rd, Charlottesville, VA 22903', 38.0310, -78.5105, ARRAY['Game Day Shuttle'], 'Stadium area bus stop'),
    ('bus_corner', 'The Corner', 'University Ave, Charlottesville, VA 22903', 38.0345, -78.5017, ARRAY['Free Trolley', 'Route 4'], 'Corner area bus stop')
ON CONFLICT (id) DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_poi_updated_at BEFORE UPDATE ON points_of_interest
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bus_stops_updated_at BEFORE UPDATE ON bus_stops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();